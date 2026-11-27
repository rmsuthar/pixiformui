import { Graphics, Rectangle, Text, type FederatedPointerEvent, type Ticker } from '../render/canvas';
import { Control, type ControlOptions } from '../core/Control';
import type { FormUI } from '../core/FormUI';
import { mix } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export interface ButtonOptions extends Omit<ControlOptions<null>, 'validators' | 'required'> {
  text: string;
  variant?: ButtonVariant;
  /** Fill the available width (default true). */
  block?: boolean;
  onPress?: () => void | Promise<void>;
}

/**
 * Push button. Emits 'press'. While an async `onPress` runs, the button shows
 * a spinner and ignores further presses (prevents double submits).
 */
export class Button extends Control<null> {
  private readonly bg = new Graphics();
  private readonly spinner = new Graphics();
  private readonly caption: Text;
  private _text: string;
  variant: ButtonVariant;
  private readonly block: boolean;
  private pressed = false;
  private _loading = false;
  private spin = 0;
  onPress?: () => void | Promise<void>;

  constructor(ui: FormUI, opts: ButtonOptions) {
    super(ui, opts);
    this.labelAbove = false;
    this._text = opts.text;
    this.variant = opts.variant ?? 'primary';
    this.block = opts.block ?? true;
    this.onPress = opts.onPress;
    this.caption = new Text({ text: '', style: this.textStyle('body') });
    this.body.addChild(this.bg, this.spinner, this.caption);
    this.body.eventMode = 'static';
    this.body.cursor = 'pointer';
    this.body.on('pointerdown', (e: FederatedPointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this.pressed = true;
      this.drawBody();
    });
    this.bindTap(this.body, () => void this.press());
    this.body.on('pointerup', () => {
      this.pressed = false;
      this.drawBody();
    });
    this.body.on('pointerupoutside', () => ((this.pressed = false), this.drawBody()));
    ui.on('gesturecancel', this.cancelPress, this);
    this.body.on('pointerover', () => ((this._hovered = true), this.drawBody()));
    this.body.on('pointerout', () => ((this._hovered = false), (this.pressed = false), this.drawBody()));
    this.redraw();
  }

  get text(): string {
    return this._text;
  }

  set text(v: string) {
    this._text = v;
    this.redraw();
  }

  get loading(): boolean {
    return this._loading;
  }

  set loading(v: boolean) {
    if (v === this._loading) return;
    this._loading = v;
    if (v) this.ui.ticker.add(this.tick, this);
    else this.ui.ticker.remove(this.tick, this);
    this.ui.focus.sync(this);
    this.drawBody();
  }

  async press(): Promise<void> {
    if (!this._enabled || this._loading) return;
    this.emit('press', this);
    if (!this.onPress) return;
    const r = this.onPress();
    if (r instanceof Promise) {
      this.loading = true;
      try {
        await r;
      } finally {
        this.loading = false;
      }
    }
  }

  getValue(): null {
    return null;
  }
  setValue(): void {}
  reset(): void {}
  isEmpty(): boolean {
    return false;
  }

  override readonly isAction = true;

  override ariaRole(): string {
    return 'button';
  }

  override ariaLabel(): string {
    return this._text;
  }

  override ariaState(): Record<string, string | null> {
    return { ...super.ariaState(), 'aria-busy': this._loading ? 'true' : null };
  }

  override handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Enter' || e.key === ' ') {
      if (!e.repeat) void this.press();
      return true;
    }
    return false;
  }

  protected bodyHeight(): number {
    return this.theme.buttonHeight;
  }

  private cancelPress(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.drawBody();
  }

  private tick(t: Ticker): void {
    this.spin += t.deltaMS / 140;
    this.drawBody();
  }

  protected drawBody(): void {
    if (!this.caption) return;
    const t = this.theme;
    const h = this.bodyHeight();
    this.caption.text = this._text;
    const palette = this.colors();
    this.caption.style = { ...this.textStyle('body', palette.fg), fontWeight: '600' };
    const w = this.block ? this._width : Math.min(this._width, this.caption.width + t.paddingX * 2.5);
    const r = Math.min(t.buttonRadius, h / 2);
    this.bg.clear().roundRect(0, 0, w, h, r).fill(palette.bg);
    if (palette.border !== null) this.bg.stroke({ width: t.borderWidth, color: palette.border, alignment: 1 });
    this.caption.alpha = this._loading ? 0 : 1;
    this.caption.position.set(Math.round((w - this.caption.width) / 2), Math.round((h - this.caption.height) / 2));

    this.spinner.clear();
    if (this._loading) {
      const cx = w / 2;
      const cy = h / 2;
      const rad = 9;
      this.spinner.arc(cx, cy, rad, this.spin, this.spin + Math.PI * 1.4).stroke({ width: 2.5, color: palette.fg, cap: 'round' });
    }
    this.drawFocus(0, 0, w, h, r);
    this.body.hitArea = new Rectangle(0, 0, w, h);
    this.body.cursor = !this._enabled ? 'not-allowed' : this._loading ? 'progress' : 'pointer';
  }

  private colors(): { bg: number; fg: number; border: number | null } {
    const c = this.theme.colors;
    if (!this._enabled) return { bg: c.surfaceDisabled, fg: c.textDisabled, border: c.border };
    const shade = (base: number, hover: number, press: number) =>
      this.pressed ? press : this._hovered ? hover : base;
    switch (this.variant) {
      case 'secondary':
        return { bg: shade(c.secondary, c.secondaryHover, mix(c.secondaryHover, c.text, 0.08)), fg: c.secondaryText, border: null };
      case 'outline':
        return { bg: shade(c.surface, c.surfaceHover, c.secondary), fg: c.text, border: c.border };
      case 'ghost':
        return { bg: shade(c.surface, c.secondary, c.secondaryHover), fg: c.primary, border: null };
      case 'danger':
        return { bg: shade(c.error, mix(c.error, 0x000000, 0.12), mix(c.error, 0x000000, 0.22)), fg: 0xffffff, border: null };
      default:
        return { bg: shade(c.primary, c.primaryHover, c.primaryPressed), fg: c.primaryText, border: null };
    }
  }

  override destroy(options?: Parameters<Control<null>['destroy']>[0]): void {
    this.ui.ticker.remove(this.tick, this);
    this.ui.off('gesturecancel', this.cancelPress, this);
    super.destroy(options);
  }
}
