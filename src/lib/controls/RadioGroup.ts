import { Container, Graphics, Rectangle, Text, type Ticker } from '../render/canvas';
import { approach } from '../core/anim';
import { Control, type ControlOptions } from '../core/Control';
import type { FormUI } from '../core/FormUI';

export interface Choice<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupOptions<T extends string> extends ControlOptions<T | null> {
  options: Choice<T>[];
  value?: T | null;
  direction?: 'vertical' | 'horizontal';
}

interface Item {
  root: Container;
  ring: Graphics;
  text: Text;
  dot: number;
  x: number;
  y: number;
  w: number;
}

/**
 * Single-choice group. One tab stop; arrow keys move and select (roving focus).
 * Submitted values are always one of the declared option values.
 */
export class RadioGroup<T extends string = string> extends Control<T | null> {
  private readonly options: Choice<T>[];
  private readonly initial: T | null;
  private value: T | null;
  private active = 0;
  private hoverIndex = -1;
  private readonly direction: 'vertical' | 'horizontal';
  private readonly items: Item[] = [];
  private animating = false;
  private height_ = 0;

  constructor(ui: FormUI, opts: RadioGroupOptions<T>) {
    super(ui, opts);
    this.options = opts.options.map((o) => ({ ...o }));
    this.direction = opts.direction ?? 'vertical';
    this.value = this.initial = this.isValid(opts.value) ? opts.value! : null;
    this.active = Math.max(0, this.options.findIndex((o) => o.value === this.value));
    for (let i = 0; i < this.options.length; i++) {
      const root = new Container();
      const ring = new Graphics();
      const text = new Text({ text: '', style: this.textStyle('body') });
      root.addChild(ring, text);
      root.eventMode = 'static';
      root.cursor = this.options[i].disabled ? 'not-allowed' : 'pointer';
      this.bindTap(root, () => this.select(i));
      root.on('pointerover', () => ((this.hoverIndex = i), this.drawBody()));
      root.on('pointerout', () => ((this.hoverIndex = -1), this.drawBody()));
      this.body.addChild(root);
      this.items.push({ root, ring, text, dot: this.options[i].value === this.value ? 1 : 0, x: 0, y: 0, w: 0 });
    }
    this.redraw();
  }

  getValue(): T | null {
    return this.value;
  }

  setValue(v: T | null, emit = true): void {
    if (v !== null && !this.isValid(v)) return; // reject values that are not declared options
    if (v === this.value) return;
    this.value = v;
    const idx = this.options.findIndex((o) => o.value === v);
    if (idx >= 0) this.active = idx;
    this.startAnim();
    this.ui.focus.sync(this);
    this.commitChange(emit);
  }

  isEmpty(): boolean {
    return this.value === null;
  }

  reset(): void {
    this.value = this.initial;
    this.items.forEach((it, i) => (it.dot = this.options[i].value === this.value ? 1 : 0));
    this.touched = false;
    this.setError(null);
    this.redraw();
  }

  private isValid(v: unknown): v is T {
    return this.options.some((o) => o.value === v && !o.disabled);
  }

  private select(i: number): void {
    if (!this._enabled || this.options[i]?.disabled) return;
    this.active = i;
    this.setValue(this.options[i].value);
  }

  override ariaRole(): string {
    return 'radiogroup';
  }

  override ariaLabel(): string {
    const cur = this.options.find((o) => o.value === this.value);
    return `${super.ariaLabel()}${cur ? `, selected ${cur.label}` : ', nothing selected'}`;
  }

  override handleKeyDown(e: KeyboardEvent): boolean {
    const n = this.options.length;
    const step = (dir: number) => {
      for (let k = 1; k <= n; k++) {
        const i = (this.active + dir * k + n) % n;
        if (!this.options[i].disabled) return this.select(i);
      }
    };
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        step(1);
        return true;
      case 'ArrowUp':
      case 'ArrowLeft':
        step(-1);
        return true;
      case ' ':
        this.select(this.active);
        return true;
    }
    return false;
  }

  protected bodyHeight(): number {
    return this.height_;
  }

  private startAnim(): void {
    if (this.animating) return;
    this.animating = true;
    this.ui.ticker.add(this.tick, this);
  }

  private tick(t: Ticker): void {
    let done = true;
    this.items.forEach((it, i) => {
      const target = this.options[i].value === this.value ? 1 : 0;
      it.dot = approach(it.dot, target, this.theme.animationSpeed, t.deltaMS);
      if (it.dot !== target) done = false;
    });
    this.drawBody();
    if (done) {
      this.ui.ticker.remove(this.tick, this);
      this.animating = false;
    }
  }

  override redraw(): void {
    this.measure();
    super.redraw();
  }

  /** Positions the items (wrapping rows in horizontal mode). */
  private measure(): void {
    if (!this.items) return;
    const t = this.theme;
    const s = t.checkboxSize;
    const rowH = Math.max(s, Math.ceil(t.fontSize * t.lineHeight));
    const gapY = 10;
    const gapX = 24;
    let x = 0;
    let y = 0;
    this.items.forEach((it, i) => {
      const o = this.options[i];
      const disabled = !this._enabled || !!o.disabled;
      it.text.text = o.label;
      it.text.style = this.textStyle('body', disabled ? t.colors.textDisabled : t.colors.text);
      it.w = s + 10 + it.text.width;
      if (this.direction === 'horizontal') {
        if (x > 0 && x + it.w > this._width) {
          x = 0;
          y += rowH + gapY;
        }
        it.x = x;
        it.y = y;
        x += it.w + gapX;
      } else {
        it.x = 0;
        it.y = y;
        y += rowH + gapY;
      }
    });
    this.height_ = this.items.length === 0 ? 0 : this.direction === 'horizontal' ? y + rowH : y - gapY;
  }

  protected drawBody(): void {
    if (!this.items) return;
    const t = this.theme;
    const c = t.colors;
    const s = t.checkboxSize;
    const rowH = Math.max(s, Math.ceil(t.fontSize * t.lineHeight));
    this.focusRing.clear();
    this.items.forEach((it, i) => {
      const o = this.options[i];
      const disabled = !this._enabled || !!o.disabled;
      const selected = o.value === this.value;
      it.root.position.set(it.x, it.y);
      it.root.hitArea = new Rectangle(-4, -4, it.w + 8, rowH + 8);
      const cy = rowH / 2;
      const accent = this._error ? c.error : c.primary;
      const border = disabled ? c.border : selected ? accent : this.hoverIndex === i ? c.borderHover : this._error ? c.error : c.border;
      it.ring
        .clear()
        .circle(s / 2, cy, s / 2 - 1)
        .fill(disabled ? c.surfaceDisabled : c.surface)
        .stroke({ width: selected ? 2 : t.borderWidth, color: border });
      if (it.dot > 0.01) it.ring.circle(s / 2, cy, (s / 2 - 5) * it.dot).fill(disabled ? c.textDisabled : accent);
      it.text.position.set(s + 10, (rowH - it.text.height) / 2);
      if (i === this.active && this._focused && this._focusVisible) {
        const o2 = t.focusRingOffset + t.focusRingWidth / 2;
        this.focusRing
          .circle(it.x + s / 2, it.y + cy, s / 2 + o2)
          .stroke({ width: t.focusRingWidth, color: this._error ? c.error : c.focusRing, alpha: 0.85 });
      }
    });
  }

  override destroy(options?: Parameters<Control<T | null>['destroy']>[0]): void {
    this.ui.ticker.remove(this.tick, this);
    super.destroy(options);
  }
}
