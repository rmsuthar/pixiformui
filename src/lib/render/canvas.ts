/**
 * PixiForm's renderer: a small retained-mode scene graph on the browser's
 * built-in Canvas 2D API. No WebGL, no workers, no eval, no dependencies.
 *
 * It offers exactly what the controls need: Container, Graphics, Text,
 * pointer events with bubbling, and an Application that owns the canvas.
 * Custom controls are built from the same primitives.
 *
 * Scope: translation-only transforms (PixiForm never scales or rotates),
 * retained Graphics paths, plain-text Text with word wrap, scene-graph
 * pointer events (bubbling, tap, up-outside, over/out, global move,
 * wheel), masks via clipping, and render-on-demand (no 60fps loop when idle).
 */

// ------------------------------------------------------------------ EventEmitter
type Listener = { fn: (...args: any[]) => void; ctx: unknown; once: boolean };

export class EventEmitter {
  private _events = new Map<string | symbol, Listener[]>();

  on(event: string | symbol, fn: (...args: any[]) => void, ctx?: unknown): this {
    const list = this._events.get(event) ?? [];
    list.push({ fn, ctx, once: false });
    this._events.set(event, list);
    return this;
  }

  once(event: string | symbol, fn: (...args: any[]) => void, ctx?: unknown): this {
    this.on(event, fn, ctx);
    const list = this._events.get(event)!;
    list[list.length - 1].once = true;
    return this;
  }

  off(event: string | symbol, fn?: (...args: any[]) => void, ctx?: unknown): this {
    const list = this._events.get(event);
    if (!list) return this;
    const keep = list.filter((l) => (fn && l.fn !== fn) || (ctx !== undefined && l.ctx !== ctx));
    if (keep.length) this._events.set(event, keep);
    else this._events.delete(event);
    return this;
  }

  emit(event: string | symbol, ...args: any[]): boolean {
    const list = this._events.get(event);
    if (!list?.length) return false;
    for (const l of [...list]) {
      if (l.once) this.off(event, l.fn, l.ctx);
      l.fn.apply(l.ctx, args);
    }
    return true;
  }

  listenerCount(event: string | symbol): number {
    return this._events.get(event)?.length ?? 0;
  }

  removeAllListeners(event?: string | symbol): this {
    if (event === undefined) this._events.clear();
    else this._events.delete(event);
    return this;
  }
}

// ------------------------------------------------------------------ render scheduling
/** Root stage -> app, so every change re-renders only the canvas it belongs to. */
const appsByStage = new WeakMap<object, Application>();
function invalidate(node: { parent?: unknown } | null): void {
  let n: any = node;
  while (n && n.parent) n = n.parent;
  if (n) appsByStage.get(n)?.requestRender();
}

// ------------------------------------------------------------------ geometry
export class Rectangle {
  constructor(
    public x = 0,
    public y = 0,
    public width = 0,
    public height = 0,
  ) {}
  contains(px: number, py: number): boolean {
    return px >= this.x && py >= this.y && px < this.x + this.width && py < this.y + this.height;
  }
}

export class Circle {
  constructor(
    public x = 0,
    public y = 0,
    public radius = 0,
  ) {}
  contains(px: number, py: number): boolean {
    return (px - this.x) ** 2 + (py - this.y) ** 2 <= this.radius ** 2;
  }
}

class ObservablePoint {
  constructor(
    private readonly owner: { onChange(): void },
    private _x = 0,
    private _y = 0,
  ) {}
  get x() {
    return this._x;
  }
  set x(v: number) {
    if (v !== this._x) ((this._x = v), this.owner.onChange());
  }
  get y() {
    return this._y;
  }
  set y(v: number) {
    if (v !== this._y) ((this._y = v), this.owner.onChange());
  }
  set(x: number, y = x): void {
    if (x === this._x && y === this._y) return;
    this._x = x;
    this._y = y;
    this.owner.onChange();
  }
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ------------------------------------------------------------------ Container
export type EventMode = 'none' | 'passive' | 'auto' | 'static' | 'dynamic';

export class Container extends EventEmitter {
  children: Container[] = [];
  parent: Container | null = null;
  label = '';
  eventMode: EventMode = 'passive';
  cursor: string | undefined;
  hitArea: { contains(x: number, y: number): boolean } | null = null;
  renderable = true;
  destroyed = false;
  readonly position = new ObservablePoint(this);
  private _visible = true;
  private _alpha = 1;
  private _mask: Container | null = null;
  /** @internal */ _isMask = false;

  onChange(): void {
    invalidate(this);
  }

  get x(): number {
    return this.position.x;
  }
  set x(v: number) {
    this.position.x = v;
  }
  get y(): number {
    return this.position.y;
  }
  set y(v: number) {
    this.position.y = v;
  }
  get visible(): boolean {
    return this._visible;
  }
  set visible(v: boolean) {
    if (v !== this._visible) ((this._visible = v), invalidate(this));
  }
  get alpha(): number {
    return this._alpha;
  }
  set alpha(v: number) {
    if (v !== this._alpha) ((this._alpha = v), invalidate(this));
  }
  get mask(): Container | null {
    return this._mask;
  }
  set mask(m: Container | null) {
    if (this._mask) this._mask._isMask = false;
    this._mask = m;
    if (m) m._isMask = true;
    invalidate(this);
  }

  get width(): number {
    return this.getLocalBounds().width;
  }
  get height(): number {
    return this.getLocalBounds().height;
  }

  addChild<T extends Container[]>(...items: T): T[0] {
    for (const c of items) this.addChildAt(c, this.children.length);
    return items[0];
  }

  addChildAt<T extends Container>(child: T, index: number): T {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.splice(Math.max(0, Math.min(index, this.children.length)), 0, child);
    invalidate(this);
    return child;
  }

  removeChild<T extends Container>(child: T): T {
    const i = this.children.indexOf(child);
    if (i >= 0) {
      this.children.splice(i, 1);
      child.parent = null;
      invalidate(this);
    }
    return child;
  }

  removeChildren(): Container[] {
    const removed = this.children;
    for (const c of removed) c.parent = null;
    this.children = [];
    invalidate(this);
    return removed;
  }

  /** World offset (translation only). */
  worldPosition(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (let n: Container | null = this; n; n = n.parent) {
      x += n.position.x;
      y += n.position.y;
    }
    return { x, y };
  }

  toLocal(p: { x: number; y: number }): { x: number; y: number } {
    const w = this.worldPosition();
    return { x: p.x - w.x, y: p.y - w.y };
  }

  toGlobal(p: { x: number; y: number }): { x: number; y: number } {
    const w = this.worldPosition();
    return { x: p.x + w.x, y: p.y + w.y };
  }

  getGlobalPosition(): { x: number; y: number } {
    return this.worldPosition();
  }

  /** Own content bounds in local coordinates (overridden by Graphics/Text). */
  protected ownBounds(): Bounds | null {
    return null;
  }

  getLocalBounds(): Bounds {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const add = (b: Bounds | null, ox: number, oy: number) => {
      if (!b || (b.width === 0 && b.height === 0)) return;
      minX = Math.min(minX, b.x + ox);
      minY = Math.min(minY, b.y + oy);
      maxX = Math.max(maxX, b.x + ox + b.width);
      maxY = Math.max(maxY, b.y + oy + b.height);
    };
    add(this.ownBounds(), 0, 0);
    for (const c of this.children) {
      if (!c.visible || c._isMask) continue;
      add(c.getLocalBounds(), c.position.x, c.position.y);
    }
    return minX === Infinity ? { x: 0, y: 0, width: 0, height: 0 } : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  getBounds(): Bounds {
    const b = this.getLocalBounds();
    const w = this.worldPosition();
    return { x: b.x + w.x, y: b.y + w.y, width: b.width, height: b.height };
  }

  /** @internal draw own content at the current transform. */
  _draw(_ctx: CanvasRenderingContext2D): void {}

  /** @internal hit-test own content (local coords). */
  _hitSelf(x: number, y: number): boolean {
    const b = this.ownBounds();
    return !!b && x >= b.x && y >= b.y && x < b.x + b.width && y < b.y + b.height;
  }

  destroy(options?: boolean | { children?: boolean }): void {
    if (this.destroyed) return;
    const deep = options === true || (typeof options === 'object' && options?.children);
    invalidate(this);
    this.parent?.removeChild(this);
    if (deep) for (const c of [...this.children]) c.destroy(options);
    this.children = [];
    this.removeAllListeners();
    this.destroyed = true;
  }
}

// ------------------------------------------------------------------ Graphics
type FillInput = number | { color?: number; alpha?: number };
interface StrokeInput {
  width?: number;
  color?: number;
  alpha?: number;
  alignment?: number;
  cap?: CanvasLineCap;
  join?: CanvasLineJoin;
}
type Op =
  | { kind: 'path'; path: Path2D; closed: boolean }
  | { kind: 'fill'; color: number; alpha: number; path: Path2D }
  | { kind: 'stroke'; style: Required<Omit<StrokeInput, 'cap' | 'join'>> & { cap: CanvasLineCap; join: CanvasLineJoin }; path: Path2D; closed: boolean };

const css = (c: number) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;

export class Graphics extends Container {
  private ops: Op[] = [];
  private path = new Path2D();
  private pathClosed = true;
  private consumed = false;
  private b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  private grow(x: number, y: number, pad = 0): void {
    this.b.minX = Math.min(this.b.minX, x - pad);
    this.b.minY = Math.min(this.b.minY, y - pad);
    this.b.maxX = Math.max(this.b.maxX, x + pad);
    this.b.maxY = Math.max(this.b.maxY, y + pad);
  }

  private shape(closed: boolean): Path2D {
    if (this.consumed) {
      this.path = new Path2D();
      this.pathClosed = true;
      this.consumed = false;
    }
    if (!closed) this.pathClosed = false;
    invalidate(this);
    return this.path;
  }

  clear(): this {
    this.ops = [];
    this.path = new Path2D();
    this.pathClosed = true;
    this.consumed = false;
    this.b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    invalidate(this);
    return this;
  }

  rect(x: number, y: number, w: number, h: number): this {
    this.shape(true).rect(x, y, w, h);
    this.grow(x, y);
    this.grow(x + w, y + h);
    return this;
  }

  roundRect(x: number, y: number, w: number, h: number, r = 0): this {
    const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    this.shape(true).roundRect(x, y, w, h, rr);
    this.grow(x, y);
    this.grow(x + w, y + h);
    return this;
  }

  circle(x: number, y: number, r: number): this {
    const p = this.shape(true);
    p.moveTo(x + r, y);
    p.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    p.closePath();
    this.grow(x, y, r);
    return this;
  }

  poly(points: number[]): this {
    const p = this.shape(true);
    for (let i = 0; i < points.length; i += 2) {
      if (i === 0) p.moveTo(points[0], points[1]);
      else p.lineTo(points[i], points[i + 1]);
      this.grow(points[i], points[i + 1]);
    }
    p.closePath();
    return this;
  }

  moveTo(x: number, y: number): this {
    this.shape(false).moveTo(x, y);
    this.grow(x, y);
    return this;
  }

  lineTo(x: number, y: number): this {
    this.shape(false).lineTo(x, y);
    this.grow(x, y);
    return this;
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): this {
    this.shape(false).quadraticCurveTo(cpx, cpy, x, y);
    this.grow(cpx, cpy);
    this.grow(x, y);
    return this;
  }

  arc(cx: number, cy: number, r: number, start: number, end: number, anticlockwise = false): this {
    this.shape(false).arc(cx, cy, r, start, end, anticlockwise);
    this.grow(cx, cy, r);
    return this;
  }

  closePath(): this {
    this.path.closePath();
    return this;
  }

  fill(input: FillInput = 0x000000): this {
    const color = typeof input === 'number' ? input : (input.color ?? 0x000000);
    const alpha = typeof input === 'number' ? 1 : (input.alpha ?? 1);
    this.ops.push({ kind: 'fill', color, alpha, path: this.path });
    this.consumed = true;
    invalidate(this);
    return this;
  }

  stroke(input: StrokeInput = {}): this {
    const style = {
      width: input.width ?? 1,
      color: input.color ?? 0x000000,
      alpha: input.alpha ?? 1,
      alignment: input.alignment ?? 0.5,
      cap: input.cap ?? 'butt',
      join: input.join ?? 'miter',
    };
    this.ops.push({ kind: 'stroke', style, path: this.path, closed: this.pathClosed });
    this.grow(this.b.minX, this.b.minY, style.width);
    this.grow(this.b.maxX, this.b.maxY, style.width);
    this.consumed = true;
    invalidate(this);
    return this;
  }

  protected override ownBounds(): Bounds | null {
    const b = this.b;
    if (b.minX === Infinity) return null;
    return { x: b.minX, y: b.minY, width: b.maxX - b.minX, height: b.maxY - b.minY };
  }

  /** @internal the union of all drawn paths, used when this Graphics is a mask. */
  _clipPath(): Path2D {
    const p = new Path2D();
    for (const op of this.ops) if (op.kind === 'fill') p.addPath(op.path);
    return p;
  }

  override _draw(ctx: CanvasRenderingContext2D): void {
    const base = ctx.globalAlpha;
    for (const op of this.ops) {
      if (op.kind === 'fill') {
        ctx.globalAlpha = base * op.alpha;
        ctx.fillStyle = css(op.color);
        ctx.fill(op.path);
      } else if (op.kind === 'stroke') {
        const s = op.style;
        ctx.globalAlpha = base * s.alpha;
        ctx.strokeStyle = css(s.color);
        ctx.lineCap = s.cap;
        ctx.lineJoin = s.join;
        // Stroke alignment: 1 = inside, 0 = outside, 0.5 = centred (closed shapes only).
        if (op.closed && s.alignment !== 0.5) {
          ctx.save();
          if (s.alignment >= 1) ctx.clip(op.path);
          else if (s.alignment <= 0) {
            const outside = new Path2D();
            outside.rect(-1e5, -1e5, 2e5, 2e5);
            outside.addPath(op.path);
            ctx.clip(outside, 'evenodd');
          }
          ctx.lineWidth = s.width * 2;
          ctx.stroke(op.path);
          ctx.restore();
        } else {
          ctx.lineWidth = s.width;
          ctx.stroke(op.path);
        }
      }
    }
    ctx.globalAlpha = base;
  }

  override _hitSelf(x: number, y: number): boolean {
    const b = this.ownBounds();
    return !!b && x >= b.x && y >= b.y && x < b.x + b.width && y < b.y + b.height;
  }
}

// ------------------------------------------------------------------ Text
export interface TextStyleOptions {
  fontFamily?: string | string[];
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  fill?: number | string;
  lineHeight?: number;
  wordWrap?: boolean;
  wordWrapWidth?: number;
  breakWords?: boolean;
  align?: 'left' | 'center' | 'right';
}

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
let measureCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
function measurer() {
  if (!measureCtx) {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
    measureCtx = c.getContext('2d') as CanvasRenderingContext2D;
  }
  return measureCtx;
}

export function fontString(s: TextStyleOptions): string {
  const fams = (Array.isArray(s.fontFamily) ? s.fontFamily : String(s.fontFamily ?? 'sans-serif').split(','))
    .map((f) => {
      const n = f.trim();
      return GENERIC.has(n) || /^["']/.test(n) ? n : `"${n}"`;
    })
    .join(',');
  return `${s.fontStyle ?? 'normal'} normal ${s.fontWeight ?? 'normal'} ${s.fontSize ?? 26}px ${fams}`;
}

export class Text extends Container {
  readonly anchor: ObservablePoint;
  private _text = '';
  private _style: TextStyleOptions = {};
  private cacheKey = '';
  private layoutCache: { lines: string[]; width: number; lineHeight: number } = { lines: [], width: 0, lineHeight: 0 };

  constructor(opts: { text?: string; style?: TextStyleOptions } = {}) {
    super();
    this.anchor = new ObservablePoint(this);
    this._text = String(opts.text ?? '');
    this.style = opts.style ?? {};
  }

  get text(): string {
    return this._text;
  }
  set text(v: string) {
    const s = String(v ?? '');
    if (s !== this._text) ((this._text = s), invalidate(this));
  }

  /** Returns a live object: mutating it (e.g. style.wordWrapWidth = n) re-lays out the text. */
  get style(): TextStyleOptions {
    return this._style;
  }
  set style(v: TextStyleOptions) {
    const owner = this;
    this._style = new Proxy(
      { ...v },
      {
        set(target, prop, value) {
          (target as Record<string | symbol, unknown>)[prop] = value;
          invalidate(owner);
          owner.cacheKey = '';
          return true;
        },
      },
    );
    this.cacheKey = '';
    invalidate(this);
  }

  private layout() {
    const s = this._style;
    const key = `${this._text}\u0000${fontString(s)}|${s.lineHeight}|${s.wordWrap}|${s.wordWrapWidth}|${s.breakWords}`;
    if (key === this.cacheKey) return this.layoutCache;
    const ctx = measurer();
    ctx.font = fontString(s);
    const size = s.fontSize ?? 26;
    const lineHeight = s.lineHeight ?? Math.ceil(size * 1.25);
    const maxW = s.wordWrap && s.wordWrapWidth ? s.wordWrapWidth : Infinity;
    const lines: string[] = [];
    for (const para of this._text.split('\n')) {
      if (maxW === Infinity) {
        lines.push(para);
        continue;
      }
      let line = '';
      for (const word of para.split(/(\s+)/)) {
        const next = line + word;
        if (ctx.measureText(next).width <= maxW || !line.trim()) {
          line = next;
          // Break a single word that is wider than the line.
          while (s.breakWords !== false && ctx.measureText(line).width > maxW && line.length > 1) {
            let cut = line.length - 1;
            while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxW) cut--;
            lines.push(line.slice(0, cut));
            line = line.slice(cut);
          }
        } else {
          lines.push(line.trimEnd());
          line = word.trimStart();
        }
      }
      lines.push(line);
    }
    const width = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    this.layoutCache = { lines, width, lineHeight };
    this.cacheKey = key;
    return this.layoutCache;
  }

  protected override ownBounds(): Bounds | null {
    const { lines, width, lineHeight } = this.layout();
    if (!this._text) return { x: 0, y: 0, width: 0, height: 0 };
    const h = lines.length * lineHeight;
    return { x: -width * this.anchor.x, y: -h * this.anchor.y, width, height: h };
  }

  override get width(): number {
    return this._text ? this.layout().width : 0;
  }
  override get height(): number {
    const { lines, lineHeight } = this.layout();
    return this._text ? lines.length * lineHeight : 0;
  }

  override _draw(ctx: CanvasRenderingContext2D): void {
    if (!this._text) return;
    const s = this._style;
    const { lines, width, lineHeight } = this.layout();
    const h = lines.length * lineHeight;
    ctx.font = fontString(s);
    ctx.fillStyle = typeof s.fill === 'number' ? css(s.fill) : (s.fill ?? '#000');
    ctx.textBaseline = 'middle';
    const x0 = -width * this.anchor.x;
    const y0 = -h * this.anchor.y;
    lines.forEach((line, i) => ctx.fillText(line, x0, y0 + i * lineHeight + lineHeight / 2));
  }
}

// ------------------------------------------------------------------ Ticker
export class Ticker {
  deltaMS = 16.67;
  private readonly listeners: { fn: (t: Ticker) => void; ctx: unknown }[] = [];
  private raf = 0;
  private last = 0;
  constructor(private readonly onFrame: () => void) {}

  add(fn: (t: Ticker) => void, ctx?: unknown): this {
    this.listeners.push({ fn, ctx });
    if (!this.raf) this.start();
    return this;
  }

  remove(fn: (t: Ticker) => void, ctx?: unknown): this {
    const i = this.listeners.findIndex((l) => l.fn === fn && (ctx === undefined || l.ctx === ctx));
    if (i >= 0) this.listeners.splice(i, 1);
    return this;
  }

  get count(): number {
    return this.listeners.length;
  }

  private start(): void {
    this.last = performance.now();
    const loop = (now: number) => {
      this.deltaMS = Math.min(100, now - this.last);
      this.last = now;
      for (const l of [...this.listeners]) l.fn.call(l.ctx, this);
      this.onFrame();
      this.raf = this.listeners.length ? requestAnimationFrame(loop) : 0;
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

// ------------------------------------------------------------------ events
export class FederatedPointerEvent {
  readonly global: { x: number; y: number };
  propagationStopped = false;
  currentTarget: Container | null = null;
  constructor(
    readonly type: string,
    readonly native: PointerEvent | MouseEvent,
    x: number,
    y: number,
    readonly target: Container | null,
  ) {
    this.global = { x, y };
  }
  get pointerType(): string {
    return (this.native as PointerEvent).pointerType ?? 'mouse';
  }
  get pointerId(): number {
    return (this.native as PointerEvent).pointerId ?? 1;
  }
  get button(): number {
    return this.native.button;
  }
  get shiftKey(): boolean {
    return this.native.shiftKey;
  }
  getLocalPosition(c: Container): { x: number; y: number } {
    return c.toLocal(this.global);
  }
  stopPropagation(): void {
    this.propagationStopped = true;
  }
  preventDefault(): void {
    this.native.preventDefault();
  }
}

export class FederatedWheelEvent extends FederatedPointerEvent {
  get deltaY(): number {
    return (this.native as WheelEvent).deltaY;
  }
  get deltaX(): number {
    return (this.native as WheelEvent).deltaX;
  }
  get deltaMode(): number {
    return (this.native as WheelEvent).deltaMode;
  }
}

// ------------------------------------------------------------------ Application
export interface ApplicationOptions {
  width?: number;
  height?: number;
  resizeTo?: HTMLElement | Window;
  background?: number | string;
  backgroundAlpha?: number;
  resolution?: number;
  autoDensity?: boolean;
  [k: string]: unknown;
}

class Renderer extends EventEmitter {
  readonly background: { color: number; alpha: number };
  constructor(private readonly app: Application) {
    super();
    let color = 0x000000;
    let alpha = 1;
    this.background = {
      get color() {
        return color;
      },
      set color(v: number) {
        color = v;
        app.requestRender();
      },
      get alpha() {
        return alpha;
      },
      set alpha(v: number) {
        alpha = v;
        app.requestRender();
      },
    };
  }
  get resolution(): number {
    return this.app.resolution;
  }
  resize(w: number, h: number): void {
    this.app._resize(w, h);
  }
}

export class Application {
  readonly stage = new Container();
  readonly screen = new Rectangle(0, 0, 800, 600);
  readonly canvas: HTMLCanvasElement = document.createElement('canvas');
  readonly ticker: Ticker;
  readonly renderer: Renderer;
  resolution = 1;
  private ctx!: CanvasRenderingContext2D;
  private dirty = true;
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private resizeTarget: HTMLElement | Window | null = null;
  private downTargets = new Map<number, Container | null>();
  private hoverTarget: Container | null = null;
  private destroyedFlag = false;

  constructor() {
    this.ticker = new Ticker(() => this.flush());
    this.renderer = new Renderer(this);
  }

  async init(opts: ApplicationOptions = {}): Promise<void> {
    appsByStage.set(this.stage, this);
    const ctx = this.canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.resolution = opts.resolution ?? (window.devicePixelRatio || 1);
    this.renderer.background.color = typeof opts.background === 'number' ? opts.background : 0x000000;
    this.renderer.background.alpha = opts.backgroundAlpha ?? 1;
    this.canvas.style.display = 'block';
    this.resizeTarget = opts.resizeTo ?? null;
    if (this.resizeTarget) {
      const fit = () => {
        const t = this.resizeTarget!;
        const w = t instanceof Window ? t.innerWidth : t.clientWidth;
        const h = t instanceof Window ? t.innerHeight : t.clientHeight;
        if (w && h && (w !== this.screen.width || h !== this.screen.height)) this._resize(w, h);
      };
      if (this.resizeTarget instanceof Window) window.addEventListener('resize', fit);
      else {
        this.ro = new ResizeObserver(fit);
        this.ro.observe(this.resizeTarget);
      }
      const t = this.resizeTarget;
      this._resize(
        (t instanceof Window ? t.innerWidth : t.clientWidth) || opts.width || 800,
        (t instanceof Window ? t.innerHeight : t.clientHeight) || opts.height || 600,
      );
    } else {
      this._resize(opts.width ?? 800, opts.height ?? 600);
    }
    this.canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove, true);
    window.addEventListener('pointerup', this.onUp, true);
    this.canvas.addEventListener('pointerleave', this.onLeave);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** @internal */
  _resize(w: number, h: number): void {
    this.screen.width = w;
    this.screen.height = h;
    this.canvas.width = Math.round(w * this.resolution);
    this.canvas.height = Math.round(h * this.resolution);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.dirty = true;
    this.flush();
    this.renderer.emit('resize', w, h);
  }

  /** Changes the backing-store resolution (e.g. after browser zoom) and re-renders. */
  setResolution(r: number): void {
    if (!(r > 0) || r === this.resolution) return;
    this.resolution = r;
    this._resize(this.screen.width, this.screen.height);
  }

  /** Re-fits to `resizeTo` (FormUI calls it when the mobile viewport changes). */
  resize(): void {
    const t = this.resizeTarget;
    if (!t) return;
    const w = t instanceof Window ? t.innerWidth : t.clientWidth;
    const h = t instanceof Window ? t.innerHeight : t.clientHeight;
    if (w && h) this._resize(w, h);
  }

  requestRender(): void {
    this.dirty = true;
    if (!this.raf && !this.destroyedFlag) this.raf = requestAnimationFrame(() => ((this.raf = 0), this.flush()));
  }

  /** Renders immediately. */
  render(): void {
    this.dirty = true;
    this.flush();
  }

  private flush(): void {
    if (!this.dirty || this.destroyedFlag) return;
    this.dirty = false;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.resolution, 0, 0, this.resolution, 0, 0);
    const bg = this.renderer.background;
    if (bg.alpha > 0) {
      ctx.globalAlpha = bg.alpha;
      ctx.fillStyle = css(bg.color);
      ctx.fillRect(0, 0, this.screen.width, this.screen.height);
    }
    ctx.globalAlpha = 1;
    this.drawNode(this.stage, 0, 0, 1);
    this.renderer.emit('postrender');
  }

  private drawNode(n: Container, ox: number, oy: number, alpha: number): void {
    if (!n.visible || !n.renderable || n._isMask || n.alpha <= 0) return;
    const x = ox + n.position.x;
    const y = oy + n.position.y;
    const a = alpha * n.alpha;
    const ctx = this.ctx;
    const mask = n.mask;
    if (mask) {
      ctx.save();
      const mw = mask.worldPosition();
      ctx.translate(mw.x, mw.y);
      if (mask instanceof Graphics) ctx.clip(mask._clipPath());
      ctx.translate(-mw.x, -mw.y);
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = a;
    n._draw(ctx);
    ctx.restore();
    for (const c of n.children) this.drawNode(c, x, y, a);
    if (mask) ctx.restore();
  }

  // -------------------------------------------------------------- hit testing + dispatch
  private point(e: MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** Hit test in canvas coordinates; (ox, oy) is the parent's world origin. */
  private hit(n: Container, gx: number, gy: number, ox = 0, oy = 0): Container | null {
    if (!n.visible || n.eventMode === 'none' || n._isMask) return null;
    const wx = ox + n.position.x;
    const wy = oy + n.position.y;
    const lx = gx - wx;
    const ly = gy - wy;
    if (n.hitArea && !n.hitArea.contains(lx, ly)) return null; // a hitArea also bounds its children
    const mask = n.mask;
    if (mask) {
      const mw = mask.worldPosition();
      const mb = mask.getLocalBounds();
      const mx = gx - mw.x;
      const my = gy - mw.y;
      if (mx < mb.x || my < mb.y || mx > mb.x + mb.width || my > mb.y + mb.height) return null;
    }
    for (let i = n.children.length - 1; i >= 0; i--) {
      const h = this.hit(n.children[i], gx, gy, wx, wy);
      if (h) return h;
    }
    if (n.eventMode === 'static' || n.eventMode === 'dynamic') {
      if (n.hitArea ? n.hitArea.contains(lx, ly) : n._hitSelf(lx, ly)) return n;
    }
    return null;
  }

  private chain(n: Container | null): Container[] {
    const out: Container[] = [];
    for (let c = n; c; c = c.parent) out.push(c);
    return out;
  }

  private dispatch(type: string, target: Container | null, e: FederatedPointerEvent): void {
    for (const n of this.chain(target)) {
      if (e.propagationStopped) break;
      e.currentTarget = n;
      n.emit(type, e);
    }
  }

  private onDown = (ne: PointerEvent): void => {
    const p = this.point(ne);
    const t = this.hit(this.stage, p.x, p.y);
    this.downTargets.set(ne.pointerId, t);
    this.dispatch('pointerdown', t, new FederatedPointerEvent('pointerdown', ne, p.x, p.y, t));
  };

  private onMove = (ne: PointerEvent): void => {
    const p = this.point(ne);
    const t = this.hit(this.stage, p.x, p.y);
    const inside = p.x >= 0 && p.y >= 0 && p.x < this.screen.width && p.y < this.screen.height;
    // globalpointermove: every listener, wherever the pointer is
    const ev = new FederatedPointerEvent('globalpointermove', ne, p.x, p.y, t);
    const visit = (n: Container) => {
      if (n.listenerCount('globalpointermove')) n.emit('globalpointermove', ev);
      for (const c of [...n.children]) visit(c);
    };
    visit(this.stage);
    if (inside) this.dispatch('pointermove', t, new FederatedPointerEvent('pointermove', ne, p.x, p.y, t));
    this.updateHover(inside ? t : null, ne, p);
  };

  private updateHover(t: Container | null, ne: PointerEvent, p: { x: number; y: number }): void {
    if (t !== this.hoverTarget) {
      const prev = this.hoverTarget;
      this.hoverTarget = t;
      if (prev) this.dispatch('pointerout', prev, new FederatedPointerEvent('pointerout', ne, p.x, p.y, prev));
      if (t) this.dispatch('pointerover', t, new FederatedPointerEvent('pointerover', ne, p.x, p.y, t));
    }
    let cursor = 'default';
    for (const n of this.chain(t)) {
      if (n.cursor && (n.eventMode === 'static' || n.eventMode === 'dynamic')) {
        cursor = n.cursor;
        break;
      }
    }
    this.canvas.style.cursor = cursor;
  }

  private onLeave = (ne: PointerEvent): void => {
    if (ne.pointerType === 'mouse') this.updateHover(null, ne, this.point(ne));
  };

  private onUp = (ne: PointerEvent): void => {
    if (!this.downTargets.has(ne.pointerId)) return;
    const down = this.downTargets.get(ne.pointerId) ?? null;
    this.downTargets.delete(ne.pointerId);
    const p = this.point(ne);
    const inside = p.x >= 0 && p.y >= 0 && p.x < this.screen.width && p.y < this.screen.height;
    const t = inside ? this.hit(this.stage, p.x, p.y) : null;
    if (t) this.dispatch('pointerup', t, new FederatedPointerEvent('pointerup', ne, p.x, p.y, t));
    const upChain = new Set(this.chain(t));
    // pointerupoutside: on the pressed node and its ancestors that the pointer left
    if (down) {
      const ev = new FederatedPointerEvent('pointerupoutside', ne, p.x, p.y, down);
      for (const n of this.chain(down)) {
        if (upChain.has(n) || ev.propagationStopped) break;
        ev.currentTarget = n;
        n.emit('pointerupoutside', ev);
      }
    }
    // pointertap: on the deepest common ancestor of the press and release targets
    if (down && t) {
      const common = this.chain(down).find((n) => upChain.has(n)) ?? null;
      if (common) this.dispatch('pointertap', common, new FederatedPointerEvent('pointertap', ne, p.x, p.y, common));
    }
  };

  private onWheel = (ne: WheelEvent): void => {
    const p = this.point(ne);
    const t = this.hit(this.stage, p.x, p.y);
    if (!t) return;
    // Handlers call e.preventDefault() only when they actually scroll, so the
    // page keeps scrolling over a form that has nothing to scroll itself.
    this.dispatch('wheel', t, new FederatedWheelEvent('wheel', ne, p.x, p.y, t));
  };

  destroy(removeView?: boolean | { removeView?: boolean }, _options?: unknown): void {
    this.destroyedFlag = true;
    this.ticker.stop();
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove, true);
    window.removeEventListener('pointerup', this.onUp, true);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.stage.destroy({ children: true });
    const remove = removeView === true || (typeof removeView === 'object' && removeView.removeView);
    if (remove) this.canvas.remove();
    appsByStage.delete(this.stage);
  }
}
