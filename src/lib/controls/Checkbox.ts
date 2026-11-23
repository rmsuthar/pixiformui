import { Graphics, Rectangle, Text, type Ticker } from '../render/canvas';
import { approach } from '../core/anim';
import { Control, type ControlOptions } from '../core/Control';
import type { FormUI } from '../core/FormUI';
import { Icons } from '../core/icons';

export interface CheckboxOptions extends ControlOptions<boolean> {
  checked?: boolean;
  /** Tri-state "mixed" display; cleared on the next toggle. */
  indeterminate?: boolean;
}

/** Checkbox with an inline, wrapping label. Value: boolean. */
export class Checkbox extends Control<boolean> {
  private checked: boolean;
  private readonly initial: boolean;
  private indeterminate: boolean;
  private progress: number;
  private animating = false;
  private readonly box = new Graphics();
  private readonly mark = new Graphics();
  private readonly inlineLabel: Text;

  constructor(ui: FormUI, opts: CheckboxOptions) {
    super(ui, opts);
    this.labelAbove = false;
    this.checked = this.initial = !!opts.checked;
    this.indeterminate = !!opts.indeterminate;
    this.progress = this.checked || this.indeterminate ? 1 : 0;
    this.inlineLabel = new Text({ text: '', style: this.textStyle('body') });
    this.body.addChild(this.box, this.mark, this.inlineLabel);
    this.body.eventMode = 'static';
    this.body.cursor = this._enabled ? 'pointer' : 'not-allowed';
    this.bindTap(this.body, () => this.toggle());
    this.body.on('pointerover', () => this.setHover(true));
    this.body.on('pointerout', () => this.setHover(false));
    this.redraw();
  }

  getValue(): boolean {
    return this.checked;
  }

  setValue(v: boolean, emit = true): void {
    v = !!v;
    if (v === this.checked && !this.indeterminate) return;
    this.checked = v;
    this.indeterminate = false;
    this.animate();
    this.ui.focus.sync(this);
    this.commitChange(emit);
  }

  toggle(): void {
    if (!this._enabled) return;
    this.setValue(!this.checked);
  }

  isEmpty(): boolean {
    return !this.checked;
  }

  reset(): void {
    this.checked = this.initial;
    this.progress = this.checked ? 1 : 0;
    this.touched = false;
    this.setError(null);
    this.redraw();
  }

  override ariaRole(): string {
    return 'checkbox';
  }

  override ariaState(): Record<string, string | null> {
    return { ...super.ariaState(), 'aria-checked': this.indeterminate ? 'mixed' : String(this.checked) };
  }

  override handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === ' ' || e.key === 'Spacebar') {
      this.toggle();
      return true;
    }
    return false;
  }

  protected bodyHeight(): number {
    const t = this.theme;
    return Math.max(t.checkboxSize, this.inlineLabel ? this.labelHeight() : 0);
  }

  private labelHeight(): number {
    if (!this._label) return 0;
    this.inlineLabel.style.wordWrapWidth = this.labelWidth();
    return Math.ceil(this.inlineLabel.height);
  }

  private labelWidth(): number {
    return Math.max(20, this._width - this.theme.checkboxSize - 12 - this.infoIconSpace());
  }

  private setHover(v: boolean): void {
    this._hovered = v;
    this.drawBody();
  }

  private animate(): void {
    if (this.animating) return;
    this.animating = true;
    this.ui.ticker.add(this.tick, this);
  }

  private tick(t: Ticker): void {
    const target = this.checked || this.indeterminate ? 1 : 0;
    this.progress = approach(this.progress, target, this.theme.animationSpeed, t.deltaMS);
    this.drawBody();
    if (this.progress === target) {
      this.ui.ticker.remove(this.tick, this);
      this.animating = false;
    }
  }

  protected drawBody(): void {
    if (!this.inlineLabel) return;
    const t = this.theme;
    const c = t.colors;
    const s = t.checkboxSize;
    const text = this.required ? `${this._label} *` : this._label;
    this.inlineLabel.text = text;
    this.inlineLabel.style = this.textStyle('body', this._enabled ? c.text : c.textDisabled, this.labelWidth());
    const h = this.bodyHeight();
    const lineH = Math.ceil(t.fontSize * t.lineHeight);
    const by = Math.max(0, Math.round((Math.min(h, lineH) - s) / 2));
    this.inlineLabel.position.set(s + 12, 0);

    const on = this.checked || this.indeterminate;
    const p = this.progress;
    const accent = this._error ? c.error : c.primary;
    const border = !this._enabled ? c.border : this._error ? c.error : this._hovered ? c.borderHover : c.border;
    this.box.clear().roundRect(0, by, s, s, Math.min(6, t.radius / 2));
    if (!this._enabled) this.box.fill(on ? c.textDisabled : c.surfaceDisabled);
    else this.box.fill(on ? accent : c.surface);
    if (!on) this.box.stroke({ width: t.borderWidth, color: border, alignment: 1 });
    if (on && this._enabled && this._hovered) this.box.roundRect(0, by, s, s, Math.min(6, t.radius / 2)).fill({ color: 0x000000, alpha: 0.08 });

    this.mark.clear();
    if (this.indeterminate) Icons.dash(this.mark, s / 2, by + s / 2, s, c.primaryText);
    else if (p > 0.01) Icons.check(this.mark, s / 2, by + s / 2, s, c.primaryText, 2.2, p);
    this.mark.alpha = Math.min(1, p * 1.5);

    this.drawFocus(0, by, s, s, Math.min(6, t.radius / 2));
    this.placeInfo(this.body, this.inlineLabel.x + this.inlineLabel.width + 6, by + s / 2);
    this.body.hitArea = new Rectangle(-4, -4, Math.min(this._width, s + 16 + this.inlineLabel.width + this.infoIconSpace()) + 8, h + 8);
  }

  override destroy(options?: Parameters<Control<boolean>['destroy']>[0]): void {
    this.ui.ticker.remove(this.tick, this);
    super.destroy(options);
  }
}
