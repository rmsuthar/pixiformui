import { Container, Graphics, Rectangle, type FederatedPointerEvent, type FederatedWheelEvent, type Ticker } from './render/canvas';
import type { FormUI } from './core/FormUI';
import type { Focusable } from './core/types';

/** Anything that can be laid out at a given width. */
export interface Layoutable extends Container {
  layout?(width: number): void;
  readonly layoutHeight?: number;
}

const heightOf = (c: Layoutable) => (c.layoutHeight !== undefined ? c.layoutHeight : c.height);

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export const insets = (v: number, h = v, b = v, l = h): EdgeInsets => ({ top: v, right: h, bottom: b, left: l });

/** Vertical stack, like Flutter's Column. Re-lays out when children resize. */
export class Column extends Container implements Layoutable {
  private width_ = 0;
  private height_ = 0;
  private laying = false;
  constructor(
    private readonly items: Layoutable[] = [],
    readonly gap = 16,
    readonly padding: EdgeInsets = insets(0),
  ) {
    super();
    for (const it of items) this.attach(it);
  }

  add(...items: Layoutable[]): this {
    for (const it of items) {
      this.items.push(it);
      this.attach(it);
    }
    if (this.width_) this.layout(this.width_);
    return this;
  }

  /** Extra spacing between two items. */
  static spacer(h: number): Layoutable {
    const c = new Container() as Layoutable & { layoutHeight: number };
    Object.defineProperty(c, 'layoutHeight', { value: h });
    return c;
  }

  get layoutHeight(): number {
    return this.height_;
  }

  layout(width: number): void {
    this.width_ = width;
    this.laying = true;
    const inner = width - this.padding.left - this.padding.right;
    let y = this.padding.top;
    let first = true;
    for (const it of this.items) {
      if (!it.visible) continue;
      if (!first) y += this.gap;
      first = false;
      it.layout?.(inner);
      it.position.set(this.padding.left, y);
      y += heightOf(it);
    }
    this.height_ = y + this.padding.bottom;
    this.laying = false;
    this.emit('resize', this);
  }

  private attach(it: Layoutable): void {
    this.addChild(it);
    it.on('resize', () => {
      if (!this.laying && this.width_) this.layout(this.width_);
    });
  }
}

/**
 * Horizontal row with equal-width children. Below `breakpoint` it stacks
 * vertically (responsive, like a LayoutBuilder switch).
 */
export class Row extends Container implements Layoutable {
  private width_ = 0;
  private height_ = 0;
  private laying = false;
  constructor(
    private readonly items: Layoutable[],
    readonly gap = 16,
    readonly breakpoint = 480,
  ) {
    super();
    for (const it of items) {
      this.addChild(it);
      it.on('resize', () => {
        if (!this.laying && this.width_) this.layout(this.width_);
      });
    }
  }

  get layoutHeight(): number {
    return this.height_;
  }

  layout(width: number): void {
    this.width_ = width;
    this.laying = true;
    const stacked = width < this.breakpoint;
    if (stacked) {
      let y = 0;
      this.items.forEach((it, i) => {
        if (i) y += this.gap;
        it.layout?.(width);
        it.position.set(0, y);
        y += heightOf(it);
      });
      this.height_ = y;
    } else {
      const n = this.items.length;
      const w = (width - this.gap * (n - 1)) / n;
      let h = 0;
      this.items.forEach((it, i) => {
        it.layout?.(w);
        it.position.set(i * (w + this.gap), 0);
        h = Math.max(h, heightOf(it));
      });
      this.height_ = h;
    }
    this.laying = false;
    this.emit('resize', this);
  }
}

/**
 * Scrollable viewport (wheel, touch drag with momentum, scrollbar).
 * Keeps the keyboard-focused control in view.
 */
export class ScrollView extends Container {
  readonly content: Layoutable;
  private readonly clip = new Graphics();
  private readonly bar = new Graphics();
  private viewW = 0;
  private viewH = 0;
  private scrollY = 0;
  private velocity = 0;
  private drag: { id: number; startY: number; lastY: number; lastT: number; active: boolean } | null = null;

  constructor(private readonly ui: FormUI, content: Layoutable) {
    super();
    this.content = content;
    this.addChild(this.clip, content, this.bar);
    content.mask = this.clip;
    this.eventMode = 'static';
    this.on('wheel', this.onWheel, this);
    this.on('pointerdown', this.onDown, this);
    this.on('globalpointermove', this.onMove, this);
    this.on('pointerup', this.onUp, this);
    this.on('pointerupoutside', this.onUp, this);
    content.on('resize', () => this.clampScroll());
    ui.on('focuschange', (c: Focusable | null, viaKeyboard: boolean) => {
      if (c && viaKeyboard) this.reveal(c.view);
    });
    ui.ticker.add(this.tick, this);
  }

  setViewport(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
    this.hitArea = new Rectangle(0, 0, w, h);
    this.clip.clear().rect(0, 0, w, h).fill(0xffffff);
    this.content.layout?.(w);
    this.clampScroll();
    // Keep the focused field visible when the viewport shrinks (mobile keyboard).
    const cur = this.ui.focus.current;
    if (cur) this.reveal(cur.view);
  }

  scrollTo(y: number): void {
    this.scrollY = y;
    this.clampScroll();
  }

  /** Scrolls so `target` is fully visible (with margin). */
  reveal(target: Container, margin = 24): void {
    const b = target.getBounds();
    const top = this.toLocal({ x: 0, y: b.y }).y;
    const bottom = top + b.height;
    if (top < margin) this.scrollTo(this.scrollY + top - margin);
    else if (bottom > this.viewH - margin) this.scrollTo(this.scrollY + bottom - this.viewH + margin);
  }

  private maxScroll(): number {
    return Math.max(0, heightOf(this.content) - this.viewH);
  }

  private clampScroll(): void {
    this.scrollY = Math.min(this.maxScroll(), Math.max(0, this.scrollY));
    const y = -Math.round(this.scrollY);
    if (y !== this.content.y) this.ui.emit('scroll', this.scrollY);
    this.content.y = y;
    this.drawBar();
    const cur = this.ui.focus.current;
    if (cur) this.ui.repositionProxy(cur);
  }

  private drawBar(): void {
    this.bar.clear();
    const max = this.maxScroll();
    if (max <= 0) return;
    const total = heightOf(this.content);
    const h = Math.max(32, (this.viewH * this.viewH) / total);
    const y = (this.scrollY / max) * (this.viewH - h);
    this.bar.roundRect(this.viewW - 6, y + 2, 4, h - 4, 2).fill({ color: this.ui.theme.colors.textMuted, alpha: 0.4 });
  }

  private onWheel(e: FederatedWheelEvent): void {
    this.velocity = 0;
    const before = this.scrollY;
    this.scrollTo(this.scrollY + (e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY));
    if (this.scrollY !== before) e.preventDefault();
  }

  private onDown(e: FederatedPointerEvent): void {
    this.velocity = 0;
    if (e.pointerType === 'mouse') return;
    this.drag = { id: e.pointerId, startY: e.global.y, lastY: e.global.y, lastT: performance.now(), active: false };
  }

  private onMove(e: FederatedPointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.id || this.ui.focus.pointerCaptured) return;
    if (!d.active && Math.abs(e.global.y - d.startY) < 8) return;
    d.active = true;
    this.ui.focus.gestureMoved = true;
    const now = performance.now();
    const dy = e.global.y - d.lastY;
    this.velocity = (-dy / Math.max(1, now - d.lastT)) * 16;
    d.lastY = e.global.y;
    d.lastT = now;
    this.scrollTo(this.scrollY - dy);
  }

  private onUp(): void {
    this.drag = null;
  }

  private tick(t: Ticker): void {
    if (this.drag || Math.abs(this.velocity) < 0.1) return;
    this.scrollTo(this.scrollY + this.velocity * (t.deltaMS / 16));
    this.velocity *= Math.pow(0.94, t.deltaMS / 16);
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.ui.ticker.remove(this.tick, this);
    super.destroy(options);
  }
}
