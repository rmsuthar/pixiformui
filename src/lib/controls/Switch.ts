import { Graphics, Rectangle, Text, type Ticker } from '../render/canvas';
import { approach } from '../core/anim';
import { Control, type ControlOptions } from '../core/Control';
import type { FormUI } from '../core/FormUI';
import { mix } from '../theme';

export interface SwitchOptions extends ControlOptions<boolean> {
  value?: boolean;
  /** Secondary line under the label. */
  description?: string;
}

/** On/off switch laid out like a list tile: label on the left, switch on the right. */
export class Switch extends Control<boolean> {
  private isOn: boolean;
  private readonly initial: boolean;
  private pos: number;
  private animating = false;
  private readonly track = new Graphics();
  private readonly thumb = new Graphics();
  private readonly title: Text;
  private readonly desc: Text;
  private readonly description: string;

  constructor(ui: FormUI, opts: SwitchOptions) {
    super(ui, opts);
    this.labelAbove = false;
    this.isOn = this.initial = !!opts.value;
    this.pos = this.isOn ? 1 : 0;
    this.description = opts.description ?? '';
    this.title = new Text({ text: '', style: this.textStyle('body') });
    this.desc = new Text({ text: '', style: this.textStyle('helper') });
    this.body.addChild(this.title, this.desc, this.track, this.thumb);
    this.body.eventMode = 'static';
    this.body.cursor = 'pointer';
    this.bindTap(this.body, () => this.toggle());
    this.body.on('pointerover', () => ((this._hovered = true), this.drawBody()));
    this.body.on('pointerout', () => ((this._hovered = false), this.drawBody()));
    this.redraw();
  }

  getValue(): boolean {
    return this.isOn;
  }

  setValue(v: boolean, emit = true): void {
    if (!!v === this.isOn) return;
    this.isOn = !!v;
    this.startAnim();
    this.ui.focus.sync(this);
    this.commitChange(emit);
  }

  toggle(): void {
    if (this._enabled) this.setValue(!this.isOn);
  }

  isEmpty(): boolean {
    return !this.isOn;
  }

  reset(): void {
    this.isOn = this.initial;
    this.pos = this.isOn ? 1 : 0;
    this.touched = false;
    this.setError(null);
    this.redraw();
  }

  override ariaRole(): string {
    return 'switch';
  }

  override ariaState(): Record<string, string | null> {
    return { ...super.ariaState(), 'aria-checked': String(this.isOn) };
  }

  override handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === ' ' || e.key === 'Enter') {
      this.toggle();
      return true;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      this.setValue(e.key === 'ArrowRight');
      return true;
    }
    return false;
  }

  private textWidth(): number {
    return Math.max(20, this._width - this.theme.toggleWidth - 16 - this.infoIconSpace());
  }

  protected bodyHeight(): number {
    if (!this.title) return this.theme.toggleHeight;
    this.title.style.wordWrapWidth = this.textWidth();
    this.desc.style.wordWrapWidth = this.textWidth();
    const th = (this._label ? this.title.height : 0) + (this.description ? this.desc.height + 2 : 0);
    return Math.max(this.theme.toggleHeight, Math.ceil(th));
  }

  private startAnim(): void {
    if (this.animating) return;
    this.animating = true;
    this.ui.ticker.add(this.tick, this);
  }

  private tick(t: Ticker): void {
    const target = this.isOn ? 1 : 0;
    this.pos = approach(this.pos, target, this.theme.animationSpeed, t.deltaMS);
    this.drawBody();
    if (this.pos === target) {
      this.ui.ticker.remove(this.tick, this);
      this.animating = false;
    }
  }

  protected drawBody(): void {
    if (!this.title) return;
    const t = this.theme;
    const c = t.colors;
    const tw = this.textWidth();
    this.title.text = this.required ? `${this._label} *` : this._label;
    this.title.style = this.textStyle('body', this._enabled ? c.text : c.textDisabled, tw);
    this.desc.text = this.description;
    this.desc.style = this.textStyle('helper', this._enabled ? c.textMuted : c.textDisabled, tw);
    this.desc.visible = !!this.description;
    this.desc.y = this._label ? this.title.height + 2 : 0;

    const h = this.bodyHeight();
    const W = t.toggleWidth;
    const H = t.toggleHeight;
    const x = this._width - W;
    const y = Math.round((h - H) / 2);
    const p = this.pos;
    const offColor = this._hovered ? mix(c.track, c.borderHover, 0.35) : c.track;
    const onColor = this._error ? c.error : this._hovered ? c.primaryHover : c.primary;
    const trackColor = this._enabled ? mix(offColor, onColor, p) : c.surfaceDisabled;
    this.track.clear().roundRect(x, y, W, H, H / 2).fill(trackColor);
    if (!this._enabled) this.track.stroke({ width: 1, color: c.border, alignment: 1 });

    const pad = 3;
    const r = H / 2 - pad;
    const cx = x + pad + r + (W - 2 * pad - 2 * r) * p;
    this.thumb
      .clear()
      .circle(cx, y + H / 2 + 1, r)
      .fill({ color: c.shadow, alpha: 0.18 })
      .circle(cx, y + H / 2, r)
      .fill(this._enabled ? c.thumb : c.textDisabled);
    this.drawFocus(x, y, W, H, H / 2);
    const lineH = Math.ceil(t.fontSize * t.lineHeight);
    this.placeInfo(this.body, Math.min(this.title.width, this.textWidth()) + 6, Math.min(lineH, this.title.height || lineH) / 2);
    this.body.hitArea = new Rectangle(0, 0, this._width, h);
  }

  override destroy(options?: Parameters<Control<boolean>['destroy']>[0]): void {
    this.ui.ticker.remove(this.tick, this);
    super.destroy(options);
  }
}
