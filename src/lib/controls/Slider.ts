import { Graphics, Rectangle, Text, type FederatedPointerEvent } from '../render/canvas';
import { Control, type ControlOptions } from '../core/Control';
import type { FormUI } from '../core/FormUI';

export interface SliderOptions extends ControlOptions<number> {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  format?: (v: number) => string;
  showValue?: boolean;
}

/** Numeric range slider. Values are always clamped and snapped to `step`. */
export class Slider extends Control<number> {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  private value: number;
  private readonly initial: number;
  private readonly format: (v: number) => string;
  private readonly showValue: boolean;
  private dragging = false;
  private readonly track = new Graphics();
  private readonly thumb = new Graphics();
  private readonly valueText: Text;

  constructor(ui: FormUI, opts: SliderOptions) {
    super(ui, opts);
    this.min = Number.isFinite(opts.min) ? opts.min! : 0;
    this.max = Number.isFinite(opts.max) && opts.max! > this.min ? opts.max! : this.min + 100;
    this.step = opts.step && opts.step > 0 ? opts.step : 1;
    this.format = opts.format ?? ((v) => String(v));
    this.showValue = opts.showValue ?? true;
    this.value = this.initial = this.snap(opts.value ?? this.min);
    this.valueText = new Text({ text: '', style: this.textStyle('body') });
    this.body.addChild(this.track, this.thumb, this.valueText);
    this.body.eventMode = 'static';
    this.body.cursor = 'pointer';
    this.body.on('pointerdown', this.onDown, this);
    this.body.on('globalpointermove', this.onMove, this);
    this.body.on('pointerup', this.onUp, this);
    this.body.on('pointerupoutside', this.onUp, this);
    ui.on('gesturecancel', this.onUp, this);
    this.body.on('pointerover', () => ((this._hovered = true), this.drawBody()));
    this.body.on('pointerout', () => ((this._hovered = false), this.drawBody()));
    this.redraw();
  }

  getValue(): number {
    return this.value;
  }

  setValue(v: number, emit = true): void {
    const n = this.snap(v);
    if (n === this.value) return;
    this.value = n;
    this.drawBody();
    this.ui.focus.sync(this);
    this.commitChange(emit);
  }

  isEmpty(): boolean {
    return false;
  }

  reset(): void {
    this.value = this.initial;
    this.touched = false;
    this.setError(null);
    this.redraw();
  }

  private snap(v: number): number {
    if (!Number.isFinite(v)) v = this.min;
    const s = Math.round((v - this.min) / this.step) * this.step + this.min;
    const decimals = (String(this.step).split('.')[1] ?? '').length;
    return Math.min(this.max, Math.max(this.min, Number(s.toFixed(decimals))));
  }

  override ariaRole(): string {
    return 'slider';
  }

  override ariaState(): Record<string, string | null> {
    return {
      ...super.ariaState(),
      'aria-valuemin': String(this.min),
      'aria-valuemax': String(this.max),
      'aria-valuenow': String(this.value),
      'aria-valuetext': this.format(this.value),
    };
  }

  override handleKeyDown(e: KeyboardEvent): boolean {
    const big = Math.max(this.step, (this.max - this.min) / 10);
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        this.setValue(this.value + this.step);
        return true;
      case 'ArrowLeft':
      case 'ArrowDown':
        this.setValue(this.value - this.step);
        return true;
      case 'PageUp':
        this.setValue(this.value + big);
        return true;
      case 'PageDown':
        this.setValue(this.value - big);
        return true;
      case 'Home':
        this.setValue(this.min);
        return true;
      case 'End':
        this.setValue(this.max);
        return true;
    }
    return false;
  }

  private trackGeom() {
    const t = this.theme;
    const valueW = this.showValue ? 56 : 0;
    const x0 = t.sliderThumbSize / 2;
    const x1 = this._width - valueW - t.sliderThumbSize / 2;
    return { x0, x1, cy: this.bodyHeight() / 2 };
  }

  private valueAt(e: FederatedPointerEvent): number {
    const { x0, x1 } = this.trackGeom();
    const p = e.getLocalPosition(this.body);
    const r = Math.min(1, Math.max(0, (p.x - x0) / Math.max(1, x1 - x0)));
    return this.min + r * (this.max - this.min);
  }

  private onDown(e: FederatedPointerEvent): void {
    this.claimFocus();
    if (!this._enabled) return;
    this.dragging = true;
    this.ui.focus.pointerCaptured = true;
    this.setValue(this.valueAt(e));
  }

  private onMove(e: FederatedPointerEvent): void {
    if (this.dragging) this.setValue(this.valueAt(e));
  }

  private onUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.ui.focus.pointerCaptured = false;
    this.drawBody();
  }

  protected bodyHeight(): number {
    return Math.max(this.theme.sliderThumbSize + 8, 32);
  }

  protected drawBody(): void {
    if (!this.valueText) return;
    const t = this.theme;
    const c = t.colors;
    const { x0, x1, cy } = this.trackGeom();
    const r = (this.value - this.min) / (this.max - this.min);
    const tx = x0 + (x1 - x0) * r;
    const th = t.sliderTrackHeight;
    const accent = !this._enabled ? c.textDisabled : this._error ? c.error : c.primary;
    this.track
      .clear()
      .roundRect(x0 - th / 2, cy - th / 2, x1 - x0 + th, th, th / 2)
      .fill(c.track)
      .roundRect(x0 - th / 2, cy - th / 2, tx - x0 + th, th, th / 2)
      .fill(accent);
    const rad = t.sliderThumbSize / 2 + (this.dragging ? 2 : 0);
    this.thumb.clear();
    if ((this._hovered || this.dragging) && this._enabled) this.thumb.circle(tx, cy, rad + 7).fill({ color: accent, alpha: 0.12 });
    this.thumb
      .circle(tx, cy + 1, rad)
      .fill({ color: c.shadow, alpha: 0.2 })
      .circle(tx, cy, rad)
      .fill(c.thumb)
      .stroke({ width: 2, color: accent });
    this.drawFocus(tx - rad, cy - rad, rad * 2, rad * 2, rad);
    this.valueText.visible = this.showValue;
    this.valueText.text = this.format(this.value);
    this.valueText.style = this.textStyle('body', this._enabled ? c.text : c.textDisabled);
    this.valueText.position.set(this._width - this.valueText.width, cy - this.valueText.height / 2);
    this.body.hitArea = new Rectangle(0, 0, this._width, this.bodyHeight());
  }

  override destroy(options?: Parameters<Control<number>['destroy']>[0]): void {
    this.ui.off('gesturecancel', this.onUp, this);
    super.destroy(options);
  }
}
