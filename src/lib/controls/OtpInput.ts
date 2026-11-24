import { Container, Graphics, Rectangle, Text, type FederatedPointerEvent, type Ticker } from '../render/canvas';
import { Control, type ControlOptions } from '../core/Control';
import type { FormUI } from '../core/FormUI';
import { SecureBuffer, toCodePoints } from '../security/SecureBuffer';
import { sanitizeInput } from '../security/sanitize';

export interface OtpInputOptions extends ControlOptions<string> {
  /** Number of digits, 4–10. Default 6. */
  length?: number;
  /** Visually group boxes, e.g. 3 -> "123 – 456". 0 = no grouping. Default 0. */
  groupSize?: number;
  /** Show • instead of digits. Default false. */
  obscure?: boolean;
  /** Emit 'submit' (so a Form submits) as soon as every box is filled. Default false. */
  autoSubmit?: boolean;
  /**
   * Android Chrome: read the code from an incoming SMS via the WebOTP API.
   * The SMS must end with "@your.domain #123456". Default false.
   */
  webOtp?: boolean;
  /** Initial value (digits only). */
  value?: string;
}

const DIGIT = /[0-9]/;

/**
 * One-time-code input: N digit boxes with a caret, paste/autofill support and
 * numeric keyboards on mobile.
 *
 * Security: digits live in a wipeable SecureBuffer; copy/cut are blocked; the
 * value is wiped by `Form.wipeSecrets()` after submit (`sensitive`); input is
 * sanitised and NFKC-normalised (full-width digits become ASCII).
 *
 * Events: 'change' (value), 'complete' (value) when all boxes are filled,
 * 'submit' on Enter (or on completion with `autoSubmit`).
 */
export class OtpInput extends Control<string> {
  override readonly acceptsText = true;
  override readonly sensitive = true;
  override readonly inputMode = 'numeric' as const;
  override readonly enterKeyHint = 'done' as const;
  override readonly autocomplete = 'one-time-code' as const;

  readonly length: number;
  readonly groupSize: number;
  obscure: boolean;
  autoSubmit: boolean;

  private readonly buf = new SecureBuffer(16);
  private caret = 0;
  private readonly initial: string;
  private readonly webOtp: boolean;
  private webOtpAbort: AbortController | null = null;

  private readonly boxes = new Graphics();
  private readonly separators = new Graphics();
  private readonly caretGfx = new Graphics();
  private readonly digitLayer = new Container();
  private readonly digits: Text[] = [];
  private boxRects: { x: number; w: number }[] = [];
  private blink = 0;
  private shake = 0;
  private hoverIndex = -1;
  private ticking = false;

  constructor(ui: FormUI, opts: OtpInputOptions) {
    super(ui, opts);
    this.length = Math.max(4, Math.min(10, Math.round(opts.length ?? 6)));
    this.groupSize = Math.max(0, Math.min(this.length - 1, Math.round(opts.groupSize ?? 0)));
    this.obscure = !!opts.obscure;
    this.autoSubmit = !!opts.autoSubmit;
    this.webOtp = !!opts.webOtp;
    this.initial = this.clean(opts.value ?? '', this.length);
    if (this.initial) this.buf.set(toCodePoints(this.initial));
    this.caret = this.buf.length;

    this.validators.unshift((v) =>
      v.length > 0 && v.length < this.length ? `Enter all ${this.length} digits.` : null,
    );

    for (let i = 0; i < this.length; i++) {
      const t = new Text({ text: '', style: this.textStyle('body') });
      t.anchor.set(0.5);
      this.digits.push(t);
      this.digitLayer.addChild(t);
    }
    this.body.addChild(this.boxes, this.separators, this.digitLayer, this.caretGfx);
    this.body.eventMode = 'static';
    this.body.cursor = 'text';
    this.bindTap(this.body, (e) => this.placeCaret(e));
    this.body.on('pointermove', (e: FederatedPointerEvent) => {
      const i = this.boxAt(e.getLocalPosition(this.body).x);
      if (i !== this.hoverIndex) {
        this.hoverIndex = i;
        this.drawBody();
      }
    });
    this.body.on('pointerout', () => {
      this.hoverIndex = -1;
      this.drawBody();
    });
    this.redraw();
  }

  // ------------------------------------------------------------------ value
  getValue(): string {
    return this.buf.toString();
  }

  setValue(value: string, emit = true): void {
    const digits = this.clean(String(value ?? ''), this.length);
    this.buf.set(toCodePoints(digits));
    this.caret = this.buf.length;
    this.changed(emit);
  }

  isEmpty(): boolean {
    return this.buf.length === 0;
  }

  get isComplete(): boolean {
    return this.buf.length === this.length;
  }

  reset(): void {
    this.buf.set(toCodePoints(this.initial));
    this.caret = this.buf.length;
    this.touched = false;
    this.setError(null);
    this.redraw();
  }

  clear(): void {
    this.setValue('');
  }

  override wipe(): void {
    this.buf.wipe();
    this.caret = 0;
  }

  /** Errors trigger a short shake, like most OTP UIs. */
  override setError(message: string | null, code?: string): void {
    const had = this.error;
    super.setError(message, code);
    if (message && message !== had && !this.ui.reducedMotion) {
      this.shake = 1;
      this.startTicking();
    }
  }

  private clean(text: string, max: number): string {
    return sanitizeInput(text, { allow: DIGIT, normalize: 'NFKC', maxCodePoints: max });
  }

  private changed(emit: boolean): void {
    this.blink = 0;
    this.redraw();
    this.ui.focus.sync(this);
    if (!emit) return;
    this.commitChange(true);
    if (this.isComplete) {
      this.emit('complete', this.getValue(), this);
      if (this.autoSubmit) this.emit('submit', this);
    }
  }

  // ------------------------------------------------------------------ editing
  /** Typing overwrites at the caret; multi-digit input (paste/SMS autofill) fills forward. */
  override handleText(text: string): void {
    if (text === '\n') {
      this.emit('submit', this);
      return;
    }
    if (!this._enabled) return;
    const digits = this.clean(text, 64);
    if (!digits) {
      this.ui.announcer.announce('Digits only');
      if (!this.ui.reducedMotion) this.shake = 0.6;
      this.startTicking();
      return;
    }
    // A full code (paste / autofill) always replaces everything.
    let pos = digits.length >= this.length ? 0 : Math.min(this.caret, this.buf.length);
    if (pos >= this.length) {
      this.ui.announcer.announce('Code is complete. Use Backspace to change it.');
      return;
    }
    if (pos === 0 && digits.length >= this.length) this.buf.wipe();
    for (const ch of digits) {
      if (pos >= this.length) break;
      if (pos < this.buf.length) this.buf.delete(pos, pos + 1);
      this.buf.insert(pos, [ch.codePointAt(0)!]);
      pos++;
    }
    this.caret = Math.min(pos, this.length);
    this.changed(true);
  }

  override handlePaste(text: string): void {
    this.handleText(text);
  }

  override handleCopy(): string | null {
    this.ui.announcer.announce('Copying is disabled for this field.');
    return null;
  }

  override handleDelete(direction: 'backward' | 'forward'): void {
    if (!this._enabled) return;
    if (direction === 'backward') {
      if (this.caret === 0) return;
      this.buf.delete(this.caret - 1, this.caret);
      this.caret--;
    } else {
      if (this.caret >= this.buf.length) return;
      this.buf.delete(this.caret, this.caret + 1);
    }
    this.changed(true);
  }

  override handleKeyDown(e: KeyboardEvent): boolean {
    const mod = e.ctrlKey || e.metaKey || e.altKey;
    switch (e.key) {
      case 'ArrowLeft':
        this.moveCaret(mod ? 0 : this.caret - 1);
        return true;
      case 'ArrowRight':
        this.moveCaret(mod ? this.buf.length : this.caret + 1);
        return true;
      case 'Home':
        this.moveCaret(0);
        return true;
      case 'End':
        this.moveCaret(this.buf.length);
        return true;
      case 'Backspace':
        if (mod) {
          this.buf.delete(0, this.caret);
          this.caret = 0;
          this.changed(true);
        } else this.handleDelete('backward');
        return true;
      case 'Delete':
        this.handleDelete('forward');
        return true;
      case 'Enter':
        this.emit('submit', this);
        return true;
      case 'Escape':
        if (!this.isEmpty()) {
          this.clear();
          return true;
        }
        return false;
    }
    return false;
  }

  /** The caret sits on a filled box (overwrite) or the first empty one; `length` = past the end. */
  private moveCaret(i: number): void {
    this.caret = Math.max(0, Math.min(i, this.buf.length));
    this.blink = 0;
    this.drawBody();
  }

  private placeCaret(e: FederatedPointerEvent): void {
    const i = this.boxAt(e.getLocalPosition(this.body).x);
    this.moveCaret(i < 0 ? this.buf.length : Math.min(i, this.buf.length));
  }

  private boxAt(x: number): number {
    for (let i = 0; i < this.boxRects.length; i++) {
      const r = this.boxRects[i];
      if (x >= r.x - 4 && x <= r.x + r.w + 4) return i;
    }
    return -1;
  }

  // ------------------------------------------------------------------ a11y
  override ariaLabel(): string {
    const base = super.ariaLabel();
    return `${base}, ${this.length}-digit code, ${this.buf.length} entered`;
  }

  // ------------------------------------------------------------------ focus, WebOTP, animation
  protected override onFocusChanged(focused: boolean): void {
    if (focused) {
      if (this.caret > this.buf.length) this.caret = this.buf.length;
      this.blink = 0;
      this.startTicking();
      this.startWebOtp();
    } else {
      this.webOtpAbort?.abort();
      this.webOtpAbort = null;
    }
  }

  private startWebOtp(): void {
    if (!this.webOtp || this.webOtpAbort || !('OTPCredential' in window)) return;
    const ac = new AbortController();
    this.webOtpAbort = ac;
    (navigator.credentials.get as (o: unknown) => Promise<{ code?: string } | null>)({
      otp: { transport: ['sms'] },
      signal: ac.signal,
    })
      .then((cred) => {
        if (cred?.code && !ac.signal.aborted) this.handleText(cred.code);
      })
      .catch(() => {})
      .finally(() => {
        if (this.webOtpAbort === ac) this.webOtpAbort = null;
      });
  }

  private startTicking(): void {
    if (this.ticking || this.destroyed) return;
    this.ticking = true;
    this.ui.ticker.add(this.tick, this);
  }

  private tick(t: Ticker): void {
    this.blink += t.deltaMS;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - t.deltaMS / 450);
      this.body.x = Math.sin(this.shake * 28) * 7 * this.shake;
    } else {
      this.body.x = 0;
    }
    const caretOn = this._focused && !this.isComplete && Math.floor(this.blink / this.theme.caretBlinkMs) % 2 === 0;
    this.caretGfx.visible = caretOn;
    if (!this._focused && this.shake === 0) {
      this.ui.ticker.remove(this.tick, this);
      this.ticking = false;
      this.caretGfx.visible = false;
    }
  }

  // ------------------------------------------------------------------ layout & drawing
  private geometry(): { boxW: number; gap: number; sepW: number; boxH: number } {
    const t = this.theme;
    const gap = this._width < 360 ? 6 : 10;
    const groups = this.groupSize > 0 ? Math.ceil(this.length / this.groupSize) - 1 : 0;
    const sepW = groups > 0 ? 18 : 0;
    const avail = this._width - gap * (this.length - 1 - groups) - (gap * 2 + sepW) * groups;
    const boxW = Math.max(28, Math.min(56, Math.floor(avail / this.length)));
    const boxH = Math.round(Math.max(t.controlHeight + 8, Math.min(64, boxW * 1.2)));
    return { boxW, gap, sepW, boxH };
  }

  protected bodyHeight(): number {
    return this.geometry().boxH;
  }

  protected drawBody(): void {
    if (!this.digits || this.digits.length !== this.length) return;
    const t = this.theme;
    const c = t.colors;
    const { boxW, gap, sepW, boxH } = this.geometry();
    const value = this.getValue();
    const active = Math.min(this.caret, this.length - 1);

    this.boxes.clear();
    this.separators.clear();
    this.boxRects = [];
    let x = 0;
    for (let i = 0; i < this.length; i++) {
      if (i > 0) {
        const groupBreak = this.groupSize > 0 && i % this.groupSize === 0;
        if (groupBreak) {
          x += gap;
          this.separators
            .roundRect(x + (sepW - 10) / 2, boxH / 2 - 1, 10, 2, 1)
            .fill(this._enabled ? c.textMuted : c.textDisabled);
          x += sepW + gap;
        } else {
          x += gap;
        }
      }
      this.boxRects.push({ x, w: boxW });
      const filled = i < value.length;
      const isActive = this._focused && i === active && !(this.isComplete && this.caret >= this.length);
      const border = !this._enabled
        ? c.border
        : this._error
          ? c.error
          : isActive
            ? c.borderFocus
            : this.hoverIndex === i
              ? c.borderHover
              : filled
                ? c.borderHover
                : c.border;
      const fill = !this._enabled ? c.surfaceDisabled : filled ? c.surface : this.hoverIndex === i ? c.surfaceHover : c.surface;
      this.boxes
        .roundRect(x, 0, boxW, boxH, t.radius)
        .fill(fill)
        .stroke({ width: isActive ? t.borderWidth + 1 : t.borderWidth, color: border, alignment: 1 });

      const txt = this.digits[i];
      txt.text = filled ? (this.obscure ? '•' : value[i]) : '';
      txt.style = {
        ...this.textStyle('body', this._enabled ? c.text : c.textDisabled),
        fontSize: Math.round(Math.min(boxW * 0.55, t.fontSize * 1.7)),
        fontWeight: '600',
        lineHeight: undefined,
      };
      txt.position.set(x + boxW / 2, boxH / 2);
      x += boxW;
    }

    // caret in the active (empty) box
    const r = this.boxRects[active];
    const caretH = Math.round(boxH * 0.45);
    this.caretGfx.clear();
    if (r && active >= value.length) {
      this.caretGfx.rect(r.x + r.w / 2 - t.caretWidth / 2, (boxH - caretH) / 2, t.caretWidth + 0.5, caretH).fill(c.caret);
    }
    this.caretGfx.visible = this._focused && !this.isComplete;

    // focus ring around the whole group (keyboard focus)
    const total = x;
    this.drawFocus(0, 0, total, boxH, t.radius);
    this.body.hitArea = new Rectangle(-4, -4, total + 8, boxH + 8);
  }

  override destroy(options?: Parameters<Control<string>['destroy']>[0]): void {
    this.webOtpAbort?.abort();
    this.ui.ticker.remove(this.tick, this);
    super.destroy(options);
  }
}
