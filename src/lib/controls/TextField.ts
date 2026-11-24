import { Container, Graphics, Rectangle, Text, type FederatedPointerEvent, type Ticker } from '../render/canvas';
import { Control, type ControlOptions } from '../core/Control';
import type { FormUI } from '../core/FormUI';
import type { AutocompleteToken, KeyboardTarget } from '../core/KeyboardProxy';
import { SecureBuffer, toCodePoints } from '../security/SecureBuffer';
import { sanitizeInput } from '../security/sanitize';
import type { TextInputFormatter } from '../security/formatters';
import { cssFont } from '../theme';

export interface TextFieldOptions<V> extends ControlOptions<V> {
  placeholder?: string;
  /** Maximum number of characters (code points). */
  maxLength?: number;
  /** Characters allowed, tested one by one, e.g. /[0-9]/. */
  allow?: RegExp;
  multiline?: boolean;
  /** Visible rows for multiline fields. */
  rows?: number;
  readOnly?: boolean;
  showCounter?: boolean;
  inputMode?: KeyboardTarget['inputMode'];
  enterKeyHint?: KeyboardTarget['enterKeyHint'];
  /** Unicode normalisation applied to input. Default NFC. */
  normalize?: 'NFC' | 'NFKC' | false;
  /** Flutter-style formatters applied to every insertion (before sanitising). */
  formatters?: TextInputFormatter[];
  /** Like Flutter's enableInteractiveSelection. False disables selection and copy/cut. */
  enableInteractiveSelection?: boolean;
  /**
   * Opt into browser autofill / password managers with a standard token, e.g. 'email', 'name',
   * 'tel', 'street-address', 'username' (or 'username webauthn' for passkey suggestions).
   * Default 'off'. Suggestions pass through the relay input exactly like typing and are cleared at once.
   */
  autocomplete?: AutocompleteToken;
}

interface Line {
  start: number;
  end: number;
  text: string;
  widths: number[];
}

interface Snapshot {
  text: string;
  caret: number;
  anchor: number;
}

const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const WORD_CHAR = /[\p{L}\p{N}_]/u;
const HISTORY_LIMIT = 100;

/**
 * Canvas-rendered text editor with caret, selection, word navigation,
 * clipboard, undo/redo, wrapping and scrolling.
 *
 * All content is stored in a SecureBuffer; the DOM never sees it.
 */
export abstract class TextField<V> extends Control<V> {
  override readonly acceptsText = true;
  override readonly inputMode: KeyboardTarget['inputMode'];
  override readonly enterKeyHint: KeyboardTarget['enterKeyHint'];
  override readonly autocomplete: AutocompleteToken;

  protected readonly buf = new SecureBuffer();
  protected caret = 0;
  protected anchor = 0;
  protected readonly multiline: boolean;
  protected readonly rows: number;
  protected readonly maxLength: number;
  protected readonly allow?: RegExp;
  protected readonly normalizeForm: 'NFC' | 'NFKC' | false;
  readOnly: boolean;
  placeholder: string;
  showCounter: boolean;
  /** Draw content as mask characters (password fields). */
  protected masked = false;
  protected obscuringCharacter = '\u2022';
  /** Index of a character temporarily shown in clear in a masked field (-1 = none). */
  protected revealIndex = -1;
  protected readonly formatters: TextInputFormatter[];
  readonly selectable: boolean;
  /** Extra width reserved on the right of the box (e.g. reveal button). */
  protected trailingWidth = 0;

  private readonly box = new Graphics();
  private readonly textLayer = new Container();
  private readonly scroller = new Container();
  private readonly clip = new Graphics();
  private readonly selection = new Graphics();
  private readonly caretGfx = new Graphics();
  private readonly placeholderText: Text;
  private readonly counterText: Text;
  private readonly linePool: Text[] = [];
  private lines: Line[] = [];
  protected layoutDirty = true;
  private scrollX = 0;
  private scrollY = 0;
  private goalX: number | null = null;
  private blinkElapsed = 0;
  private dragging = false;
  private lastClickTime = 0;
  private clickCount = 0;
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private lastEdit: { kind: string; time: number } | null = null;

  constructor(ui: FormUI, opts: TextFieldOptions<V>) {
    super(ui, opts);
    this.multiline = !!opts.multiline;
    this.rows = Math.max(2, opts.rows ?? 4);
    this.maxLength = Math.max(1, Math.min(opts.maxLength ?? (this.multiline ? 2000 : 256), 20_000));
    this.allow = opts.allow;
    this.normalizeForm = opts.normalize ?? 'NFC';
    this.readOnly = !!opts.readOnly;
    this.placeholder = opts.placeholder ?? '';
    this.showCounter = !!opts.showCounter;
    this.formatters = [...(opts.formatters ?? [])];
    this.selectable = opts.enableInteractiveSelection ?? true;
    this.inputMode = opts.inputMode ?? 'text';
    this.autocomplete = opts.autocomplete ?? 'off';
    this.enterKeyHint = opts.enterKeyHint ?? (this.multiline ? 'enter' : 'next');

    this.placeholderText = new Text({ text: '', style: this.textStyle('body') });
    this.counterText = new Text({ text: '', style: this.textStyle('helper') });
    this.scroller.addChild(this.selection, this.caretGfx);
    this.textLayer.addChild(this.clip, this.placeholderText, this.scroller);
    this.scroller.mask = this.clip;
    this.body.addChildAt(this.box, 0);
    this.body.addChild(this.textLayer);
    this.addChild(this.counterText);

    this.body.eventMode = 'static';
    this.body.cursor = 'text';
    this.body.on('pointerdown', this.onPointerDown, this);
    this.body.on('pointertap', this.onTouchTap, this);
    this.body.on('globalpointermove', this.onPointerMove, this);
    this.body.on('pointerup', this.onPointerUp, this);
    this.body.on('pointerupoutside', this.onPointerUp, this);
    this.body.on('pointerover', () => this.setHover(true));
    this.body.on('pointerout', () => this.setHover(false));
  }

  // ---------------------------------------------------------------- public API
  get length(): number {
    return this.buf.length;
  }

  isEmpty(): boolean {
    return this.buf.length === 0;
  }

  /** Selected range as [start, end). */
  getSelection(): [number, number] {
    return this.caret < this.anchor ? [this.caret, this.anchor] : [this.anchor, this.caret];
  }

  setSelection(start: number, end = start): void {
    if (!this.selectable) start = end;
    this.anchor = clamp(start, 0, this.buf.length);
    this.caret = clamp(end, 0, this.buf.length);
    this.selectionChanged();
  }

  selectAll(): void {
    this.setSelection(0, this.buf.length);
  }

  reset(): void {
    this.buf.wipe();
    this.caret = this.anchor = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.scrollX = this.scrollY = 0;
    this.setError(null);
    this.touched = false;
    this.contentChanged(false);
  }

  override wipe(): void {
    this.buf.wipe();
    this.caret = this.anchor = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.layoutDirty = true;
  }

  /** Replaces content programmatically (sanitised, length-limited). */
  protected setText(text: string, emit: boolean): void {
    const clean = sanitizeInput(text, this.sanitizeOpts(this.maxLength));
    this.buf.set(toCodePoints(clean));
    this.caret = this.anchor = this.buf.length;
    this.undoStack = [];
    this.redoStack = [];
    this.contentChanged(emit);
  }

  // ---------------------------------------------------------------- KeyboardTarget
  override ariaRole(): string {
    return 'textbox';
  }

  override ariaState(): Record<string, string | null> {
    return {
      ...super.ariaState(),
      'aria-multiline': this.multiline ? 'true' : null,
      'aria-readonly': this.readOnly ? 'true' : null,
      'aria-placeholder': this.placeholder || null,
    };
  }

  /** An autofill or password-manager suggestion replaces the whole value (through the usual formatters and checks). */
  handleAutofill(text: string): void {
    if (this.readOnly) return;
    this.selectAll();
    this.handleText(text);
  }

  override handleText(text: string): void {
    if (text === '\n' && !this.multiline) {
      this.emit('submit', this);
      return;
    }
    this.replaceSelection(text, 'insert');
  }

  override handlePaste(text: string): void {
    this.replaceSelection(text, 'paste');
  }

  override handleDelete(direction: 'backward' | 'forward'): void {
    this.deleteDirection(direction, false);
  }

  override handleCopy(cut: boolean): string | null {
    if (!this.selectable) return null;
    const [s, e] = this.getSelection();
    if (s === e) return null;
    const text = this.buf.toString(s, e);
    if (cut && !this.readOnly) this.deleteRange(s, e, 'cut');
    return text;
  }

  override handleKeyDown(e: KeyboardEvent): boolean {
    const mod = IS_MAC ? e.metaKey : e.ctrlKey;
    const word = IS_MAC ? e.altKey : e.ctrlKey;
    const shift = e.shiftKey;
    const [s, en] = this.getSelection();
    const hasSel = s !== en;

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const left = e.key === 'ArrowLeft';
        let target: number;
        if (hasSel && !shift && !word && !(IS_MAC && e.metaKey)) target = left ? s : en;
        else if (IS_MAC && e.metaKey) target = left ? this.lineStart(this.caret) : this.lineEnd(this.caret);
        else if (word) target = left ? this.wordLeft(this.caret) : this.wordRight(this.caret);
        else target = this.caret + (left ? -1 : 1);
        this.moveCaret(target, shift);
        return true;
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        if (!this.multiline) {
          if (!IS_MAC) return false;
          this.moveCaret(e.key === 'ArrowUp' ? 0 : this.buf.length, shift);
          return true;
        }
        if (mod) {
          this.moveCaret(e.key === 'ArrowUp' ? 0 : this.buf.length, shift);
          return true;
        }
        this.moveVertical(e.key === 'ArrowUp' ? -1 : 1, shift);
        return true;
      }
      case 'Home':
      case 'End': {
        const home = e.key === 'Home';
        const target = e.ctrlKey || !this.multiline
          ? home ? 0 : this.buf.length
          : home ? this.lineStart(this.caret) : this.lineEnd(this.caret);
        this.moveCaret(target, shift);
        return true;
      }
      case 'PageUp':
      case 'PageDown':
        if (!this.multiline) return false;
        this.moveVertical((e.key === 'PageUp' ? -1 : 1) * this.rows, shift);
        return true;
      case 'Backspace':
      case 'Delete': {
        const dir = e.key === 'Backspace' ? 'backward' : 'forward';
        if (IS_MAC && e.metaKey && dir === 'backward' && !hasSel) {
          this.deleteRange(this.lineStart(this.caret), this.caret, 'delete');
        } else {
          this.deleteDirection(dir, word);
        }
        return true;
      }
      case 'Enter':
        if (!this.multiline || mod) {
          this.emit('submit', this);
          return true;
        }
        this.replaceSelection('\n', 'insert');
        return true;
      case 'Escape':
        if (hasSel) {
          this.setSelection(this.caret);
          return true;
        }
        return false;
    }

    if (mod && !e.altKey) {
      switch (e.key.toLowerCase()) {
        case 'a':
          if (!this.selectable) return true;
          this.selectAll();
          return true;
        case 'z':
          if (shift) this.redo();
          else this.undo();
          return true;
        case 'y':
          if (!IS_MAC) {
            this.redo();
            return true;
          }
          return false;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- editing
  protected sanitizeOpts(maxCodePoints: number) {
    return { multiline: this.multiline, allow: this.allow, maxCodePoints, normalize: this.normalizeForm };
  }

  protected replaceSelection(text: string, kind: 'insert' | 'paste'): void {
    if (this.readOnly || !this._enabled) return;
    const [s, e] = this.getSelection();
    const room = this.maxLength - (this.buf.length - (e - s));
    let formatted = text;
    if (this.formatters.length) {
      // Secret fields never expose surrounding text to formatters.
      const ctx = this.secure
        ? { before: '', after: '' }
        : { before: this.buf.toString(0, s), after: this.buf.toString(e) };
      for (const f of this.formatters) formatted = f(formatted, ctx);
    }
    const clean = sanitizeInput(formatted, this.sanitizeOpts(room));
    if (!clean) {
      if (room <= 0) this.ui.announcer.announce(`Maximum of ${this.maxLength} characters reached.`);
      return;
    }
    this.pushHistory(kind === 'insert' && clean.length === 1 && clean !== ' ' ? 'type' : kind);
    const cps = toCodePoints(clean);
    this.buf.delete(s, e);
    this.buf.insert(s, cps);
    this.caret = this.anchor = s + cps.length;
    this.onInserted(s, cps.length);
    this.contentChanged(true);
  }

  /** Hook: called after characters are inserted at `index`. */
  protected onInserted(_index: number, _count: number): void {}

  protected deleteDirection(dir: 'backward' | 'forward', word: boolean): void {
    const [s, e] = this.getSelection();
    if (s !== e) {
      this.deleteRange(s, e, 'delete');
      return;
    }
    const target = dir === 'backward'
      ? word ? this.wordLeft(this.caret) : this.caret - 1
      : word ? this.wordRight(this.caret) : this.caret + 1;
    const a = clamp(Math.min(target, this.caret), 0, this.buf.length);
    const b = clamp(Math.max(target, this.caret), 0, this.buf.length);
    this.deleteRange(a, b, 'delete');
  }

  protected deleteRange(start: number, end: number, kind: string): void {
    if (this.readOnly || !this._enabled || start === end) return;
    this.pushHistory(kind);
    this.buf.delete(start, end);
    this.caret = this.anchor = start;
    this.contentChanged(true);
  }

  /** Secret fields never keep undo history (it would retain old secrets). */
  protected get keepsHistory(): boolean {
    return !this.secure;
  }

  private pushHistory(kind: string): void {
    if (!this.keepsHistory) return;
    const now = performance.now();
    const coalesce = this.lastEdit && this.lastEdit.kind === kind && kind !== 'paste' && now - this.lastEdit.time < 1000;
    this.lastEdit = { kind, time: now };
    this.redoStack = [];
    if (coalesce) return;
    this.undoStack.push({ text: this.buf.toString(), caret: this.caret, anchor: this.anchor });
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
  }

  undo(): void {
    this.restore(this.undoStack, this.redoStack);
  }

  redo(): void {
    this.restore(this.redoStack, this.undoStack);
  }

  private restore(from: Snapshot[], to: Snapshot[]): void {
    if (!this.keepsHistory || this.readOnly) return;
    const snap = from.pop();
    if (!snap) return;
    to.push({ text: this.buf.toString(), caret: this.caret, anchor: this.anchor });
    this.buf.set(toCodePoints(snap.text));
    this.caret = snap.caret;
    this.anchor = snap.anchor;
    this.lastEdit = null;
    this.contentChanged(true);
  }

  // ---------------------------------------------------------------- navigation
  private moveCaret(index: number, extend: boolean, keepGoal = false): void {
    this.caret = clamp(index, 0, this.buf.length);
    if (!extend || !this.selectable) this.anchor = this.caret;
    if (!keepGoal) this.goalX = null;
    this.selectionChanged();
  }

  private moveVertical(deltaLines: number, extend: boolean): void {
    this.ensureLayout();
    const { x, line } = this.caretPos(this.caret);
    if (this.goalX === null) this.goalX = x;
    const target = line + deltaLines;
    if (target < 0) return this.moveCaret(0, extend, true);
    if (target >= this.lines.length) return this.moveCaret(this.buf.length, extend, true);
    this.moveCaret(this.indexInLine(target, this.goalX), extend, true);
  }

  private isWord(i: number): boolean {
    return WORD_CHAR.test(String.fromCodePoint(this.buf.at(i)));
  }

  private wordLeft(i: number): number {
    if (this.masked) return 0;
    while (i > 0 && !this.isWord(i - 1)) i--;
    while (i > 0 && this.isWord(i - 1)) i--;
    return i;
  }

  private wordRight(i: number): number {
    const n = this.buf.length;
    if (this.masked) return n;
    while (i < n && !this.isWord(i)) i++;
    while (i < n && this.isWord(i)) i++;
    return i;
  }

  private wordAt(i: number): [number, number] {
    if (this.masked) return [0, this.buf.length];
    let a = i;
    let b = i;
    const n = this.buf.length;
    if (i < n && this.isWord(i)) {
      while (a > 0 && this.isWord(a - 1)) a--;
      while (b < n && this.isWord(b)) b++;
    } else if (i < n) {
      b = i + 1;
    }
    return [a, b];
  }

  private lineStart(i: number): number {
    this.ensureLayout();
    return this.lines[this.lineOf(i)].start;
  }

  private lineEnd(i: number): number {
    this.ensureLayout();
    const li = this.lineOf(i);
    const line = this.lines[li];
    const next = this.lines[li + 1];
    // On a soft-wrapped line, stop before the wrap point so the caret stays on this row.
    if (next && next.start === line.end && line.end > line.start) return line.end - 1;
    return line.end;
  }

  // ---------------------------------------------------------------- layout
  private get lineHeight(): number {
    const t = this.theme;
    return Math.ceil(t.fontSize * t.lineHeight);
  }

  private innerWidth(): number {
    return Math.max(10, this._width - this.theme.paddingX * 2 - this.trailingWidth);
  }

  private innerHeight(): number {
    return this.multiline ? this.rows * this.lineHeight : this.lineHeight;
  }

  protected bodyHeight(): number {
    const t = this.theme;
    return this.multiline ? this.innerHeight() + t.paddingY * 2 : t.controlHeight;
  }

  private displayChars(): string[] {
    const n = this.buf.length;
    if (this.masked) {
      const out = new Array<string>(n).fill(this.obscuringCharacter);
      if (this.revealIndex >= 0 && this.revealIndex < n) out[this.revealIndex] = String.fromCodePoint(this.buf.at(this.revealIndex));
      return out;
    }
    const out = new Array<string>(n);
    for (let i = 0; i < n; i++) out[i] = String.fromCodePoint(this.buf.at(i));
    return out;
  }

  private ensureLayout(): void {
    if (!this.layoutDirty) return;
    this.layoutDirty = false;
    const chars = this.displayChars();
    const font = cssFont(this.theme);
    const m = this.ui.measurer;
    const mk = (start: number, end: number): Line => {
      const slice = chars.slice(start, end);
      return { start, end, text: slice.join(''), widths: m.prefixWidths(slice, font) };
    };
    this.lines = [];
    if (!this.multiline) {
      this.lines.push(mk(0, chars.length));
      return;
    }
    const maxW = this.innerWidth();
    let p = 0;
    for (;;) {
      let pEnd = chars.indexOf('\n', p);
      if (pEnd < 0) pEnd = chars.length;
      let ls = p;
      for (;;) {
        let e = ls;
        let acc = '';
        let lastSpace = -1;
        while (e < pEnd) {
          const ch = chars[e];
          if (ch !== ' ' && e > ls && m.width(acc + ch, font) > maxW) break;
          acc += ch;
          if (ch === ' ') lastSpace = e;
          e++;
        }
        if (e >= pEnd) {
          this.lines.push(mk(ls, pEnd));
          break;
        }
        const brk = lastSpace >= ls ? lastSpace + 1 : e;
        this.lines.push(mk(ls, brk));
        ls = brk;
      }
      if (pEnd >= chars.length) break;
      p = pEnd + 1;
    }
  }

  private lineOf(index: number): number {
    let lo = 0;
    let hi = this.lines.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lines[mid].start <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private caretPos(index: number): { x: number; y: number; line: number } {
    const li = this.lineOf(index);
    const line = this.lines[li];
    const x = line.widths[clamp(index - line.start, 0, line.widths.length - 1)];
    return { x, y: li * this.lineHeight, line: li };
  }

  private indexInLine(li: number, x: number): number {
    const line = this.lines[li];
    const w = line.widths;
    let best = 0;
    for (let j = 1; j < w.length; j++) {
      if (Math.abs(w[j] - x) < Math.abs(w[best] - x)) best = j;
      else if (w[j] > x) break;
    }
    const next = this.lines[li + 1];
    if (next && next.start === line.end && best === w.length - 1 && best > 0) best--;
    return line.start + best;
  }

  private indexAtPoint(x: number, y: number): number {
    this.ensureLayout();
    const li = clamp(Math.floor(y / this.lineHeight), 0, this.lines.length - 1);
    return this.indexInLine(li, x);
  }

  private scrollToCaret(): void {
    this.ensureLayout();
    const { x, y } = this.caretPos(this.caret);
    const iw = this.innerWidth();
    const ih = this.innerHeight();
    if (this.multiline) {
      this.scrollX = 0;
      if (y < this.scrollY) this.scrollY = y;
      if (y + this.lineHeight > this.scrollY + ih) this.scrollY = y + this.lineHeight - ih;
      const maxY = Math.max(0, this.lines.length * this.lineHeight - ih);
      this.scrollY = clamp(this.scrollY, 0, maxY);
    } else {
      const total = this.lines[0].widths[this.lines[0].widths.length - 1];
      if (x - this.scrollX > iw - 2) this.scrollX = x - iw + 2;
      if (x < this.scrollX) this.scrollX = Math.max(0, x - iw * 0.25);
      this.scrollX = clamp(this.scrollX, 0, Math.max(0, total - iw + 2));
      this.scrollY = 0;
    }
  }

  // ---------------------------------------------------------------- change plumbing
  protected contentChanged(emit: boolean): void {
    this.layoutDirty = true;
    this.goalX = null;
    this.blinkElapsed = 0;
    this.scrollToCaret();
    this.redraw();
    if (emit) {
      this.emit('input', this);
      this.commitChange(true);
    }
  }

  private selectionChanged(): void {
    this.blinkElapsed = 0;
    this.scrollToCaret();
    this.drawBody();
  }

  override layout(width: number): void {
    this.layoutDirty = true;
    super.layout(width);
    this.scrollToCaret();
    this.drawBody();
  }

  protected override onFocusChanged(focused: boolean): void {
    if (focused) {
      this.blinkElapsed = 0;
      this.ui.ticker.add(this.tick, this);
    } else {
      this.ui.ticker.remove(this.tick, this);
      this.dragging = false;
      this.anchor = this.caret;
    }
  }

  private tick(ticker: Ticker): void {
    this.blinkElapsed += ticker.deltaMS;
    const [s, e] = this.getSelection();
    const on = s === e && Math.floor(this.blinkElapsed / this.theme.caretBlinkMs) % 2 === 0;
    this.caretGfx.visible = this._focused && on;
  }

  private setHover(v: boolean): void {
    if (this._hovered === v) return;
    this._hovered = v;
    this.drawBody();
  }

  // ---------------------------------------------------------------- pointer
  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this._enabled) return;
    if (e.pointerType === 'touch') {
      // Touch: wait for a tap so scrolling over a field doesn't open the keyboard.
      this.ui.focus.claimed = true;
      return;
    }
    this.claimFocus();
    this.placeFromPointer(e);
  }

  private onTouchTap(e: FederatedPointerEvent): void {
    if (e.pointerType !== 'touch' || !this._enabled || this.ui.focus.gestureMoved) return;
    this.claimFocus();
    this.placeFromPointer(e);
  }

  private placeFromPointer(e: FederatedPointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (this.handleTrailingClick(e)) return;

    const now = performance.now();
    this.clickCount = now - this.lastClickTime < 350 ? this.clickCount + 1 : 1;
    this.lastClickTime = now;

    const p = e.getLocalPosition(this.scroller);
    const idx = this.indexAtPoint(p.x, p.y);
    if (!this.selectable) {
      this.moveCaret(idx, false);
    } else if (this.clickCount === 2) {
      const [a, b] = this.wordAt(idx);
      this.setSelection(a, b);
    } else if (this.clickCount >= 3) {
      this.selectAll();
    } else {
      this.moveCaret(idx, e.shiftKey);
      this.dragging = e.pointerType !== 'touch';
      if (this.dragging) this.ui.focus.pointerCaptured = true;
    }
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (!this.dragging) return;
    const p = e.getLocalPosition(this.scroller);
    this.moveCaret(this.indexAtPoint(p.x, p.y), true);
  }

  private onPointerUp(): void {
    if (this.dragging) this.ui.focus.pointerCaptured = false;
    this.dragging = false;
  }

  /** Lets subclasses handle clicks on the trailing area (returns true if consumed). */
  protected handleTrailingClick(_e: FederatedPointerEvent): boolean {
    return false;
  }

  protected override enabledCursor(): string {
    return 'text';
  }

  // ---------------------------------------------------------------- drawing
  protected override footerMessage(): string {
    return this._helper || (this.showCounter ? ' ' : '');
  }

  override redraw(): void {
    super.redraw();
    if (this.destroyed || !this.counterText) return;
    const t = this.theme;
    this.counterText.visible = this.showCounter;
    if (this.showCounter) {
      const n = this.buf.length;
      this.counterText.text = `${n}/${this.maxLength}`;
      this.counterText.style = this.textStyle('helper', n >= this.maxLength ? t.colors.warning : t.colors.textMuted);
      this.counterText.x = this._width - this.counterText.width;
      this.counterText.y = this.messageText.y;
      this.messageText.style.wordWrapWidth = Math.max(10, this._width - this.counterText.width - 12);
    }
  }

  protected drawBody(): void {
    if (!this.placeholderText) return; // called before subclass init
    const t = this.theme;
    const c = t.colors;
    const w = this._width;
    const h = this.bodyHeight();
    this.ensureLayout();
    this.body.hitArea = new Rectangle(0, 0, w, h);

    const border = !this._enabled
      ? c.border
      : this.hasErrorState
        ? c.error
        : this._focused
          ? c.borderFocus
          : this._hovered
            ? c.borderHover
            : c.border;
    const fill = !this._enabled ? c.surfaceDisabled : this._hovered && !this._focused ? c.surfaceHover : c.surface;
    this.box
      .clear()
      .roundRect(0, 0, w, h, t.radius)
      .fill({ color: fill })
      .stroke({ width: this._focused ? t.borderWidth + 0.5 : t.borderWidth, color: border, alignment: 1 });
    this.drawFocus(0, 0, w, h, t.radius);

    const lh = this.lineHeight;
    const iw = this.innerWidth();
    const ih = this.innerHeight();
    this.textLayer.x = t.paddingX;
    this.textLayer.y = this.multiline ? t.paddingY : Math.round((h - lh) / 2);
    this.clip.clear().rect(-2, -1, iw + 4, ih + 2).fill(0xffffff);
    this.scroller.x = -this.scrollX;
    this.scroller.y = -this.scrollY;

    // placeholder
    const empty = this.buf.length === 0;
    this.placeholderText.visible = empty && !!this.placeholder;
    if (this.placeholderText.visible) {
      this.placeholderText.text = this.placeholder;
      this.placeholderText.style = this.textStyle('body', c.placeholder);
    }

    // lines (only visible ones are rendered)
    const textColor = this._enabled ? c.text : c.textDisabled;
    const first = Math.max(0, Math.floor(this.scrollY / lh));
    const last = Math.min(this.lines.length - 1, Math.ceil((this.scrollY + ih) / lh));
    let used = 0;
    const style = this.textStyle('body', textColor);
    for (let li = first; li <= last; li++) {
      const line = this.lines[li];
      if (!line.text) continue;
      let txt = this.linePool[used];
      if (!txt) {
        txt = new Text({ text: '', style });
        this.linePool.push(txt);
        this.scroller.addChild(txt);
      }
      txt.style = style;
      txt.text = line.text;
      txt.x = 0;
      txt.y = li * lh;
      txt.visible = true;
      used++;
    }
    for (let i = used; i < this.linePool.length; i++) this.linePool[i].visible = false;

    // selection
    const [s, e] = this.getSelection();
    this.selection.clear();
    if (s !== e) {
      const ls = this.lineOf(s);
      const le = this.lineOf(e);
      for (let li = ls; li <= le; li++) {
        const line = this.lines[li];
        const a = Math.max(s, line.start);
        const b = Math.min(e, line.end);
        const x0 = line.widths[a - line.start];
        let x1 = line.widths[b - line.start];
        if (li < le && x1 - x0 < 4) x1 = x0 + 4; // show selected newlines
        this.selection.rect(x0, li * lh, Math.max(1, x1 - x0), lh);
      }
      this.selection.fill({ color: c.selection, alpha: this._focused ? 1 : 0.5 });
    }

    // caret
    const cp = this.caretPos(this.caret);
    const caretH = Math.min(lh, Math.round(t.fontSize * 1.25));
    this.caretGfx
      .clear()
      .rect(Math.round(cp.x), cp.y + (lh - caretH) / 2, t.caretWidth, caretH)
      .fill(c.caret);
    this.caretGfx.visible = this._focused && s === e;
    this.drawTrailing(w, h);
  }

  /** Hook for subclasses to draw in the trailing area. */
  protected drawTrailing(_w: number, _h: number): void {}

  override destroy(options?: Parameters<Control<V>['destroy']>[0]): void {
    this.ui.ticker.remove(this.tick, this);
    super.destroy(options);
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
