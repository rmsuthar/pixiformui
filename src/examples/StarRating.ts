/**
 * Example: building your own control on top of PixiForm.
 *
 * Extending `Control<V>` gives you, for free: label + helper/error text,
 * theming (global + per-instance), focus & Tab order, keyboard routing,
 * screen-reader labels, required/validators, and Form integration.
 *
 * You implement 6 members: getValue, setValue, reset, isEmpty, bodyHeight, drawBody.
 */
import { Graphics, Rectangle } from '../lib/render/canvas';
import { Control, type ControlOptions, type FormUI } from '../lib';

export interface StarRatingOptions extends ControlOptions<number> {
  max?: number;
  value?: number;
}

export class StarRating extends Control<number> {
  private value: number;
  private readonly initial: number;
  private readonly max: number;
  private hover = -1;
  private readonly stars = new Graphics();

  constructor(ui: FormUI, opts: StarRatingOptions) {
    super(ui, opts);
    this.max = Math.max(1, Math.min(10, opts.max ?? 5));
    this.value = this.initial = this.clamp(opts.value ?? 0);
    this.body.addChild(this.stars);
    this.body.eventMode = 'static';
    this.body.cursor = 'pointer';
    // Tap = pointer up without scrolling (works for mouse and touch).
    this.bindTap(this.body, (e) => this.setValue(this.indexAt(e.getLocalPosition(this.body).x) + 1));
    this.body.on('pointermove', (e) => {
      this.hover = this.indexAt(e.getLocalPosition(this.body).x);
      this.drawBody();
    });
    this.body.on('pointerout', () => ((this.hover = -1), this.drawBody()));
    this.redraw(); // always call at the end of your constructor
  }

  // ----- value contract
  getValue(): number {
    return this.value;
  }
  setValue(v: number, emit = true): void {
    const n = this.clamp(v);
    if (n === this.value) return;
    this.value = n;
    this.drawBody();
    this.ui.focus.sync(this); // refresh screen-reader state
    this.commitChange(emit); // emits 'change' + re-validates when appropriate
  }
  reset(): void {
    this.value = this.initial;
    this.touched = false;
    this.setError(null);
    this.redraw();
  }
  isEmpty(): boolean {
    return this.value === 0;
  }

  // ----- accessibility + keyboard
  override ariaRole(): string {
    return 'slider';
  }
  override ariaState(): Record<string, string | null> {
    return { ...super.ariaState(), 'aria-valuemin': '0', 'aria-valuemax': String(this.max), 'aria-valuenow': String(this.value) };
  }
  override handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') return this.setValue(this.value + 1), true;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') return this.setValue(this.value - 1), true;
    if (/^[0-9]$/.test(e.key)) return this.setValue(Number(e.key)), true;
    return false;
  }

  // ----- rendering (use theme tokens so global/per-instance styles apply)
  protected bodyHeight(): number {
    return 36;
  }
  protected drawBody(): void {
    if (!this.stars) return; // base class may call before our fields exist
    const c = this.theme.colors;
    const g = this.stars.clear();
    const size = 28;
    const shown = this.hover >= 0 ? this.hover + 1 : this.value;
    for (let i = 0; i < this.max; i++) {
      starPath(g, i * (size + 8) + size / 2, 18, size / 2);
      g.fill(i < shown ? (this._error ? c.error : c.warning) : c.track);
    }
    const w = this.max * (size + 8) - 8;
    this.drawFocus(-4, 0, w + 8, 36, 8);
    this.body.hitArea = new Rectangle(0, 0, w, 36);
  }

  private indexAt(x: number): number {
    return Math.max(0, Math.min(this.max - 1, Math.floor(x / 36)));
  }
  private clamp(v: number): number {
    return Number.isFinite(v) ? Math.max(0, Math.min(this.max, Math.round(v))) : 0;
  }
}

function starPath(g: Graphics, cx: number, cy: number, r: number): void {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.poly(pts);
}
