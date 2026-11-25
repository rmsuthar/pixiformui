import { Graphics, Rectangle, Text, type FederatedPointerEvent, type Ticker } from '../render/canvas';
import { Control, type ControlOptions } from '../core/Control';
import type { FormUI } from '../core/FormUI';
import { Icons } from '../core/icons';

export interface HumanCheckOptions extends Omit<ControlOptions<boolean>, 'validators' | 'validateOn'> {
  /** Shown on the track before the check is solved. */
  prompt?: string;
  /** Wrong releases allowed before a pause (default 3). */
  maxAttempts?: number;
  /** Pause after `maxAttempts` wrong releases, in ms (default 15 000). */
  cooldownMs?: number;
  /** A solved check expires after this long, in ms (default 120 000; 0 = never). */
  expiresMs?: number;
  /**
   * Screen-reader users can't see the mark. With `true` (the default), the accessible value says
   * "at the mark" while the handle is on it during keyboard use, so the check stays usable without
   * sight. Set `false` for a stricter check that keyboard users can still solve visually.
   */
  accessibleHint?: boolean;
}

interface Sample {
  x: number;
  t: number;
}

/** Why a release was refused (for analytics and tests; never shown verbatim). */
export type HumanCheckFailure = 'missed' | 'untrusted' | 'too-fast' | 'robotic' | 'cooldown';

const rand = (): number => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 0x1_0000_0000;
};

/**
 * "Slide to the mark" human check. A mark sits at a random spot on the track (picked with
 * crypto.getRandomValues, drawn only on the canvas, never in the DOM or the accessibility tree);
 * drag the handle and release it on the mark.
 *
 * A release only counts when it is a trusted browser event (not dispatched by page scripts) and the
 * drag looks like a person's: it takes some time, has enough movement samples and an uneven speed.
 * Wrong releases shake the handle, move the mark and, after `maxAttempts`, pause the check.
 *
 * It runs entirely in the browser, so it raises the bar for simple bots and scripts that fill
 * forms through the DOM; it can't stop a bot that posts to your API directly. Pair it with the
 * server-side form proof and timing check (see the guide, "Protecting forms from bots").
 *
 * Value: `true` once solved, else `false`. It is always required, and it isn't included in
 * form.values() / serialize() (a client-side result proves nothing to your server).
 */
export class HumanCheck extends Control<boolean> {
  /** Not sent with the form: a client-side result proves nothing to a server. */
  override readonly submits = false;
  private readonly prompt: string;
  private readonly maxAttempts: number;
  private readonly cooldownMs: number;
  private readonly expiresMs: number;
  private readonly accessibleHint: boolean;
  /** Mark position along the track, 0..1. */
  private target = 0.5;
  /** Handle position along the track, 0..1. */
  private pos = 0;
  private solved = false;
  private dragging = false;
  private grabOffset = 0;
  private samples: Sample[] = [];
  private trusted = true;
  private failures = 0;
  private lockedUntil = 0;
  private keyboardMoves = 0;
  private keyboardStart = 0;
  private shake = 0;
  private ticking = false;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  /** Last refusal reason (diagnostics only). */
  lastFailure: HumanCheckFailure | null = null;
  private readonly track = new Graphics();
  private readonly mark = new Graphics();
  private readonly handle = new Graphics();
  private readonly promptText: Text;

  constructor(ui: FormUI, opts: HumanCheckOptions) {
    super(ui, { label: 'Human check', helperText: 'Drag the handle and release it on the marked spot.', ...opts, required: true, validateOn: 'submit' });
    this.prompt = opts.prompt ?? 'Slide to the mark';
    this.maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
    this.cooldownMs = Math.max(0, opts.cooldownMs ?? 15_000);
    this.expiresMs = Math.max(0, opts.expiresMs ?? 120_000);
    this.accessibleHint = opts.accessibleHint ?? true;
    this.promptText = new Text({ text: '', style: this.textStyle('helper') });
    this.body.addChild(this.track, this.promptText, this.mark, this.handle);
    this.body.eventMode = 'static';
    this.body.on('pointerdown', this.onDown, this);
    this.body.on('globalpointermove', this.onMove, this);
    this.body.on('pointerup', this.onUp, this);
    this.body.on('pointerupoutside', this.onUp, this);
    ui.on('gesturecancel', this.onCancel, this);
    this.newTarget();
    this.redraw();
  }

  // ---------------------------------------------------------------- value
  getValue(): boolean {
    return this.solved;
  }

  /** Only `false` is accepted (clears the check); it can't be solved from code. */
  setValue(v: boolean, emit = true): void {
    if (v || !this.solved) return;
    this.clearSolved();
    this.commitChange(emit);
  }

  isEmpty(): boolean {
    return !this.solved;
  }

  protected override requiredMessage(): string {
    return 'Please complete the human check.';
  }

  reset(): void {
    this.clearSolved();
    this.failures = 0;
    this.lockedUntil = 0;
    this.touched = false;
    this.setError(null);
    this.redraw();
  }

  /** True while paused after too many wrong attempts. */
  get coolingDown(): boolean {
    return Date.now() < this.lockedUntil;
  }

  private clearSolved(): void {
    this.solved = false;
    this.pos = 0;
    this.newTarget();
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    this.redraw();
    this.ui.focus.sync(this);
  }

  private newTarget(): void {
    // Far enough from the start that a single click can't land on it, and away from the end.
    let t = 0.3 + rand() * 0.6;
    if (Math.abs(t - this.target) < 0.12) t = t > 0.6 ? t - 0.2 : t + 0.2;
    this.target = t;
  }

  // ---------------------------------------------------------------- geometry
  private geom() {
    const h = this.bodyHeight();
    const pad = 4;
    const hw = h - pad * 2; // handle is a square inside the track
    const x0 = pad + hw / 2; // handle centre at pos 0
    const x1 = this._width - pad - hw / 2; // handle centre at pos 1
    return { h, pad, hw, x0, x1, span: Math.max(1, x1 - x0) };
  }

  private tolerancePx(): number {
    const { hw } = this.geom();
    return Math.max(6, hw * 0.28);
  }

  private onMark(): boolean {
    const { span } = this.geom();
    return Math.abs(this.pos - this.target) * span <= this.tolerancePx();
  }

  // ---------------------------------------------------------------- pointer
  private onDown(e: FederatedPointerEvent): void {
    this.claimFocus();
    if (!this._enabled || this.solved) return;
    if (this.coolingDown) {
      this.refuse('cooldown');
      return;
    }
    const { x0, span, hw } = this.geom();
    const p = e.getLocalPosition(this.body);
    const hx = x0 + this.pos * span;
    // Must grab the handle itself: clicking on the mark does nothing.
    if (Math.abs(p.x - hx) > hw / 2 + 6) return;
    this.dragging = true;
    this.grabOffset = p.x - hx;
    this.trusted = e.native.isTrusted;
    this.samples = [{ x: p.x, t: e.native.timeStamp }];
    this.ui.focus.pointerCaptured = true;
    this.redraw();
  }

  private onMove(e: FederatedPointerEvent): void {
    if (!this.dragging) return;
    if (!e.native.isTrusted) this.trusted = false;
    const { x0, span } = this.geom();
    const p = e.getLocalPosition(this.body);
    this.pos = Math.min(1, Math.max(0, (p.x - this.grabOffset - x0) / span));
    if (this.samples.length < 400) this.samples.push({ x: p.x, t: e.native.timeStamp });
    this.drawBody();
  }

  private onUp(e: FederatedPointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.ui.focus.pointerCaptured = false;
    if (!e.native.isTrusted) this.trusted = false;
    if (!this.trusted) return this.refuse('untrusted');
    if (!this.onMark()) return this.refuse('missed');
    const verdict = this.judge(this.samples);
    if (verdict) return this.refuse(verdict);
    this.accept();
  }

  private onCancel(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.ui.focus.pointerCaptured = false;
    this.pos = 0;
    this.redraw();
  }

  /**
   * Behaviour checks on a drag; returns a failure reason or null. Uses distance per sample rather
   * than time (automation tools add their own timing jitter): a scripted drag moves in even steps
   * at full speed to the end, while a person's steps vary and slow down when aiming at the mark.
   */
  private judge(s: Sample[]): HumanCheckFailure | null {
    const ms = s[s.length - 1].t - s[0].t;
    if (ms < 250 || s.length < 8) return 'too-fast';
    const d: number[] = [];
    for (let i = 1; i < s.length; i++) {
      const dx = Math.abs(s[i].x - s[i - 1].x);
      if (dx > 0) d.push(dx);
    }
    if (d.length < 6) return 'robotic';
    const mean = d.reduce((a, b) => a + b, 0) / d.length;
    const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length);
    if (sd / mean < 0.15) return 'robotic';
    const tail = d.slice(-Math.max(2, Math.floor(d.length / 4)));
    const tailMean = tail.reduce((a, b) => a + b, 0) / tail.length;
    if (tailMean > 0.9 * Math.max(...d)) return 'robotic';
    return null;
  }

  // ---------------------------------------------------------------- keyboard
  override handleKeyDown(e: KeyboardEvent): boolean {
    if (!this._enabled || this.solved) return false;
    const step = 0.02;
    let dir = 0;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        dir = 1;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        dir = -1;
        break;
      case 'Home':
        this.pos = 0;
        this.keyboardMoves = 0;
        this.redraw();
        this.ui.focus.sync(this);
        return true;
      case 'Enter':
      case ' ':
        this.confirmKeyboard(e);
        return true;
      default:
        return false;
    }
    if (this.coolingDown) {
      this.refuse('cooldown');
      return true;
    }
    if (this.keyboardMoves === 0) this.keyboardStart = performance.now();
    this.keyboardMoves++;
    if (!e.isTrusted) this.trusted = false;
    this.pos = Math.min(1, Math.max(0, this.pos + dir * step));
    this.redraw();
    this.ui.focus.sync(this);
    return true;
  }

  /** The screen-reader "click" on the outline item doesn't solve anything; it just focuses. */
  override activate(): void {
    this.focus();
  }

  private confirmKeyboard(e: KeyboardEvent): void {
    if (this.coolingDown) return this.refuse('cooldown');
    if (this.pos === 0 && this.keyboardMoves === 0) return;
    const trusted = e.isTrusted && this.trusted;
    const ms = performance.now() - this.keyboardStart;
    this.keyboardMoves = 0;
    this.trusted = true;
    if (!trusted) return this.refuse('untrusted');
    if (!this.onMark()) return this.refuse('missed');
    if (ms < 400) return this.refuse('too-fast');
    this.accept();
  }

  // ---------------------------------------------------------------- outcome
  private accept(): void {
    this.solved = true;
    this.failures = 0;
    this.lastFailure = null;
    this.pos = this.target;
    this.setError(null);
    if (this.expiresMs) {
      this.expiryTimer = setTimeout(() => {
        if (!this.solved || this.destroyed) return;
        this.clearSolved();
        this.setError('The check expired. Please slide again.', 'expired');
        this.emit('change', false, this);
      }, this.expiresMs);
    }
    this.redraw();
    this.ui.focus.sync(this);
    this.ui.announcer.announce('Human check complete.');
    this.commitChange(true);
  }

  private refuse(reason: HumanCheckFailure): void {
    this.lastFailure = reason;
    if (reason === 'cooldown') {
      this.setError(`Too many tries. Please wait ${Math.ceil((this.lockedUntil - Date.now()) / 1000)} s.`, 'cooldown');
      return;
    }
    this.failures++;
    this.pos = 0;
    this.newTarget();
    if (this.failures >= this.maxAttempts && this.cooldownMs) {
      this.failures = 0;
      this.lockedUntil = Date.now() + this.cooldownMs;
      this.setError(`Too many tries. Please wait ${Math.ceil(this.cooldownMs / 1000)} s.`, 'cooldown');
      if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
      this.cooldownTimer = setTimeout(() => {
        if (this.destroyed) return;
        if (this._errorCode === 'cooldown') this.setError(null);
        this.redraw();
      }, this.cooldownMs);
    } else {
      // Same message for every reason: don't tell a bot which test it failed.
      this.setError('Not quite. The mark moved; try again.', 'human-check');
    }
    if (!this.ui.reducedMotion) {
      this.shake = 1;
      this.startTicking();
    }
    this.redraw();
    this.ui.focus.sync(this);
  }

  private startTicking(): void {
    if (this.ticking || this.destroyed) return;
    this.ticking = true;
    this.ui.ticker.add(this.tick, this);
  }

  private tick(t: Ticker): void {
    this.shake = Math.max(0, this.shake - t.deltaMS / 450);
    this.body.x = Math.sin(this.shake * 28) * 6 * this.shake;
    if (this.shake === 0) {
      this.body.x = 0;
      this.ui.ticker.remove(this.tick, this);
      this.ticking = false;
    }
  }

  // ---------------------------------------------------------------- accessibility
  override ariaRole(): string {
    return 'slider';
  }

  override ariaState(): Record<string, string | null> {
    const pct = Math.round(this.pos * 100);
    let text = this.solved ? 'Verified' : `${pct}%`;
    if (!this.solved && this.accessibleHint && this.keyboardMoves > 0 && this.onMark()) text = `${pct}%, at the mark. Press Enter to confirm.`;
    return {
      ...super.ariaState(),
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(pct),
      'aria-valuetext': text,
      'aria-readonly': this.solved ? 'true' : null,
    };
  }

  override ariaDescription(): { help?: string; error?: string } {
    const d = super.ariaDescription();
    const kb = this.accessibleHint ? 'With a keyboard, use the arrow keys; you will hear when the handle is at the mark, then press Enter.' : 'With a keyboard, use the arrow keys, then press Enter.';
    return { ...d, help: [d.help, kb].filter(Boolean).join(' ') };
  }

  protected override footerMessage(): string {
    return this.solved ? '' : this._helper;
  }

  // ---------------------------------------------------------------- drawing
  protected bodyHeight(): number {
    return Math.max(44, Math.round(this.theme.fontSize * 2.75));
  }

  protected override enabledCursor(): string {
    return 'grab';
  }

  protected drawBody(): void {
    if (!this.promptText) return;
    const t = this.theme;
    const c = t.colors;
    const { h, pad, hw, x0, span } = this.geom();
    const r = Math.min(t.radius, h / 2);
    const accent = !this._enabled ? c.textDisabled : this.solved ? c.success : this._error ? c.error : c.primary;
    const hx = x0 + this.pos * span;

    this.track.clear().roundRect(0, 0, this._width, h, r).fill(c.track);
    if (this.pos > 0) this.track.roundRect(0, 0, hx + hw / 2 + pad, h, r).fill({ color: accent, alpha: 0.18 });
    this.track.roundRect(0.5, 0.5, this._width - 1, h - 1, r).stroke({ width: 1, color: this.hasErrorState ? c.error : c.border });

    // The mark: a notched slot the size of the handle.
    this.mark.clear();
    if (!this.solved) {
      const mx = x0 + this.target * span;
      const near = this.dragging && this.onMark();
      this.mark
        .roundRect(mx - hw / 2, pad, hw, hw, Math.max(4, r - pad))
        .stroke({ width: 2, color: near ? c.success : c.textMuted, alpha: near ? 1 : 0.8 })
        .moveTo(mx, pad + 4)
        .lineTo(mx, pad + 10)
        .moveTo(mx, pad + hw - 10)
        .lineTo(mx, pad + hw - 4)
        .stroke({ width: 2, color: near ? c.success : c.textMuted, alpha: 0.8 });
    }

    // Prompt text, centred in the larger free stretch of the track (never under the mark).
    this.promptText.text = this.solved ? 'Verified' : this.coolingDown ? 'Please wait…' : this.prompt;
    this.promptText.style = this.textStyle('helper', this.solved ? c.success : this._enabled ? c.textMuted : c.textDisabled);
    const tw = this.promptText.width;
    const left = hx + hw / 2 + 8;
    let px: number;
    let room: number;
    if (this.solved) {
      px = left;
      room = this._width - pad - 8 - left;
    } else {
      const mx = x0 + this.target * span;
      const a = { from: left, to: mx - hw / 2 - 8 };
      const b = { from: mx + hw / 2 + 8, to: this._width - pad - 8 };
      const seg = a.to - a.from >= b.to - b.from ? a : b;
      px = seg.from;
      room = seg.to - seg.from;
    }
    this.promptText.visible = (this.solved || this.pos < 0.05) && room >= tw;
    this.promptText.position.set(Math.round(px + (room - tw) / 2), Math.round((h - this.promptText.height) / 2));

    // Handle.
    const g = this.handle.clear();
    const lift = this.dragging ? 1 : 0;
    g.roundRect(hx - hw / 2, pad + 1 + lift, hw, hw, Math.max(4, r - pad)).fill({ color: c.shadow, alpha: 0.18 });
    g.roundRect(hx - hw / 2, pad - lift, hw, hw, Math.max(4, r - pad)).fill(this.solved ? c.success : accent);
    const s = hw * 0.32;
    if (this.solved) {
      Icons.check(g, hx, h / 2, s * 1.4, c.thumb, 2.4);
    } else {
      g.moveTo(hx - s * 0.6, h / 2 - s * 0.55)
        .lineTo(hx - s * 0.05, h / 2)
        .lineTo(hx - s * 0.6, h / 2 + s * 0.55)
        .moveTo(hx + s * 0.05, h / 2 - s * 0.55)
        .lineTo(hx + s * 0.6, h / 2)
        .lineTo(hx + s * 0.05, h / 2 + s * 0.55)
        .stroke({ width: 2.2, color: c.thumb });
    }
    this.handle.cursor = this.solved ? 'default' : this.dragging ? 'grabbing' : 'grab';
    this.drawFocus(hx - hw / 2, pad, hw, hw, Math.max(4, r - pad));
    this.body.hitArea = new Rectangle(0, 0, this._width, h);
    this.body.cursor = this.solved || !this._enabled ? 'default' : this.dragging ? 'grabbing' : 'grab';
  }

  override destroy(options?: Parameters<Control<boolean>['destroy']>[0]): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
    this.ui.ticker.remove(this.tick, this);
    this.ui.off('gesturecancel', this.onCancel, this);
    super.destroy(options);
  }
}
