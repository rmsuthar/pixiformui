const baseTokens = {
  fontFamily: ["system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
  fontSize: 15,
  fontWeight: "400",
  labelFontSize: 13,
  labelFontWeight: "600",
  helperFontSize: 12,
  titleFontSize: 22,
  lineHeight: 1.45,
  radius: 10,
  borderWidth: 1.5,
  controlHeight: 44,
  paddingX: 14,
  paddingY: 10,
  labelGap: 7,
  helperGap: 6,
  focusRingWidth: 3,
  focusRingOffset: 2,
  buttonHeight: 44,
  buttonRadius: 10,
  checkboxSize: 20,
  toggleWidth: 44,
  toggleHeight: 26,
  sliderTrackHeight: 6,
  sliderThumbSize: 22,
  caretWidth: 1.5,
  caretBlinkMs: 530,
  dropdownMaxVisible: 6,
  dropdownItemHeight: 38,
  animationSpeed: 0.25
};
const lightTheme = deepFreeze({
  ...baseTokens,
  colors: {
    background: 15659510,
    surface: 16777215,
    surfaceHover: 16251388,
    surfaceDisabled: 15659252,
    border: 13226461,
    borderHover: 10135482,
    borderFocus: 5195493,
    text: 1120295,
    textMuted: 5989751,
    textDisabled: 10134450,
    placeholder: 10003123,
    primary: 5195493,
    primaryHover: 4405450,
    primaryPressed: 3616931,
    primaryText: 16777215,
    secondary: 15264498,
    secondaryHover: 14475242,
    secondaryText: 2042167,
    error: 14232864,
    warning: 11880200,
    success: 496725,
    selection: 13095678,
    caret: 5195493,
    focusRing: 10859772,
    track: 14541546,
    thumb: 16777215,
    inverseSurface: 2040883,
    inverseText: 15987958,
    overlay: 725024,
    shadow: 725024
  }
});
const darkTheme = deepFreeze({
  ...baseTokens,
  colors: {
    background: 987672,
    surface: 1711913,
    surfaceHover: 2172724,
    surfaceDisabled: 1448482,
    border: 3423308,
    borderHover: 5002858,
    borderFocus: 8490232,
    text: 15659510,
    textMuted: 10726587,
    textDisabled: 6121080,
    placeholder: 7042183,
    primary: 6514417,
    primaryHover: 7632885,
    primaryPressed: 5527776,
    primaryText: 16777215,
    secondary: 2765120,
    secondaryHover: 3423310,
    secondaryText: 15067115,
    error: 16347238,
    warning: 16625698,
    success: 4705673,
    selection: 3616931,
    caret: 10859772,
    focusRing: 6514417,
    track: 2896706,
    thumb: 16777215,
    inverseSurface: 15659510,
    inverseText: 1120295,
    overlay: 0,
    shadow: 0
  }
});
function themeFromSeed(seed, dark = false) {
  const base = dark ? darkTheme : lightTheme;
  const primary = dark ? mix(seed, 16777215, 0.15) : seed;
  return createTheme(base, {
    colors: {
      primary,
      primaryHover: mix(primary, dark ? 16777215 : 0, 0.12),
      primaryPressed: mix(primary, 0, 0.22),
      borderFocus: primary,
      caret: primary,
      focusRing: mix(primary, dark ? 0 : 16777215, 0.45),
      selection: mix(primary, dark ? 0 : 16777215, dark ? 0.45 : 0.72)
    }
  });
}
function mix(a, b, t) {
  const ch = (c, s) => c >> s & 255;
  const m = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return m(16) | m(8) | m(0);
}
function createTheme(base, overrides) {
  if (!overrides) return base;
  return deepFreeze(deepMerge(base, overrides));
}
function deepMerge(base, over) {
  if (over === void 0) return base;
  if (Array.isArray(over) || typeof over !== "object" || over === null) return over;
  const out = { ...base };
  for (const key2 of Object.keys(over)) {
    if (key2 === "__proto__" || key2 === "constructor" || key2 === "prototype") continue;
    out[key2] = deepMerge(base?.[key2], over[key2]);
  }
  return out;
}
function deepFreeze(obj) {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj)) deepFreeze(v);
  }
  return obj;
}
const GENERIC_FAMILIES = /* @__PURE__ */ new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji"
]);
function cssFont(theme, size = theme.fontSize, weight = theme.fontWeight) {
  const families = theme.fontFamily.map((f) => {
    const name = f.trim();
    if (GENERIC_FAMILIES.has(name) || /^["']/.test(name)) return name;
    return `"${name.replace(/["\\]/g, "")}"`;
  }).join(",");
  return `normal normal ${weight} ${size}px ${families}`;
}
function createFormTheme(palette, tokens) {
  const dark = palette.mode === "dark";
  const base = dark ? darkTheme : lightTheme;
  const b = base.colors;
  const th = palette.theme ?? {};
  const tx = palette.text ?? {};
  const ac = typeof palette.accent === "number" ? { base: palette.accent } : palette.accent ?? { base: b.primary };
  const st = palette.status ?? {};
  const background = th.background ?? b.background;
  const surface = th.surface ?? b.surface;
  const text = tx.primary ?? b.text;
  const textMuted = tx.secondary ?? mix(text, surface, 0.4);
  const border = th.border ?? mix(surface, text, dark ? 0.22 : 0.2);
  const accent = ac.base;
  const towards = dark ? 16777215 : 0;
  return createTheme(base, {
    ...tokens ?? {},
    colors: {
      background,
      surface,
      surfaceHover: mix(surface, text, dark ? 0.05 : 0.025),
      surfaceDisabled: mix(surface, background, 0.6),
      border,
      borderHover: th.borderHover ?? mix(border, text, 0.35),
      borderFocus: accent,
      text,
      textMuted,
      textDisabled: tx.disabled ?? mix(text, surface, 0.62),
      placeholder: tx.placeholder ?? mix(textMuted, surface, 0.3),
      primary: accent,
      primaryHover: ac.hover ?? mix(accent, towards, 0.12),
      primaryPressed: ac.pressed ?? mix(accent, 0, 0.22),
      primaryText: tx.onAccent ?? readableOn(accent),
      secondary: mix(surface, text, dark ? 0.1 : 0.07),
      secondaryHover: mix(surface, text, dark ? 0.15 : 0.11),
      secondaryText: text,
      error: st.error ?? b.error,
      warning: st.warning ?? b.warning,
      success: st.success ?? b.success,
      selection: ac.selection ?? mix(accent, surface, dark ? 0.55 : 0.72),
      caret: ac.caret ?? accent,
      focusRing: ac.focusRing ?? mix(accent, surface, 0.45),
      track: mix(border, surface, 0.35),
      thumb: 16777215,
      inverseSurface: text,
      inverseText: surface,
      overlay: 0,
      shadow: th.shadow ?? 0
    }
  });
}
const accentPalettes = {
  indigo: { light: 5195493, dark: 8490232 },
  teal: { light: 1013358, dark: 3003583 },
  rose: { light: 14753096, dark: 16478597 },
  amber: { light: 11817737, dark: 16498468 },
  violet: { light: 8141549, dark: 10980346 },
  slate: { light: 3359061, dark: 13358561 }
};
function presetTheme(accentName, mode = "light") {
  return createFormTheme({ mode, accent: accentPalettes[accentName][mode] });
}
function channel(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance(color) {
  return 0.2126 * channel(color >> 16 & 255) + 0.7152 * channel(color >> 8 & 255) + 0.0722 * channel(color & 255);
}
function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function readableOn(bg) {
  return contrastRatio(bg, 16777215) >= contrastRatio(bg, 1120295) ? 16777215 : 1120295;
}
function checkContrast(theme) {
  const c = theme.colors;
  const pairs = [
    ["text on surface", c.text, c.surface, 4.5],
    ["helper text on surface", c.textMuted, c.surface, 4.5],
    ["button text on accent", c.primaryText, c.primary, 4.5],
    ["error text on surface", c.error, c.surface, 4.5],
    ["focus border on surface", c.borderFocus, c.surface, 3]
  ];
  return pairs.filter(([, a, b, min]) => contrastRatio(a, b) < min).map(([name, a, b, min]) => `${name}: ${contrastRatio(a, b).toFixed(2)}:1 (needs ${min}:1)`);
}
class EventEmitter {
  _events = /* @__PURE__ */ new Map();
  on(event, fn, ctx) {
    const list = this._events.get(event) ?? [];
    list.push({ fn, ctx, once: false });
    this._events.set(event, list);
    return this;
  }
  once(event, fn, ctx) {
    this.on(event, fn, ctx);
    const list = this._events.get(event);
    list[list.length - 1].once = true;
    return this;
  }
  off(event, fn, ctx) {
    const list = this._events.get(event);
    if (!list) return this;
    const keep = list.filter((l) => fn && l.fn !== fn || ctx !== void 0 && l.ctx !== ctx);
    if (keep.length) this._events.set(event, keep);
    else this._events.delete(event);
    return this;
  }
  emit(event, ...args) {
    const list = this._events.get(event);
    if (!list?.length) return false;
    for (const l of [...list]) {
      if (l.once) this.off(event, l.fn, l.ctx);
      l.fn.apply(l.ctx, args);
    }
    return true;
  }
  listenerCount(event) {
    return this._events.get(event)?.length ?? 0;
  }
  removeAllListeners(event) {
    if (event === void 0) this._events.clear();
    else this._events.delete(event);
    return this;
  }
}
const appsByStage = /* @__PURE__ */ new WeakMap();
function invalidate(node) {
  let n = node;
  while (n && n.parent) n = n.parent;
  if (n) appsByStage.get(n)?.requestRender();
}
class Rectangle {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
  x;
  y;
  width;
  height;
  contains(px, py) {
    return px >= this.x && py >= this.y && px < this.x + this.width && py < this.y + this.height;
  }
}
class Circle {
  constructor(x = 0, y = 0, radius = 0) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }
  x;
  y;
  radius;
  contains(px, py) {
    return (px - this.x) ** 2 + (py - this.y) ** 2 <= this.radius ** 2;
  }
}
class ObservablePoint {
  constructor(owner, _x = 0, _y = 0) {
    this.owner = owner;
    this._x = _x;
    this._y = _y;
  }
  owner;
  _x;
  _y;
  get x() {
    return this._x;
  }
  set x(v) {
    if (v !== this._x) this._x = v, this.owner.onChange();
  }
  get y() {
    return this._y;
  }
  set y(v) {
    if (v !== this._y) this._y = v, this.owner.onChange();
  }
  set(x, y = x) {
    if (x === this._x && y === this._y) return;
    this._x = x;
    this._y = y;
    this.owner.onChange();
  }
}
class Container extends EventEmitter {
  children = [];
  parent = null;
  label = "";
  eventMode = "passive";
  cursor;
  hitArea = null;
  renderable = true;
  destroyed = false;
  position = new ObservablePoint(this);
  _visible = true;
  _alpha = 1;
  _mask = null;
  /** @internal */
  _isMask = false;
  onChange() {
    invalidate(this);
  }
  get x() {
    return this.position.x;
  }
  set x(v) {
    this.position.x = v;
  }
  get y() {
    return this.position.y;
  }
  set y(v) {
    this.position.y = v;
  }
  get visible() {
    return this._visible;
  }
  set visible(v) {
    if (v !== this._visible) this._visible = v, invalidate(this);
  }
  get alpha() {
    return this._alpha;
  }
  set alpha(v) {
    if (v !== this._alpha) this._alpha = v, invalidate(this);
  }
  get mask() {
    return this._mask;
  }
  set mask(m) {
    if (this._mask) this._mask._isMask = false;
    this._mask = m;
    if (m) m._isMask = true;
    invalidate(this);
  }
  get width() {
    return this.getLocalBounds().width;
  }
  get height() {
    return this.getLocalBounds().height;
  }
  addChild(...items) {
    for (const c of items) this.addChildAt(c, this.children.length);
    return items[0];
  }
  addChildAt(child, index) {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.splice(Math.max(0, Math.min(index, this.children.length)), 0, child);
    invalidate(this);
    return child;
  }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) {
      this.children.splice(i, 1);
      child.parent = null;
      invalidate(this);
    }
    return child;
  }
  removeChildren() {
    const removed = this.children;
    for (const c of removed) c.parent = null;
    this.children = [];
    invalidate(this);
    return removed;
  }
  /** World offset (translation only). */
  worldPosition() {
    let x = 0;
    let y = 0;
    for (let n = this; n; n = n.parent) {
      x += n.position.x;
      y += n.position.y;
    }
    return { x, y };
  }
  toLocal(p) {
    const w2 = this.worldPosition();
    return { x: p.x - w2.x, y: p.y - w2.y };
  }
  toGlobal(p) {
    const w2 = this.worldPosition();
    return { x: p.x + w2.x, y: p.y + w2.y };
  }
  getGlobalPosition() {
    return this.worldPosition();
  }
  /** Own content bounds in local coordinates (overridden by Graphics/Text). */
  ownBounds() {
    return null;
  }
  getLocalBounds() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const add = (b, ox, oy) => {
      if (!b || b.width === 0 && b.height === 0) return;
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
  getBounds() {
    const b = this.getLocalBounds();
    const w2 = this.worldPosition();
    return { x: b.x + w2.x, y: b.y + w2.y, width: b.width, height: b.height };
  }
  /** @internal draw own content at the current transform. */
  _draw(_ctx) {
  }
  /** @internal hit-test own content (local coords). */
  _hitSelf(x, y) {
    const b = this.ownBounds();
    return !!b && x >= b.x && y >= b.y && x < b.x + b.width && y < b.y + b.height;
  }
  destroy(options) {
    if (this.destroyed) return;
    const deep = options === true || typeof options === "object" && options?.children;
    invalidate(this);
    this.parent?.removeChild(this);
    if (deep) for (const c of [...this.children]) c.destroy(options);
    this.children = [];
    this.removeAllListeners();
    this.destroyed = true;
  }
}
const css = (c) => `#${(c & 16777215).toString(16).padStart(6, "0")}`;
class Graphics extends Container {
  ops = [];
  path = new Path2D();
  pathClosed = true;
  consumed = false;
  b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  grow(x, y, pad2 = 0) {
    this.b.minX = Math.min(this.b.minX, x - pad2);
    this.b.minY = Math.min(this.b.minY, y - pad2);
    this.b.maxX = Math.max(this.b.maxX, x + pad2);
    this.b.maxY = Math.max(this.b.maxY, y + pad2);
  }
  shape(closed) {
    if (this.consumed) {
      this.path = new Path2D();
      this.pathClosed = true;
      this.consumed = false;
    }
    if (!closed) this.pathClosed = false;
    invalidate(this);
    return this.path;
  }
  clear() {
    this.ops = [];
    this.path = new Path2D();
    this.pathClosed = true;
    this.consumed = false;
    this.b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    invalidate(this);
    return this;
  }
  rect(x, y, w2, h) {
    this.shape(true).rect(x, y, w2, h);
    this.grow(x, y);
    this.grow(x + w2, y + h);
    return this;
  }
  roundRect(x, y, w2, h, r = 0) {
    const rr = Math.max(0, Math.min(r, Math.abs(w2) / 2, Math.abs(h) / 2));
    this.shape(true).roundRect(x, y, w2, h, rr);
    this.grow(x, y);
    this.grow(x + w2, y + h);
    return this;
  }
  circle(x, y, r) {
    const p = this.shape(true);
    p.moveTo(x + r, y);
    p.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    p.closePath();
    this.grow(x, y, r);
    return this;
  }
  poly(points) {
    const p = this.shape(true);
    for (let i = 0; i < points.length; i += 2) {
      if (i === 0) p.moveTo(points[0], points[1]);
      else p.lineTo(points[i], points[i + 1]);
      this.grow(points[i], points[i + 1]);
    }
    p.closePath();
    return this;
  }
  moveTo(x, y) {
    this.shape(false).moveTo(x, y);
    this.grow(x, y);
    return this;
  }
  lineTo(x, y) {
    this.shape(false).lineTo(x, y);
    this.grow(x, y);
    return this;
  }
  quadraticCurveTo(cpx, cpy, x, y) {
    this.shape(false).quadraticCurveTo(cpx, cpy, x, y);
    this.grow(cpx, cpy);
    this.grow(x, y);
    return this;
  }
  arc(cx, cy, r, start, end, anticlockwise = false) {
    this.shape(false).arc(cx, cy, r, start, end, anticlockwise);
    this.grow(cx, cy, r);
    return this;
  }
  closePath() {
    this.path.closePath();
    return this;
  }
  fill(input = 0) {
    const color = typeof input === "number" ? input : input.color ?? 0;
    const alpha = typeof input === "number" ? 1 : input.alpha ?? 1;
    this.ops.push({ kind: "fill", color, alpha, path: this.path });
    this.consumed = true;
    invalidate(this);
    return this;
  }
  stroke(input = {}) {
    const style2 = {
      width: input.width ?? 1,
      color: input.color ?? 0,
      alpha: input.alpha ?? 1,
      alignment: input.alignment ?? 0.5,
      cap: input.cap ?? "butt",
      join: input.join ?? "miter"
    };
    this.ops.push({ kind: "stroke", style: style2, path: this.path, closed: this.pathClosed });
    this.grow(this.b.minX, this.b.minY, style2.width);
    this.grow(this.b.maxX, this.b.maxY, style2.width);
    this.consumed = true;
    invalidate(this);
    return this;
  }
  ownBounds() {
    const b = this.b;
    if (b.minX === Infinity) return null;
    return { x: b.minX, y: b.minY, width: b.maxX - b.minX, height: b.maxY - b.minY };
  }
  /** @internal the union of all drawn paths, used when this Graphics is a mask. */
  _clipPath() {
    const p = new Path2D();
    for (const op of this.ops) if (op.kind === "fill") p.addPath(op.path);
    return p;
  }
  _draw(ctx) {
    const base = ctx.globalAlpha;
    for (const op of this.ops) {
      if (op.kind === "fill") {
        ctx.globalAlpha = base * op.alpha;
        ctx.fillStyle = css(op.color);
        ctx.fill(op.path);
      } else if (op.kind === "stroke") {
        const s = op.style;
        ctx.globalAlpha = base * s.alpha;
        ctx.strokeStyle = css(s.color);
        ctx.lineCap = s.cap;
        ctx.lineJoin = s.join;
        if (op.closed && s.alignment !== 0.5) {
          ctx.save();
          if (s.alignment >= 1) ctx.clip(op.path);
          else if (s.alignment <= 0) {
            const outside = new Path2D();
            outside.rect(-1e5, -1e5, 2e5, 2e5);
            outside.addPath(op.path);
            ctx.clip(outside, "evenodd");
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
  _hitSelf(x, y) {
    const b = this.ownBounds();
    return !!b && x >= b.x && y >= b.y && x < b.x + b.width && y < b.y + b.height;
  }
}
const GENERIC = /* @__PURE__ */ new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);
let measureCtx = null;
function measurer() {
  if (!measureCtx) {
    const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
    measureCtx = c.getContext("2d");
  }
  return measureCtx;
}
function fontString(s) {
  const fams = (Array.isArray(s.fontFamily) ? s.fontFamily : String(s.fontFamily ?? "sans-serif").split(",")).map((f) => {
    const n = f.trim();
    return GENERIC.has(n) || /^["']/.test(n) ? n : `"${n}"`;
  }).join(",");
  return `${s.fontStyle ?? "normal"} normal ${s.fontWeight ?? "normal"} ${s.fontSize ?? 26}px ${fams}`;
}
class Text extends Container {
  anchor;
  _text = "";
  _style = {};
  cacheKey = "";
  layoutCache = { lines: [], width: 0, lineHeight: 0 };
  constructor(opts = {}) {
    super();
    this.anchor = new ObservablePoint(this);
    this._text = String(opts.text ?? "");
    this.style = opts.style ?? {};
  }
  get text() {
    return this._text;
  }
  set text(v) {
    const s = String(v ?? "");
    if (s !== this._text) this._text = s, invalidate(this);
  }
  /** Returns a live object: mutating it (e.g. style.wordWrapWidth = n) re-lays out the text. */
  get style() {
    return this._style;
  }
  set style(v) {
    const owner = this;
    this._style = new Proxy(
      { ...v },
      {
        set(target, prop, value) {
          target[prop] = value;
          invalidate(owner);
          owner.cacheKey = "";
          return true;
        }
      }
    );
    this.cacheKey = "";
    invalidate(this);
  }
  layout() {
    const s = this._style;
    const key2 = `${this._text}\0${fontString(s)}|${s.lineHeight}|${s.wordWrap}|${s.wordWrapWidth}|${s.breakWords}`;
    if (key2 === this.cacheKey) return this.layoutCache;
    const ctx = measurer();
    ctx.font = fontString(s);
    const size = s.fontSize ?? 26;
    const lineHeight = s.lineHeight ?? Math.ceil(size * 1.25);
    const maxW = s.wordWrap && s.wordWrapWidth ? s.wordWrapWidth : Infinity;
    const lines = [];
    for (const para of this._text.split("\n")) {
      if (maxW === Infinity) {
        lines.push(para);
        continue;
      }
      let line = "";
      for (const word of para.split(/(\s+)/)) {
        const next = line + word;
        if (ctx.measureText(next).width <= maxW || !line.trim()) {
          line = next;
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
    this.cacheKey = key2;
    return this.layoutCache;
  }
  ownBounds() {
    const { lines, width, lineHeight } = this.layout();
    if (!this._text) return { x: 0, y: 0, width: 0, height: 0 };
    const h = lines.length * lineHeight;
    return { x: -width * this.anchor.x, y: -h * this.anchor.y, width, height: h };
  }
  get width() {
    return this._text ? this.layout().width : 0;
  }
  get height() {
    const { lines, lineHeight } = this.layout();
    return this._text ? lines.length * lineHeight : 0;
  }
  _draw(ctx) {
    if (!this._text) return;
    const s = this._style;
    const { lines, width, lineHeight } = this.layout();
    const h = lines.length * lineHeight;
    ctx.font = fontString(s);
    ctx.fillStyle = typeof s.fill === "number" ? css(s.fill) : s.fill ?? "#000";
    ctx.textBaseline = "middle";
    const x0 = -width * this.anchor.x;
    const y0 = -h * this.anchor.y;
    lines.forEach((line, i) => ctx.fillText(line, x0, y0 + i * lineHeight + lineHeight / 2));
  }
}
class Ticker {
  constructor(onFrame) {
    this.onFrame = onFrame;
  }
  onFrame;
  deltaMS = 16.67;
  listeners = [];
  raf = 0;
  last = 0;
  add(fn, ctx) {
    this.listeners.push({ fn, ctx });
    if (!this.raf) this.start();
    return this;
  }
  remove(fn, ctx) {
    const i = this.listeners.findIndex((l) => l.fn === fn && (ctx === void 0 || l.ctx === ctx));
    if (i >= 0) this.listeners.splice(i, 1);
    return this;
  }
  get count() {
    return this.listeners.length;
  }
  start() {
    this.last = performance.now();
    const loop = (now) => {
      this.deltaMS = Math.min(100, now - this.last);
      this.last = now;
      for (const l of [...this.listeners]) l.fn.call(l.ctx, this);
      this.onFrame();
      this.raf = this.listeners.length ? requestAnimationFrame(loop) : 0;
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
class FederatedPointerEvent {
  constructor(type, native, x, y, target) {
    this.type = type;
    this.native = native;
    this.target = target;
    this.global = { x, y };
  }
  type;
  native;
  target;
  global;
  propagationStopped = false;
  currentTarget = null;
  get pointerType() {
    return this.native.pointerType ?? "mouse";
  }
  get pointerId() {
    return this.native.pointerId ?? 1;
  }
  get button() {
    return this.native.button;
  }
  get shiftKey() {
    return this.native.shiftKey;
  }
  getLocalPosition(c) {
    return c.toLocal(this.global);
  }
  stopPropagation() {
    this.propagationStopped = true;
  }
  preventDefault() {
    this.native.preventDefault();
  }
}
class FederatedWheelEvent extends FederatedPointerEvent {
  get deltaY() {
    return this.native.deltaY;
  }
  get deltaX() {
    return this.native.deltaX;
  }
  get deltaMode() {
    return this.native.deltaMode;
  }
}
class Renderer extends EventEmitter {
  constructor(app) {
    super();
    this.app = app;
    let color = 0;
    let alpha = 1;
    this.background = {
      get color() {
        return color;
      },
      set color(v) {
        color = v;
        app.requestRender();
      },
      get alpha() {
        return alpha;
      },
      set alpha(v) {
        alpha = v;
        app.requestRender();
      }
    };
  }
  app;
  background;
  get resolution() {
    return this.app.resolution;
  }
  resize(w2, h) {
    this.app._resize(w2, h);
  }
}
class Application {
  stage = new Container();
  screen = new Rectangle(0, 0, 800, 600);
  canvas = document.createElement("canvas");
  ticker;
  renderer;
  resolution = 1;
  ctx;
  dirty = true;
  raf = 0;
  ro = null;
  resizeTarget = null;
  downTargets = /* @__PURE__ */ new Map();
  hoverTarget = null;
  destroyedFlag = false;
  constructor() {
    this.ticker = new Ticker(() => this.flush());
    this.renderer = new Renderer(this);
  }
  async init(opts = {}) {
    appsByStage.set(this.stage, this);
    const ctx = this.canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
    this.resolution = opts.resolution ?? (window.devicePixelRatio || 1);
    this.renderer.background.color = typeof opts.background === "number" ? opts.background : 0;
    this.renderer.background.alpha = opts.backgroundAlpha ?? 1;
    this.canvas.style.display = "block";
    this.resizeTarget = opts.resizeTo ?? null;
    if (this.resizeTarget) {
      const fit = () => {
        const t2 = this.resizeTarget;
        const w2 = t2 instanceof Window ? t2.innerWidth : t2.clientWidth;
        const h = t2 instanceof Window ? t2.innerHeight : t2.clientHeight;
        if (w2 && h && (w2 !== this.screen.width || h !== this.screen.height)) this._resize(w2, h);
      };
      if (this.resizeTarget instanceof Window) window.addEventListener("resize", fit);
      else {
        this.ro = new ResizeObserver(fit);
        this.ro.observe(this.resizeTarget);
      }
      const t = this.resizeTarget;
      this._resize(
        (t instanceof Window ? t.innerWidth : t.clientWidth) || opts.width || 800,
        (t instanceof Window ? t.innerHeight : t.clientHeight) || opts.height || 600
      );
    } else {
      this._resize(opts.width ?? 800, opts.height ?? 600);
    }
    this.canvas.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove, true);
    window.addEventListener("pointerup", this.onUp, true);
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }
  /** @internal */
  _resize(w2, h) {
    this.screen.width = w2;
    this.screen.height = h;
    this.canvas.width = Math.round(w2 * this.resolution);
    this.canvas.height = Math.round(h * this.resolution);
    this.canvas.style.width = `${w2}px`;
    this.canvas.style.height = `${h}px`;
    this.dirty = true;
    this.flush();
    this.renderer.emit("resize", w2, h);
  }
  /** Changes the backing-store resolution (e.g. after browser zoom) and re-renders. */
  setResolution(r) {
    if (!(r > 0) || r === this.resolution) return;
    this.resolution = r;
    this._resize(this.screen.width, this.screen.height);
  }
  /** Re-fits to `resizeTo` (FormUI calls it when the mobile viewport changes). */
  resize() {
    const t = this.resizeTarget;
    if (!t) return;
    const w2 = t instanceof Window ? t.innerWidth : t.clientWidth;
    const h = t instanceof Window ? t.innerHeight : t.clientHeight;
    if (w2 && h) this._resize(w2, h);
  }
  requestRender() {
    this.dirty = true;
    if (!this.raf && !this.destroyedFlag) this.raf = requestAnimationFrame(() => (this.raf = 0, this.flush()));
  }
  /** Renders immediately. */
  render() {
    this.dirty = true;
    this.flush();
  }
  flush() {
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
    this.renderer.emit("postrender");
  }
  drawNode(n, ox, oy, alpha) {
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
  point(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  /** Hit test in canvas coordinates; (ox, oy) is the parent's world origin. */
  hit(n, gx, gy, ox = 0, oy = 0) {
    if (!n.visible || n.eventMode === "none" || n._isMask) return null;
    const wx = ox + n.position.x;
    const wy = oy + n.position.y;
    const lx = gx - wx;
    const ly = gy - wy;
    if (n.hitArea && !n.hitArea.contains(lx, ly)) return null;
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
    if (n.eventMode === "static" || n.eventMode === "dynamic") {
      if (n.hitArea ? n.hitArea.contains(lx, ly) : n._hitSelf(lx, ly)) return n;
    }
    return null;
  }
  chain(n) {
    const out = [];
    for (let c = n; c; c = c.parent) out.push(c);
    return out;
  }
  dispatch(type, target, e) {
    for (const n of this.chain(target)) {
      if (e.propagationStopped) break;
      e.currentTarget = n;
      n.emit(type, e);
    }
  }
  onDown = (ne) => {
    const p = this.point(ne);
    const t = this.hit(this.stage, p.x, p.y);
    this.downTargets.set(ne.pointerId, t);
    this.dispatch("pointerdown", t, new FederatedPointerEvent("pointerdown", ne, p.x, p.y, t));
  };
  onMove = (ne) => {
    const p = this.point(ne);
    const t = this.hit(this.stage, p.x, p.y);
    const inside = p.x >= 0 && p.y >= 0 && p.x < this.screen.width && p.y < this.screen.height;
    const ev = new FederatedPointerEvent("globalpointermove", ne, p.x, p.y, t);
    const visit = (n) => {
      if (n.listenerCount("globalpointermove")) n.emit("globalpointermove", ev);
      for (const c of [...n.children]) visit(c);
    };
    visit(this.stage);
    if (inside) this.dispatch("pointermove", t, new FederatedPointerEvent("pointermove", ne, p.x, p.y, t));
    this.updateHover(inside ? t : null, ne, p);
  };
  updateHover(t, ne, p) {
    if (t !== this.hoverTarget) {
      const prev = this.hoverTarget;
      this.hoverTarget = t;
      if (prev) this.dispatch("pointerout", prev, new FederatedPointerEvent("pointerout", ne, p.x, p.y, prev));
      if (t) this.dispatch("pointerover", t, new FederatedPointerEvent("pointerover", ne, p.x, p.y, t));
    }
    let cursor = "default";
    for (const n of this.chain(t)) {
      if (n.cursor && (n.eventMode === "static" || n.eventMode === "dynamic")) {
        cursor = n.cursor;
        break;
      }
    }
    this.canvas.style.cursor = cursor;
  }
  onLeave = (ne) => {
    if (ne.pointerType === "mouse") this.updateHover(null, ne, this.point(ne));
  };
  onUp = (ne) => {
    if (!this.downTargets.has(ne.pointerId)) return;
    const down = this.downTargets.get(ne.pointerId) ?? null;
    this.downTargets.delete(ne.pointerId);
    const p = this.point(ne);
    const inside = p.x >= 0 && p.y >= 0 && p.x < this.screen.width && p.y < this.screen.height;
    const t = inside ? this.hit(this.stage, p.x, p.y) : null;
    if (t) this.dispatch("pointerup", t, new FederatedPointerEvent("pointerup", ne, p.x, p.y, t));
    const upChain = new Set(this.chain(t));
    if (down) {
      const ev = new FederatedPointerEvent("pointerupoutside", ne, p.x, p.y, down);
      for (const n of this.chain(down)) {
        if (upChain.has(n) || ev.propagationStopped) break;
        ev.currentTarget = n;
        n.emit("pointerupoutside", ev);
      }
    }
    if (down && t) {
      const common = this.chain(down).find((n) => upChain.has(n)) ?? null;
      if (common) this.dispatch("pointertap", common, new FederatedPointerEvent("pointertap", ne, p.x, p.y, common));
    }
  };
  onWheel = (ne) => {
    const p = this.point(ne);
    const t = this.hit(this.stage, p.x, p.y);
    if (!t) return;
    this.dispatch("wheel", t, new FederatedWheelEvent("wheel", ne, p.x, p.y, t));
  };
  destroy(removeView, _options) {
    this.destroyedFlag = true;
    this.ticker.stop();
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove, true);
    window.removeEventListener("pointerup", this.onUp, true);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.stage.destroy({ children: true });
    const remove = removeView === true || typeof removeView === "object" && removeView.removeView;
    if (remove) this.canvas.remove();
    appsByStage.delete(this.stage);
  }
}
let seq = 0;
class A11yTree {
  constructor(ui, host, label) {
    this.ui = ui;
    this.label = label;
    const root = document.createElement("div");
    root.setAttribute("role", "form");
    root.className = "pixiform-a11y";
    Object.assign(root.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "0",
      height: "0",
      overflow: "visible",
      pointerEvents: "none",
      opacity: "0",
      color: "transparent",
      margin: "0",
      padding: "0",
      zIndex: "0"
    });
    this.descs = document.createElement("div");
    this.descs.hidden = true;
    root.appendChild(this.descs);
    this.root = root;
    host.insertBefore(root, host.firstChild);
    ui.app.renderer.on("postrender", this.onRender);
    ui.on("focuschange", this.schedule);
    this.schedule();
  }
  ui;
  label;
  root;
  descs;
  entries = /* @__PURE__ */ new Map();
  timer = 0;
  destroyed = false;
  painted = false;
  id = `pf${++seq}`;
  n = 0;
  /** The first painted frame is mirrored at once (so it's ready by the 'load' event); later ones are batched. */
  onRender = () => {
    if (this.painted) return this.schedule();
    this.painted = true;
    this.sync();
  };
  /** Coalesces frequent renders into one DOM update. */
  schedule = () => {
    if (this.destroyed || this.timer) return;
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      this.sync();
    }, 80);
  };
  /** Rebuilds the outline now, reusing elements so a screen reader's position is kept. */
  sync() {
    if (this.destroyed) return;
    const canvas = this.ui.app.canvas;
    this.root.style.left = `${canvas.offsetLeft}px`;
    this.root.style.top = `${canvas.offsetTop}px`;
    setAttr(this.root, "aria-label", this.label());
    for (const e of this.entries.values()) e.seen = false;
    const kids = this.build(this.ui.content);
    reconcile(this.root, [this.descs, ...kids]);
    for (const [node, e] of this.entries) {
      if (e.seen) continue;
      e.el.remove();
      e.help?.remove();
      e.err?.remove();
      this.entries.delete(node);
    }
  }
  // ---------------------------------------------------------------- tree walk
  build(node) {
    const out = [];
    for (const child of node.children) {
      if (!child.visible || child.renderable === false || child === this.ui.overlay) continue;
      const g = child.a11yGroup;
      const t = child.a11yText;
      if (g) out.push(this.group(child, g.call(child)));
      else if (this.ui.focus.isRegistered(child)) out.push(...this.control(child));
      else if (t) {
        const info = t.call(child);
        if (info?.text) out.push(this.text(child, info));
      } else out.push(...this.build(child));
    }
    return out;
  }
  group(node, info) {
    const e = this.entry(node, "div");
    if (!e.legend) {
      e.legend = document.createElement("span");
      e.legend.id = this.nextId();
      e.body = document.createElement("div");
      e.el.setAttribute("role", "group");
      e.el.setAttribute("aria-labelledby", e.legend.id);
    }
    e.legend.textContent = info.title;
    const desc = info.description ? this.describe(e, "help", info.description) : null;
    setAttr(e.el, "aria-describedby", desc);
    const parts = [];
    if (info.header) parts.push(...this.control(info.header, true, info.content, info.headerView));
    else parts.push(e.legend);
    if (info.header) parts.push(e.legend);
    if (info.expanded) parts.push(...this.build(info.content));
    reconcile(e.el, parts);
    return e.el;
  }
  text(node, info) {
    const e = this.entry(node, info.heading ? "h2" : "p");
    if (e.el.textContent !== info.text) e.el.textContent = info.text;
    this.place(e.el, node);
    return e.el;
  }
  /** A control. Composite controls (with focusable parts) become a group of their parts. */
  control(c, headerOnly = false, key2 = c, view = c.view) {
    const parts = headerOnly ? [] : this.build(c);
    if (parts.length) {
      const e2 = this.entry(c, "div");
      e2.el.setAttribute("role", "group");
      setAttr(e2.el, "aria-label", c.ariaLabel());
      this.applyDescription(e2, c);
      reconcile(e2.el, parts);
      return [e2.el];
    }
    const e = this.entry(key2, "div");
    const el = e.el;
    if (!el.dataset.bound) {
      el.dataset.bound = "1";
      el.tabIndex = -1;
      el.style.pointerEvents = "none";
      el.addEventListener("focus", (ev) => ev.isTrusted && this.ui.focus.focus(c, true));
      el.addEventListener("click", (ev) => {
        if (!ev.isTrusted || !c.isFocusable()) return;
        this.ui.focus.focus(c, true);
        c.activate?.();
      });
    }
    setAttr(el, "role", c.ariaRole());
    setAttr(el, "aria-label", c.ariaLabel());
    for (const [k, v] of Object.entries(c.ariaState())) setAttr(el, k, v);
    setAttr(el, "aria-disabled", c.isFocusable() ? null : "true");
    this.applyDescription(e, c);
    this.place(el, view);
    return [el];
  }
  applyDescription(e, c) {
    const d = c.ariaDescription?.() ?? {};
    const ids = [d.error ? this.describe(e, "err", d.error) : null, d.help ? this.describe(e, "help", d.help) : null].filter(Boolean);
    setAttr(e.el, "aria-describedby", ids.length ? ids.join(" ") : null);
    setAttr(e.el, "aria-errormessage", d.error ? e.err.id : null);
  }
  describe(e, kind, text) {
    let span = e[kind];
    if (!span) {
      span = document.createElement("span");
      span.id = this.nextId();
      this.descs.appendChild(span);
      e[kind] = span;
    }
    if (span.textContent !== text) span.textContent = text;
    return span.id;
  }
  place(el, view) {
    const b = view.getBounds();
    const s = el.style;
    const v = (n) => `${Math.round(n)}px`;
    if (s.position !== "absolute") {
      s.position = "absolute";
      s.margin = "0";
      s.overflow = "hidden";
      s.whiteSpace = "nowrap";
      s.fontSize = "1px";
    }
    if (s.left !== v(b.x)) s.left = v(b.x);
    if (s.top !== v(b.y)) s.top = v(b.y);
    if (s.width !== v(b.width)) s.width = v(b.width);
    if (s.height !== v(b.height)) s.height = v(b.height);
  }
  entry(node, tag) {
    let e = this.entries.get(node);
    if (!e || e.el.tagName.toLowerCase() !== tag) {
      if (e) e.el.remove();
      e = { el: document.createElement(tag), seen: true };
      this.entries.set(node, e);
    }
    e.seen = true;
    return e;
  }
  nextId() {
    return `${this.id}-${++this.n}`;
  }
  destroy() {
    this.destroyed = true;
    window.clearTimeout(this.timer);
    this.ui.app.renderer.off("postrender", this.onRender);
    this.ui.off("focuschange", this.schedule);
    this.root.remove();
    this.entries.clear();
  }
}
function setAttr(el, name, value) {
  if (value === null) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}
function reconcile(parent, kids) {
  const cur = parent.children;
  let same = cur.length === kids.length;
  for (let i = 0; same && i < kids.length; i++) same = cur[i] === kids[i];
  if (!same) parent.replaceChildren(...kids);
}
const mq = (q) => typeof matchMedia === "function" ? matchMedia(q) : null;
const MEDIA = {
  forcedColors: "(forced-colors: active)",
  moreContrast: "(prefers-contrast: more)",
  reducedMotion: "(prefers-reduced-motion: reduce)"
};
function readPrefs(o) {
  const pick = (setting, query) => setting === "on" ? true : setting === "off" ? false : !!mq(query)?.matches;
  return {
    forcedColors: o.forcedColors === "off" ? false : !!mq(MEDIA.forcedColors)?.matches,
    highContrast: pick(o.highContrast, MEDIA.moreContrast),
    reducedMotion: pick(o.reducedMotion, MEDIA.reducedMotion),
    textScale: Math.min(2, Math.max(0.75, o.textScale ?? 1))
  };
}
function watchPrefs(onChange) {
  const lists = Object.values(MEDIA).map(mq).filter((m) => !!m);
  for (const m of lists) m.addEventListener("change", onChange);
  return () => lists.forEach((m) => m.removeEventListener("change", onChange));
}
function adaptTheme(base, p) {
  let t = base;
  if (p.textScale !== 1) t = scaleTheme(t, p.textScale);
  if (p.forcedColors) t = systemColorTheme(t) ?? t;
  else if (p.highContrast) t = increaseContrast(t);
  if (p.reducedMotion) t = createTheme(t, { animationSpeed: 0.99, caretBlinkMs: 1e9 });
  return t;
}
function scaleTheme(t, k) {
  const r = (v) => Math.round(v * k);
  return createTheme(t, {
    fontSize: r(t.fontSize),
    labelFontSize: r(t.labelFontSize),
    helperFontSize: r(t.helperFontSize),
    titleFontSize: r(t.titleFontSize),
    controlHeight: r(t.controlHeight),
    buttonHeight: r(t.buttonHeight),
    paddingX: r(t.paddingX),
    paddingY: r(t.paddingY),
    checkboxSize: r(t.checkboxSize),
    toggleWidth: r(t.toggleWidth),
    toggleHeight: r(t.toggleHeight),
    sliderThumbSize: r(t.sliderThumbSize),
    dropdownItemHeight: r(t.dropdownItemHeight)
  });
}
function increaseContrast(t) {
  const c = t.colors;
  return createTheme(t, {
    borderWidth: Math.max(2, t.borderWidth),
    focusRingWidth: Math.max(3, t.focusRingWidth),
    colors: {
      textMuted: mix(c.textMuted, c.text, 0.7),
      placeholder: mix(c.placeholder, c.text, 0.45),
      border: mix(c.border, c.text, 0.65),
      borderHover: c.text,
      focusRing: c.primary,
      track: mix(c.track, c.text, 0.45)
    }
  });
}
function systemColorTheme(t) {
  if (typeof document === "undefined") return null;
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;forced-color-adjust:auto";
  document.body.appendChild(probe);
  const read = (keyword) => {
    probe.style.color = "";
    probe.style.color = keyword;
    const m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return null;
    return Math.round(+m[0]) << 16 | Math.round(+m[1]) << 8 | Math.round(+m[2]);
  };
  const canvas = read("Canvas");
  const text = read("CanvasText");
  const gray = read("GrayText");
  const hl = read("Highlight");
  const hlText = read("HighlightText");
  const btnFace = read("ButtonFace");
  const btnText = read("ButtonText");
  const link = read("LinkText");
  probe.remove();
  if (canvas === null || text === null || hl === null || hlText === null) return null;
  return createTheme(t, {
    borderWidth: Math.max(2, t.borderWidth),
    focusRingWidth: Math.max(3, t.focusRingWidth),
    focusRingOffset: Math.max(2, t.focusRingOffset),
    colors: {
      background: canvas,
      surface: canvas,
      surfaceHover: canvas,
      surfaceDisabled: canvas,
      border: text,
      borderHover: hl,
      borderFocus: hl,
      text,
      textMuted: text,
      textDisabled: gray ?? text,
      placeholder: gray ?? text,
      primary: hl,
      primaryHover: hl,
      primaryPressed: hl,
      primaryText: hlText,
      secondary: btnFace ?? canvas,
      secondaryHover: btnFace ?? canvas,
      secondaryText: btnText ?? text,
      error: link ?? text,
      warning: text,
      success: text,
      selection: hl,
      caret: text,
      focusRing: hl,
      track: gray ?? text,
      thumb: btnText ?? text,
      inverseSurface: text,
      inverseText: canvas,
      overlay: canvas,
      shadow: canvas
    }
  });
}
class Announcer {
  el;
  timer = 0;
  constructor(host) {
    const el = document.createElement("div");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    const s = el.style;
    s.position = "absolute";
    s.width = "1px";
    s.height = "1px";
    s.overflow = "hidden";
    s.clipPath = "inset(50%)";
    s.whiteSpace = "nowrap";
    host.appendChild(el);
    this.el = el;
  }
  announce(message, assertive = false) {
    this.el.setAttribute("aria-live", assertive ? "assertive" : "polite");
    this.el.textContent = "";
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.el.textContent = message, 50);
  }
  destroy() {
    window.clearTimeout(this.timer);
    this.el.remove();
  }
}
class FocusManager {
  constructor(proxy, onChange) {
    this.proxy = proxy;
    this.onChange = onChange;
  }
  proxy;
  onChange;
  items = [];
  focused = null;
  seq = 0;
  order = /* @__PURE__ */ new WeakMap();
  /** Set by controls during pointerdown so the background click doesn't blur them. */
  claimed = false;
  /** True while a control owns a drag (e.g. slider), so scroll views must not pan. */
  pointerCaptured = false;
  /** Set by scroll views once a touch gesture becomes a scroll; taps are then ignored. */
  gestureMoved = false;
  /** Modal handler (e.g. an open dropdown) that sees keys before the focused control. */
  keyInterceptor = null;
  /** Called when Tab/Shift+Tab leaves the form, just before the browser moves focus on. */
  onExit = null;
  get current() {
    return this.focused;
  }
  register(item) {
    if (this.items.includes(item)) return;
    this.order.set(item, this.seq++);
    this.items.push(item);
  }
  isRegistered(item) {
    return this.items.includes(item);
  }
  unregister(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    if (this.focused === item) this.blur();
  }
  focus(item, viaKeyboard = false) {
    if (!item.isFocusable()) return;
    if (this.focused === item) {
      this.attachProxy(item);
      return;
    }
    const prev = this.focused;
    this.focused = item;
    prev?.setFocused(false, viaKeyboard);
    this.attachProxy(item);
    item.setFocused(true, viaKeyboard);
    this.onChange(item, viaKeyboard);
  }
  blur() {
    const prev = this.focused;
    if (!prev) return;
    this.focused = null;
    this.keyInterceptor = null;
    this.proxy().detach();
    prev.setFocused(false, false);
    this.onChange(null, false);
  }
  next(reverse = false) {
    const list = this.sorted().filter((i) => i.isFocusable());
    if (list.length === 0) return false;
    const idx = this.focused ? list.indexOf(this.focused) : -1;
    const nextIdx = idx < 0 ? reverse ? list.length - 1 : 0 : idx + (reverse ? -1 : 1);
    if (nextIdx < 0 || nextIdx >= list.length) {
      this.onExit?.(reverse);
      this.blur();
      return false;
    }
    this.focus(list[nextIdx], true);
    return true;
  }
  /** Global key handling that runs before the focused control. */
  handleKeyDown(e) {
    if (this.keyInterceptor && this.keyInterceptor(e)) return true;
    if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey) {
      return this.next(e.shiftKey);
    }
    return false;
  }
  /** Refreshes the proxy's ARIA attributes after a control state change. */
  sync(item) {
    if (this.focused === item) this.proxy().syncAria();
  }
  attachProxy(item) {
    const b = item.view.getBounds();
    this.proxy().attach(item, { x: b.x, y: b.y, width: b.width, height: b.height });
  }
  /**
   * Tab order: positive `focusOrder` (tabIndex) first, then scene-tree order
   * (depth-first, like DOM order), so the order matches what's on screen no
   * matter when each control was created.
   */
  sorted() {
    const roots = /* @__PURE__ */ new Set();
    for (const it of this.items) {
      let n = it.view;
      while (n.parent) n = n.parent;
      roots.add(n);
    }
    const pos = /* @__PURE__ */ new Map();
    let i = 0;
    const walk = (n) => {
      pos.set(n, i++);
      for (const c of n.children) walk(c);
    };
    for (const r of roots) walk(r);
    return [...this.items].sort((a, b) => {
      const ta = a.focusOrder > 0 ? a.focusOrder : Number.MAX_SAFE_INTEGER;
      const tb = b.focusOrder > 0 ? b.focusOrder : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return pos.get(a.view) - pos.get(b.view) || this.order.get(a) - this.order.get(b);
    });
  }
}
class KeyboardProxy {
  constructor(host, hooks) {
    this.host = host;
    this.hooks = hooks;
    const el = document.createElement("input");
    el.type = "text";
    el.setAttribute("autocomplete", "off");
    el.setAttribute("autocorrect", "off");
    el.setAttribute("autocapitalize", "off");
    el.setAttribute("spellcheck", "false");
    el.setAttribute("data-lpignore", "true");
    el.setAttribute("data-1p-ignore", "true");
    el.setAttribute("data-bwignore", "true");
    el.setAttribute("data-form-type", "other");
    el.setAttribute("aria-autocomplete", "none");
    el.tabIndex = -1;
    const s = el.style;
    s.position = "fixed";
    s.left = "0px";
    s.top = "0px";
    s.width = "1px";
    s.height = "1px";
    s.padding = "0";
    s.border = "0";
    s.margin = "0";
    s.opacity = "0";
    s.pointerEvents = "none";
    s.fontSize = "16px";
    s.color = "transparent";
    s.background = "transparent";
    s.caretColor = "transparent";
    s.outline = "none";
    s.zIndex = "-1";
    host.appendChild(el);
    this.element = el;
    const id = `pixiform-proxy-${++KeyboardProxy.seq}`;
    this.helpEl = document.createElement("span");
    this.errorEl = document.createElement("span");
    this.helpEl.id = `${id}-help`;
    this.errorEl.id = `${id}-error`;
    this.helpEl.hidden = this.errorEl.hidden = true;
    host.appendChild(this.helpEl);
    host.appendChild(this.errorEl);
    this.reset();
    el.addEventListener("keydown", this.onKeyDown);
    el.addEventListener("input", this.onInput);
    el.addEventListener("compositionstart", this.onCompositionStart);
    el.addEventListener("compositionend", this.onCompositionEnd);
    el.addEventListener("paste", this.onPaste);
    el.addEventListener("copy", this.onCopy);
    el.addEventListener("cut", this.onCut);
    el.addEventListener("drop", this.block);
    el.addEventListener("dragover", this.block);
    el.addEventListener("blur", this.onBlur);
  }
  host;
  hooks;
  element;
  target = null;
  composing = false;
  suppressBlur = false;
  static SENTINEL = "​";
  static seq = 0;
  helpEl;
  errorEl;
  get current() {
    return this.target;
  }
  attach(target, screenRect) {
    this.target = target;
    const el = this.element;
    const wantType = target.secure ? "password" : "text";
    if (el.type !== wantType) el.type = wantType;
    el.inputMode = target.acceptsText ? target.inputMode : "none";
    el.enterKeyHint = target.enterKeyHint;
    el.readOnly = !target.acceptsText;
    el.setAttribute("autocomplete", target.autocomplete ?? "off");
    this.syncAria();
    if (screenRect) this.position(screenRect);
    this.reset();
    if (document.activeElement !== el) {
      this.suppressBlur = true;
      el.focus({ preventScroll: true });
      this.suppressBlur = false;
    }
  }
  detach() {
    this.target = null;
    this.reset();
    this.element.type = "text";
    this.element.setAttribute("autocomplete", "off");
    for (const a of ["aria-label", "aria-describedby", "aria-errormessage"]) this.element.removeAttribute(a);
    this.helpEl.textContent = this.errorEl.textContent = "";
    if (document.activeElement === this.element) {
      this.suppressBlur = true;
      this.element.blur();
      this.suppressBlur = false;
    }
  }
  /** Re-reads ARIA info from the target (call after state changes). */
  syncAria() {
    const t = this.target;
    const el = this.element;
    if (!t) return;
    el.setAttribute("role", t.ariaRole());
    el.setAttribute("aria-label", t.ariaLabel());
    for (const [k, v] of Object.entries(t.ariaState())) {
      if (v === null) el.removeAttribute(k);
      else el.setAttribute(k, v);
    }
    const d = t.ariaDescription?.() ?? {};
    this.helpEl.textContent = d.help ?? "";
    this.errorEl.textContent = d.error ?? "";
    const ids = [d.error ? this.errorEl.id : "", d.help ? this.helpEl.id : ""].filter(Boolean).join(" ");
    if (ids) el.setAttribute("aria-describedby", ids);
    else el.removeAttribute("aria-describedby");
    if (d.error) el.setAttribute("aria-errormessage", this.errorEl.id);
    else el.removeAttribute("aria-errormessage");
  }
  /** Keeps the IME candidate window / mobile scroll anchored at the control. */
  position(rect) {
    const host = this.host.getBoundingClientRect();
    this.element.style.left = `${Math.round(host.left + rect.x)}px`;
    this.element.style.top = `${Math.round(host.top + rect.y + rect.height - 1)}px`;
  }
  destroy() {
    this.target = null;
    this.element.remove();
    this.helpEl.remove();
    this.errorEl.remove();
  }
  reset() {
    const el = this.element;
    el.value = KeyboardProxy.SENTINEL;
    try {
      el.setSelectionRange(1, 1);
    } catch {
    }
  }
  takeValue() {
    const v = this.element.value.split(KeyboardProxy.SENTINEL).join("");
    this.reset();
    return v;
  }
  onKeyDown = (e) => {
    if (!e.isTrusted) {
      e.preventDefault();
      return;
    }
    this.hooks.onTrustedInteraction(e);
    if (this.composing || e.isComposing || e.keyCode === 229) return;
    if (this.hooks.onKeyDown(e)) {
      e.preventDefault();
      return;
    }
    if (this.target?.handleKeyDown(e)) e.preventDefault();
  };
  onInput = (e) => {
    if (!e.isTrusted) {
      this.reset();
      return;
    }
    if (this.composing || e.isComposing) return;
    const t = this.target;
    const type = e.inputType || "";
    if (!t || !t.acceptsText) {
      this.reset();
      return;
    }
    if (type.startsWith("delete")) {
      this.reset();
      t.handleDelete(type.includes("Forward") ? "forward" : "backward");
      return;
    }
    if (type === "insertLineBreak" || type === "insertParagraph") {
      this.reset();
      t.handleText("\n");
      return;
    }
    const text = this.takeValue();
    if (text) t.handleText(text);
  };
  onCompositionStart = (e) => {
    if (!e.isTrusted) return;
    this.composing = true;
  };
  onCompositionEnd = (e) => {
    this.composing = false;
    if (!e.isTrusted) {
      this.reset();
      return;
    }
    const text = this.takeValue();
    if (text && this.target?.acceptsText) this.target.handleText(text);
  };
  onPaste = (e) => {
    e.preventDefault();
    if (!e.isTrusted || !this.target?.acceptsText) return;
    this.hooks.onTrustedInteraction(e);
    const text = e.clipboardData?.getData("text/plain") ?? "";
    if (text) this.target.handlePaste(text);
  };
  onCopy = (e) => this.clipboardOut(e, false);
  onCut = (e) => this.clipboardOut(e, true);
  clipboardOut(e, cut) {
    e.preventDefault();
    if (!e.isTrusted || !this.target) return;
    const text = this.target.handleCopy(cut);
    if (text !== null && e.clipboardData) e.clipboardData.setData("text/plain", text);
  }
  block = (e) => e.preventDefault();
  onBlur = () => {
    if (this.suppressBlur) return;
    if (!document.hasFocus()) return;
    this.hooks.onBlur();
  };
}
class TextMeasurer {
  ctx;
  font = "";
  constructor() {
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
  }
  width(text, font) {
    if (!text) return 0;
    if (font !== this.font) {
      this.ctx.font = font;
      this.font = font;
    }
    return this.ctx.measureText(text).width;
  }
  /** Cumulative widths: result[i] = width of the first i code points. */
  prefixWidths(codePoints, font) {
    const out = new Array(codePoints.length + 1);
    out[0] = 0;
    let acc = "";
    for (let i = 0; i < codePoints.length; i++) {
      acc += codePoints[i];
      out[i + 1] = this.width(acc, font);
    }
    return out;
  }
}
class Tooltip extends Container {
  constructor(ui) {
    super();
    this.ui = ui;
    this.txt = new Text({ text: "" });
    this.addChild(this.bg, this.txt);
    this.visible = false;
    this.eventMode = "none";
  }
  ui;
  bg = new Graphics();
  txt;
  anchorRef = null;
  owner = null;
  get isOpen() {
    return this.visible;
  }
  /** `owner` identifies who opened it, so only they close it on pointer-out. */
  show(anchor, text, owner = anchor) {
    if (!text) return;
    const t = this.ui.theme;
    const c = t.colors;
    const screen = this.ui.app.screen;
    const maxW = Math.min(280, screen.width - 24);
    this.txt.style = {
      fontFamily: t.fontFamily.join(","),
      fontSize: t.helperFontSize + 1,
      fill: c.inverseText,
      lineHeight: Math.ceil((t.helperFontSize + 1) * t.lineHeight),
      wordWrap: true,
      wordWrapWidth: maxW - 24
    };
    this.txt.text = text.slice(0, 500);
    const w2 = Math.min(maxW, Math.ceil(this.txt.width) + 24);
    const h = Math.ceil(this.txt.height) + 16;
    const b = anchor.getBounds();
    const above = b.y - h - 10 >= 8;
    const ax = b.x + b.width / 2;
    const x = Math.round(Math.max(8, Math.min(screen.width - w2 - 8, ax - w2 / 2)));
    const y = Math.round(above ? b.y - h - 8 : b.y + b.height + 8);
    const arrowX = Math.max(12, Math.min(w2 - 12, ax - x));
    this.bg.clear().roundRect(0, 2, w2, h, 8).fill({ color: c.shadow, alpha: 0.18 }).roundRect(0, 0, w2, h, 8).fill(c.inverseSurface);
    if (above) this.bg.poly([arrowX - 6, h, arrowX + 6, h, arrowX, h + 6]).fill(c.inverseSurface);
    else this.bg.poly([arrowX - 6, 0, arrowX + 6, 0, arrowX, -6]).fill(c.inverseSurface);
    this.txt.position.set(12, 8);
    const local = this.ui.overlay.toLocal({ x, y });
    this.position.set(local.x, local.y);
    this.ui.overlay.addChild(this);
    this.anchorRef = anchor;
    this.owner = owner;
    this.visible = true;
  }
  hide(owner) {
    if (owner !== void 0 && owner !== this.owner) return;
    this.visible = false;
    this.anchorRef = null;
    this.owner = null;
  }
  toggle(anchor, text, owner = anchor) {
    if (this.visible && this.owner === owner) this.hide();
    else this.show(anchor, text, owner);
  }
  get anchor() {
    return this.anchorRef;
  }
}
class FormUI extends Container {
  app;
  focus;
  announcer;
  measurer = new TextMeasurer();
  /** Top-most layer for popups. Always rendered above `content`. */
  overlay = new Container();
  content = new Container();
  /** Shared tooltip used by info icons. */
  tooltip;
  proxy;
  host;
  _theme;
  baseTheme;
  a11yOpts;
  prefs;
  unwatchPrefs;
  dprQuery = null;
  startGuard;
  endGuard;
  /** Hidden DOM outline for screen readers (null when `a11y.outline` is false). */
  outline;
  interactionListeners = /* @__PURE__ */ new Set();
  constructor(app, opts = {}) {
    super();
    this.app = app;
    this.a11yOpts = { ...opts.a11y ?? {} };
    this.prefs = readPrefs(this.a11yOpts);
    this.baseTheme = createTheme(opts.theme ?? lightTheme, opts.themeOverrides);
    this._theme = adaptTheme(this.baseTheme, this.prefs);
    this.host = opts.host ?? app.canvas.parentElement ?? document.body;
    this.addChild(this.content, this.overlay);
    this.overlay.label = "pixiform-overlay";
    this.tooltip = new Tooltip(this);
    this.overlay.addChild(this.tooltip);
    this.on("focuschange", () => this.tooltip.hide());
    this.on("scroll", () => this.tooltip.hide());
    this.focus = new FocusManager(
      () => this.proxy,
      (current, viaKeyboard) => this.emit("focuschange", current, viaKeyboard)
    );
    this.proxy = new KeyboardProxy(this.host, {
      onBlur: () => this.focus.blur(),
      onKeyDown: (e) => this.handleGlobalKey(e) || this.focus.handleKeyDown(e),
      onTrustedInteraction: (e) => this.notifyInteraction(e)
    });
    this.announcer = new Announcer(this.host);
    app.canvas.addEventListener("mousedown", this.preventFocusSteal);
    app.canvas.addEventListener("pointerdown", this.onNativePointer, { capture: true });
    app.canvas.addEventListener("contextmenu", this.preventContextMenu);
    app.canvas.addEventListener("pointercancel", this.onPointerCancel);
    app.canvas.tabIndex = -1;
    app.canvas.setAttribute("aria-hidden", "true");
    app.canvas.addEventListener("focus", this.onCanvasFocus);
    this.startGuard = this.makeGuard(false);
    this.endGuard = this.makeGuard(true);
    this.host.insertBefore(this.startGuard, this.host.firstChild);
    this.host.appendChild(this.endGuard);
    this.focus.onExit = () => {
      this.startGuard.tabIndex = this.endGuard.tabIndex = -1;
      setTimeout(() => this.startGuard.tabIndex = this.endGuard.tabIndex = 0);
    };
    this.outline = this.a11yOpts.outline === false ? null : new A11yTree(this, this.host, () => this.formLabel());
    this.unwatchPrefs = watchPrefs(this.applyPrefs);
    this.watchZoom();
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointerdown", this.onStagePointerDown);
    if ((opts.fitVisualViewport ?? true) && window.visualViewport) {
      window.visualViewport.addEventListener("resize", this.onVisualViewport);
    }
  }
  /** F1 toggles the focused control's info tooltip; Escape closes an open tooltip. */
  handleGlobalKey(e) {
    const cur = this.focus.current;
    if (e.key === "F1" && cur?.infoText) {
      this.tooltip.toggle(cur.infoAnchor ?? cur.view, cur.infoText, cur);
      this.announcer.announce(cur.infoText);
      return true;
    }
    if (e.key === "Escape" && this.tooltip.isOpen) {
      this.tooltip.hide();
      return true;
    }
    return false;
  }
  /** True on phones/tablets (coarse primary pointer). */
  get isTouch() {
    return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  }
  /** The theme in use: the base theme adapted to the user's accessibility settings. */
  get theme() {
    return this._theme;
  }
  /** Accessibility settings currently in effect (forced colors, contrast, motion, text scale). */
  get activePrefs() {
    return this.prefs;
  }
  /** True when animations should be skipped. */
  get reducedMotion() {
    return this.prefs.reducedMotion;
  }
  setTheme(theme, overrides) {
    this.baseTheme = createTheme(theme, overrides);
    this._theme = adaptTheme(this.baseTheme, this.prefs);
    this.emit("themechange", this._theme);
  }
  /** Changes accessibility options at runtime (e.g. a "larger text" toggle). */
  setA11y(opts) {
    this.a11yOpts = { ...this.a11yOpts, ...opts };
    this.applyPrefs();
    this.outline?.schedule();
  }
  applyPrefs = () => {
    this.prefs = readPrefs(this.a11yOpts);
    this._theme = adaptTheme(this.baseTheme, this.prefs);
    this.emit("themechange", this._theme);
    this.emit("a11ychange", this.prefs);
  };
  formLabel() {
    if (this.a11yOpts.label) return this.a11yOpts.label;
    const find = (n) => {
      const t = n.a11yText?.();
      if (t?.heading && t.text) return t.text;
      for (const c of n.children) {
        const r = find(c);
        if (r) return r;
      }
      return null;
    };
    return find(this.content) ?? "Form";
  }
  makeGuard(end) {
    const g = document.createElement("span");
    g.tabIndex = 0;
    g.className = "pixiform-focus-guard";
    g.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    g.addEventListener("focus", () => {
      if (!this.focus.next(end)) g.blur();
    });
    return g;
  }
  /** Keeps the canvas sharp when the browser zoom (device pixel ratio) changes. */
  watchZoom() {
    if (this.a11yOpts.followZoom === false || typeof matchMedia !== "function") return;
    window.removeEventListener("resize", this.onZoom);
    window.addEventListener("resize", this.onZoom);
    this.dprQuery?.removeEventListener("change", this.onZoom);
    this.dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.dprQuery.addEventListener("change", this.onZoom);
  }
  onZoom = () => {
    const r = Math.min(window.devicePixelRatio || 1, 3);
    if (r === this.app.resolution) return;
    this.app.setResolution(r);
    this.watchZoom();
    this.emit("viewportchange");
  };
  get ticker() {
    return this.app.ticker;
  }
  /** Subscribe to trusted user interactions (used by BotGuard / idle timers). */
  onInteraction(fn) {
    this.interactionListeners.add(fn);
    return () => this.interactionListeners.delete(fn);
  }
  notifyInteraction(e) {
    if (!e.isTrusted) return;
    for (const fn of this.interactionListeners) fn(e);
  }
  /** Re-anchors the hidden proxy at a control (e.g. after scrolling). */
  repositionProxy(item) {
    if (this.focus.current !== item) return;
    const b = item.view.getBounds();
    this.proxy.position({ x: b.x, y: b.y, width: b.width, height: b.height });
  }
  destroy(options) {
    this.focus.blur();
    this.app.canvas.removeEventListener("mousedown", this.preventFocusSteal);
    this.app.canvas.removeEventListener("pointerdown", this.onNativePointer, { capture: true });
    this.app.canvas.removeEventListener("contextmenu", this.preventContextMenu);
    this.app.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.app.canvas.removeEventListener("focus", this.onCanvasFocus);
    this.app.stage.off("pointerdown", this.onStagePointerDown);
    window.visualViewport?.removeEventListener("resize", this.onVisualViewport);
    this.unwatchPrefs();
    this.dprQuery?.removeEventListener("change", this.onZoom);
    window.removeEventListener("resize", this.onZoom);
    this.outline?.destroy();
    this.startGuard.remove();
    this.endGuard.remove();
    this.focus.onExit = null;
    this.proxy.destroy();
    this.announcer.destroy();
    this.interactionListeners.clear();
    super.destroy(options);
  }
  onVisualViewport = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    this.host.style.height = `${Math.round(vv.height)}px`;
    this.app.resize();
    this.emit("viewportchange");
  };
  onPointerCancel = () => {
    this.focus.gestureMoved = true;
    this.focus.pointerCaptured = false;
    this.emit("gesturecancel");
  };
  preventFocusSteal = (e) => e.preventDefault();
  preventContextMenu = (e) => e.preventDefault();
  onNativePointer = (e) => {
    this.notifyInteraction(e);
    this.focus.claimed = false;
    this.focus.gestureMoved = false;
  };
  onCanvasFocus = () => {
    if (!this.focus.current) this.focus.next(false);
  };
  onStagePointerDown = (_e) => {
    if (!this.focus.claimed) this.focus.blur();
    this.focus.claimed = false;
  };
}
const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
class Control extends Container {
  ui;
  fieldName;
  focusOrder;
  validators;
  validateOn;
  required;
  customRequiredMessage;
  touched = false;
  /** Injected by Form so validators can reach sibling fields. */
  formContext = null;
  acceptsText = false;
  secure = false;
  /** Short-lived credential (e.g. OTP): wiped by Form.wipeSecrets() like secrets. */
  sensitive = false;
  inputMode = "none";
  enterKeyHint = "next";
  body = new Container();
  focusRing = new Graphics();
  labelText = null;
  infoIcon = null;
  _info;
  messageText;
  _label;
  _helper;
  _error = null;
  _errorCode = null;
  _enabled;
  _focused = false;
  _focusVisible = false;
  _hovered = false;
  _width;
  /** Inline-label controls (checkbox, toggle) draw their own label. */
  labelAbove = true;
  themeOverride;
  cachedTheme = null;
  lastHeight = 0;
  validationSeq = 0;
  constructor(ui, opts) {
    super();
    if (!SAFE_NAME.test(opts.name)) throw new Error(`Invalid control name "${opts.name}"`);
    this.ui = ui;
    this.fieldName = opts.name;
    this.label = opts.name;
    this._label = opts.label ?? "";
    this._helper = opts.helperText ?? "";
    this._info = opts.info ?? "";
    if (opts.hideLabel) this.labelAbove = false;
    this._enabled = !opts.disabled;
    this.required = !!opts.required;
    this.customRequiredMessage = opts.requiredMessage;
    this.validators = [...opts.validators ?? []];
    this.validateOn = opts.validateOn ?? "blur";
    this.themeOverride = opts.theme;
    this._width = opts.width ?? 320;
    this.focusOrder = opts.tabIndex ?? 0;
    this.messageText = new Text({ text: "", style: this.textStyle("helper") });
    this.addChild(this.body, this.messageText);
    this.body.addChild(this.focusRing);
    ui.focus.register(this);
    ui.on("themechange", this.onThemeChange, this);
  }
  // ---------------------------------------------------------------- accessors
  get view() {
    return this;
  }
  get theme() {
    if (!this.cachedTheme) this.cachedTheme = createTheme(this.ui.theme, this.themeOverride);
    return this.cachedTheme;
  }
  setThemeOverride(override) {
    this.themeOverride = override;
    this.onThemeChange();
  }
  get enabled() {
    return this._enabled;
  }
  set enabled(v) {
    if (this._enabled === v) return;
    this._enabled = v;
    if (!v && this._focused) this.ui.focus.blur();
    this.cursor = v ? this.enabledCursor() : "not-allowed";
    this.redraw();
  }
  get focused() {
    return this._focused;
  }
  get error() {
    return this._error;
  }
  /** Machine-readable reason for the current error: 'required', 'invalid', 'server' or a validator's `code`. */
  get errorCode() {
    return this._errorCode;
  }
  _invalidMark = false;
  /** Red error styling without a message (a composite parent shows the message). */
  markInvalid(flag) {
    if (flag === this._invalidMark) return;
    this._invalidMark = flag;
    this.redraw();
  }
  /** True when the control should be drawn in its error colour. */
  get hasErrorState() {
    return !!this._error || this._invalidMark;
  }
  get fieldLabel() {
    return this._label;
  }
  set fieldLabel(v) {
    this._label = v;
    this.redraw();
  }
  /** Tooltip text for the ⓘ icon ('' hides the icon). */
  get infoText() {
    return this._info;
  }
  set infoText(v) {
    this._info = v ?? "";
    if (!this._info && this.ui.tooltip.anchor === this.infoIcon) this.ui.tooltip.hide();
    this.redraw();
    this.ui.focus.sync(this);
  }
  /** What the tooltip points at (the icon, or the control itself). */
  get infoAnchor() {
    return this.infoIcon?.visible ? this.infoIcon : this;
  }
  get helperText() {
    return this._helper;
  }
  set helperText(v) {
    this._helper = v;
    this.redraw();
  }
  get layoutWidth() {
    return this._width;
  }
  get layoutHeight() {
    return this.headerHeight() + this.bodyHeight() + this.footerHeight();
  }
  layout(width) {
    this._width = Math.max(40, width);
    this.redraw();
  }
  focus() {
    this.ui.focus.focus(this, true);
  }
  blur() {
    if (this._focused) this.ui.focus.blur();
  }
  isFocusable() {
    if (!this._enabled || this.destroyed) return false;
    let node = this;
    while (node) {
      if (!node.visible || node.renderable === false) return false;
      node = node.parent;
    }
    return true;
  }
  setFocused(focused, viaKeyboard) {
    this._focused = focused;
    if (focused) this._focusVisible = viaKeyboard || this.acceptsText;
    this.onFocusChanged(focused);
    this.redraw();
    this.emit(focused ? "focus" : "blur", this);
    if (!focused) {
      this.touched = true;
      if (this.validateOn === "blur") void this.validate();
    }
  }
  // ---------------------------------------------------------------- validation
  setError(message, code) {
    const msg = message ? String(message).slice(0, 300) : null;
    const errCode = msg ? (code ?? "invalid").slice(0, 40) : null;
    if (msg === this._error && errCode === this._errorCode) return;
    this._error = msg;
    this._errorCode = errCode;
    this.redraw();
    this.ui.focus.sync(this);
    this.emit("validate", msg);
  }
  /** Runs `required` + validators. Stale async results are discarded. */
  async validate(ctx = {}) {
    const seq2 = ++this.validationSeq;
    let error = null;
    let code;
    if (this.required && this.isEmpty()) {
      error = this.requiredMessage();
      code = "required";
    } else {
      for (const v of this.validators) {
        try {
          const r = await v(this.getValue(), {
            ...this.formContext?.(),
            ...ctx,
            control: this
          });
          if (r) {
            error = r;
            code = v.code;
            break;
          }
        } catch {
          error = "Could not validate this field.";
          code = "validator-error";
          break;
        }
      }
    }
    if (seq2 !== this.validationSeq) return this._error;
    this.setError(error, code);
    return error;
  }
  /** Emits 'change' and re-validates when appropriate. */
  commitChange(emit = true) {
    if (emit) this.emit("change", this.getValue(), this);
    if (this.validateOn === "change" || this.touched && this._error) void this.validate();
  }
  requiredMessage() {
    return this.customRequiredMessage ?? `${this._label || "This field"} is required.`;
  }
  /** Securely clears sensitive memory. Overridden by secret fields. */
  wipe() {
  }
  // ---------------------------------------------------------------- KeyboardTarget
  ariaRole() {
    return "textbox";
  }
  /** Accessible name: the label (required/invalid are separate ARIA states; help and errors are descriptions). */
  ariaLabel() {
    return this._label || this.fieldName;
  }
  ariaDescription() {
    const help = [this._helper, this._info].filter(Boolean).join(". ");
    return { help: help || void 0, error: this._error ?? void 0 };
  }
  /**
   * Activates the control as Enter/Space would (used when a screen reader
   * clicks its item in the accessibility outline). Text fields just focus.
   */
  activate() {
    if (this.acceptsText || !this._enabled) return;
    const role = this.ariaRole();
    const key2 = role === "checkbox" || role === "switch" ? " " : "Enter";
    this.handleKeyDown(new KeyboardEvent("keydown", { key: key2 }));
  }
  ariaState() {
    return {
      "aria-invalid": this._error ? "true" : null,
      "aria-required": this.required ? "true" : null,
      "aria-disabled": this._enabled ? null : "true"
    };
  }
  handleKeyDown(_e) {
    return false;
  }
  handleText(_text) {
  }
  handleDelete(_direction) {
  }
  handlePaste(_text) {
  }
  handleCopy(_cut) {
    return null;
  }
  // ---------------------------------------------------------------- rendering helpers
  /** Recomputes layout and redraws everything. */
  redraw() {
    if (this.destroyed) return;
    const t = this.theme;
    const hh = this.headerHeight();
    if (this.labelAbove && this._label) {
      if (!this.labelText) {
        this.labelText = new Text({ text: "", style: this.textStyle("label") });
        this.addChild(this.labelText);
      }
      this.labelText.text = this.required ? `${this._label} *` : this._label;
      this.labelText.style = this.textStyle("label", this._enabled ? t.colors.text : t.colors.textDisabled);
      this.labelText.visible = true;
    } else if (this.labelText) {
      this.labelText.visible = false;
    }
    if (this.labelAbove) {
      const lineH = Math.ceil(t.labelFontSize * t.lineHeight);
      const x = this.labelText?.visible ? this.labelText.x + this.labelText.width + 6 : 0;
      this.placeInfo(this, x, lineH / 2);
    }
    this.body.y = hh;
    this.drawBody();
    const msg = this._error ?? this.footerMessage();
    this.messageText.text = msg;
    this.messageText.style = this.textStyle(
      "helper",
      this._error ? t.colors.error : this._enabled ? this.footerColor() ?? t.colors.textMuted : t.colors.textDisabled,
      this._width
    );
    this.messageText.visible = !!msg;
    this.messageText.y = hh + this.bodyHeight() + t.helperGap;
    const h = this.layoutHeight;
    if (h !== this.lastHeight) {
      this.lastHeight = h;
      this.emit("resize", this);
    }
  }
  footerMessage() {
    return this._helper;
  }
  /** Override to colour the helper line (e.g. warnings). */
  footerColor() {
    return null;
  }
  headerHeight() {
    if (!this.labelAbove || !this._label && !this._info) return 0;
    const t = this.theme;
    return Math.ceil(t.labelFontSize * t.lineHeight) + t.labelGap;
  }
  footerHeight() {
    const msg = this._error ?? this.footerMessage();
    if (!msg) return 0;
    const t = this.theme;
    this.messageText.style.wordWrapWidth = this._width;
    return t.helperGap + Math.ceil(Math.max(this.messageText.height, t.helperFontSize * t.lineHeight));
  }
  textStyle(kind, fill, wrapWidth) {
    const t = this.theme;
    const size = kind === "label" ? t.labelFontSize : kind === "helper" ? t.helperFontSize : t.fontSize;
    return {
      fontFamily: t.fontFamily.join(","),
      fontSize: size,
      fontWeight: kind === "label" ? t.labelFontWeight : t.fontWeight,
      fill: fill ?? (kind === "helper" ? t.colors.textMuted : t.colors.text),
      lineHeight: Math.ceil(size * t.lineHeight),
      wordWrap: !!wrapWidth,
      wordWrapWidth: wrapWidth ?? 0,
      breakWords: !!wrapWidth
    };
  }
  /** Width taken by the info icon when present (for inline-label layouts). */
  infoIconSpace() {
    return this._info ? 22 : 0;
  }
  /**
   * Places the ⓘ icon inside `parent` with its left edge at `x`, vertically
   * centred on `cy`. Built-in controls call this; custom inline-label controls can too.
   */
  placeInfo(parent, x, cy) {
    if (!this._info) {
      if (this.infoIcon) this.infoIcon.visible = false;
      return;
    }
    if (!this.infoIcon) this.infoIcon = this.createInfoIcon();
    if (this.infoIcon.parent !== parent) parent.addChild(this.infoIcon);
    const t = this.theme;
    const r = Math.round(Math.max(6.5, t.labelFontSize * 0.55));
    const hovered = this.ui.tooltip.isOpen && this.ui.tooltip.anchor === this.infoIcon;
    const color = !this._enabled ? t.colors.textDisabled : hovered ? t.colors.primary : t.colors.textMuted;
    const g = this.infoIcon.clear();
    g.circle(0, 0, r).stroke({ width: 1.4, color });
    g.circle(0, -r * 0.42, r * 0.14).fill(color);
    g.roundRect(-r * 0.11, -r * 0.12, r * 0.22, r * 0.62, r * 0.1).fill(color);
    g.position.set(Math.round(x + r), Math.round(cy));
    g.hitArea = new Circle(0, 0, r + 8);
    g.visible = true;
  }
  createInfoIcon() {
    const g = new Graphics();
    g.eventMode = "static";
    g.cursor = "help";
    const show = () => {
      this.ui.tooltip.show(g, this._info, g);
      this.redraw();
    };
    const hide = () => {
      this.ui.tooltip.hide(g);
      this.redraw();
    };
    g.on("pointerover", (e) => e.pointerType === "mouse" && show());
    g.on("pointerout", (e) => e.pointerType === "mouse" && hide());
    g.on("pointerdown", (e) => {
      this.ui.focus.claimed = true;
      e.stopPropagation();
    });
    g.on("pointertap", (e) => {
      e.stopPropagation();
      if (e.pointerType !== "mouse") {
        this.ui.tooltip.toggle(g, this._info, g);
        this.redraw();
      }
    });
    return g;
  }
  /** Draws a rounded focus ring around a body-local rectangle. */
  drawFocus(x, y, w2, h, r) {
    const t = this.theme;
    const g = this.focusRing.clear();
    if (!this._focused || !this._focusVisible) return;
    const o = t.focusRingOffset + t.focusRingWidth / 2;
    g.roundRect(x - o, y - o, w2 + o * 2, h + o * 2, r + o).stroke({
      width: t.focusRingWidth,
      color: this._error ? t.colors.error : t.colors.focusRing,
      alpha: 0.85
    });
  }
  enabledCursor() {
    return "pointer";
  }
  /**
   * Flutter-style tap handling: fires `onTap` on pointer up, but not if the
   * touch turned into a scroll. Mouse focuses on press; touch focuses on tap
   * (so scrolling past a field never pops up the keyboard).
   */
  bindTap(target, onTap) {
    target.on("pointerdown", (e) => {
      this.ui.focus.claimed = true;
      if (e.pointerType === "mouse" && this._enabled) this.ui.focus.focus(this, false);
    });
    target.on("pointertap", (e) => {
      if (this.ui.focus.gestureMoved || !this._enabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.pointerType !== "mouse") this.ui.focus.focus(this, false);
      onTap(e);
    });
  }
  /** Call from pointerdown handlers so the stage doesn't blur this control. */
  claimFocus() {
    this.ui.focus.claimed = true;
    if (this._enabled) this.ui.focus.focus(this, false);
  }
  onFocusChanged(_focused) {
  }
  onThemeChange() {
    this.cachedTheme = null;
    this.redraw();
  }
  destroy(options) {
    this.wipe();
    this.ui.focus.unregister(this);
    this.ui.off("themechange", this.onThemeChange, this);
    super.destroy(options ?? { children: true });
  }
}
const Icons = {
  check(g, cx, cy, s, color, width = 2, progress = 1) {
    const k = s / 24;
    const p0 = { x: cx - 7 * k, y: cy + 0.5 * k };
    const p1 = { x: cx - 2.5 * k, y: cy + 5 * k };
    const p2 = { x: cx + 7.5 * k, y: cy - 5.5 * k };
    const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const d = (l1 + l2) * Math.max(0, Math.min(1, progress));
    if (d <= 0) return g;
    g.moveTo(p0.x, p0.y);
    if (d <= l1) {
      const t = d / l1;
      g.lineTo(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t);
    } else {
      const t = (d - l1) / l2;
      g.lineTo(p1.x, p1.y).lineTo(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t);
    }
    return g.stroke({ width: width * k * 1.2, color, cap: "round", join: "round" });
  },
  dash(g, cx, cy, s, color) {
    const k = s / 24;
    return g.moveTo(cx - 6 * k, cy).lineTo(cx + 6 * k, cy).stroke({ width: 2.4 * k, color, cap: "round" });
  },
  close(g, cx, cy, s, color) {
    const k = s / 24;
    const a = 5.5 * k;
    return g.moveTo(cx - a, cy - a).lineTo(cx + a, cy + a).moveTo(cx + a, cy - a).lineTo(cx - a, cy + a).stroke({ width: 2 * k, color, cap: "round" });
  },
  /** Eye / eye-off (password visibility). */
  eye(g, cx, cy, s, color, off) {
    const k = s / 24;
    g.moveTo(cx - 10 * k, cy).quadraticCurveTo(cx, cy - 10.5 * k, cx + 10 * k, cy).quadraticCurveTo(cx, cy + 10.5 * k, cx - 10 * k, cy).closePath().stroke({ width: 1.8 * k, color, join: "round" });
    g.circle(cx, cy, 3.2 * k).fill(color);
    if (off) {
      g.moveTo(cx - 9 * k, cy - 8 * k).lineTo(cx + 9 * k, cy + 8 * k).stroke({ width: 1.8 * k, color, cap: "round" });
    }
    return g;
  },
  chevron(g, cx, cy, s, color, up = false) {
    const k = s / 24;
    const dy = up ? -1 : 1;
    return g.moveTo(cx - 5 * k, cy - 2.5 * k * dy).lineTo(cx, cy + 2.5 * k * dy).lineTo(cx + 5 * k, cy - 2.5 * k * dy).stroke({ width: 2 * k, color, cap: "round", join: "round" });
  },
  errorCircle(g, cx, cy, s, color) {
    const k = s / 24;
    g.circle(cx, cy, 10 * k).fill(color);
    g.roundRect(cx - 1.1 * k, cy - 6 * k, 2.2 * k, 7.5 * k, 1 * k).fill(16777215);
    g.circle(cx, cy + 4.6 * k, 1.3 * k).fill(16777215);
    return g;
  },
  lock(g, cx, cy, s, color) {
    const k = s / 24;
    g.roundRect(cx - 7 * k, cy - 2 * k, 14 * k, 11 * k, 2 * k).fill(color);
    g.moveTo(cx - 4.5 * k, cy - 2 * k).lineTo(cx - 4.5 * k, cy - 5 * k).arc(cx, cy - 5 * k, 4.5 * k, Math.PI, 0).lineTo(cx + 4.5 * k, cy - 2 * k).stroke({ width: 2 * k, color });
    return g;
  },
  calendar(g, cx, cy, s, color) {
    const k = s / 24;
    g.roundRect(cx - 8 * k, cy - 6.5 * k, 16 * k, 15 * k, 2.5 * k).stroke({ width: 1.8 * k, color });
    g.moveTo(cx - 8 * k, cy - 2 * k).lineTo(cx + 8 * k, cy - 2 * k).stroke({ width: 1.8 * k, color });
    g.moveTo(cx - 4 * k, cy - 9 * k).lineTo(cx - 4 * k, cy - 5 * k).moveTo(cx + 4 * k, cy - 9 * k).lineTo(cx + 4 * k, cy - 5 * k).stroke({ width: 1.8 * k, color, cap: "round" });
    for (const [dx, dy] of [[-4, 2], [0, 2], [4, 2], [-4, 5.5], [0, 5.5]]) g.circle(cx + dx * k, cy + dy * k, 1.1 * k).fill(color);
    return g;
  },
  arrow(g, cx, cy, s, color, dir) {
    const k = s / 24;
    const pts = { left: [3, -6, -3, 0, 3, 6], right: [-3, -6, 3, 0, -3, 6], up: [-6, 3, 0, -3, 6, 3], down: [-6, -3, 0, 3, 6, -3] }[dir];
    return g.moveTo(cx + pts[0] * k, cy + pts[1] * k).lineTo(cx + pts[2] * k, cy + pts[3] * k).lineTo(cx + pts[4] * k, cy + pts[5] * k).stroke({ width: 2 * k, color, cap: "round", join: "round" });
  },
  sun(g, cx, cy, s, color) {
    const k = s / 24;
    g.circle(cx, cy, 4.5 * k).fill(color);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.moveTo(cx + Math.cos(a) * 7.5 * k, cy + Math.sin(a) * 7.5 * k).lineTo(cx + Math.cos(a) * 10 * k, cy + Math.sin(a) * 10 * k);
    }
    return g.stroke({ width: 2 * k, color, cap: "round" });
  },
  moon(g, cx, cy, s, color) {
    const k = s / 24;
    const a0 = -Math.PI * 0.35;
    return g.moveTo(cx + Math.cos(a0) * 8.5 * k, cy + Math.sin(a0) * 8.5 * k).arc(cx, cy, 8.5 * k, a0, Math.PI * 1.35).arc(cx + 4 * k, cy - 3.5 * k, 7 * k, Math.PI * 0.95, -Math.PI * 0.15, true).closePath().fill(color);
  }
};
class SecureBuffer {
  data;
  len = 0;
  constructor(capacity = 32) {
    this.data = new Uint32Array(Math.max(8, capacity));
  }
  get length() {
    return this.len;
  }
  at(index) {
    return index >= 0 && index < this.len ? this.data[index] : 0;
  }
  /** Inserts code points at `index`. */
  insert(index, codePoints) {
    const n = codePoints.length;
    if (n === 0) return;
    index = clamp$1(index, 0, this.len);
    this.ensure(this.len + n);
    this.data.copyWithin(index + n, index, this.len);
    for (let i = 0; i < n; i++) this.data[index + i] = codePoints[i];
    this.len += n;
  }
  /** Removes the half-open range [start, end). */
  delete(start, end) {
    start = clamp$1(start, 0, this.len);
    end = clamp$1(end, start, this.len);
    if (end === start) return;
    this.data.copyWithin(start, end, this.len);
    const newLen = this.len - (end - start);
    this.data.fill(0, newLen, this.len);
    this.len = newLen;
  }
  /** Replaces the whole content. */
  set(codePoints) {
    this.wipe();
    this.insert(0, codePoints);
  }
  /** Builds a string for [start, end). Avoid on secret buffers except for explicit reveal. */
  toString(start = 0, end = this.len) {
    start = clamp$1(start, 0, this.len);
    end = clamp$1(end, start, this.len);
    let out = "";
    const CHUNK = 4096;
    for (let i = start; i < end; i += CHUNK) {
      out += String.fromCodePoint(...this.data.subarray(i, Math.min(end, i + CHUNK)));
    }
    return out;
  }
  /** Constant-time (w.r.t. content) equality check. */
  equals(other) {
    const max = Math.max(this.len, other.len);
    let diff = this.len ^ other.len;
    for (let i = 0; i < max; i++) diff |= this.at(i) ^ other.at(i);
    return diff === 0;
  }
  /** Visits code points without allocating a string. */
  forEach(fn) {
    for (let i = 0; i < this.len; i++) fn(this.data[i], i);
  }
  /**
   * UTF-8 encodes the content into a new byte array without creating a JS
   * string. The caller owns the result and should `fill(0)` it after use.
   */
  toUtf8() {
    let size = 0;
    for (let i = 0; i < this.len; i++) {
      const cp = this.data[i];
      size += cp < 128 ? 1 : cp < 2048 ? 2 : cp < 65536 ? 3 : 4;
    }
    const out = new Uint8Array(size);
    let o = 0;
    for (let i = 0; i < this.len; i++) {
      const cp = this.data[i];
      if (cp < 128) out[o++] = cp;
      else if (cp < 2048) {
        out[o++] = 192 | cp >> 6;
        out[o++] = 128 | cp & 63;
      } else if (cp < 65536) {
        out[o++] = 224 | cp >> 12;
        out[o++] = 128 | cp >> 6 & 63;
        out[o++] = 128 | cp & 63;
      } else {
        out[o++] = 240 | cp >> 18;
        out[o++] = 128 | cp >> 12 & 63;
        out[o++] = 128 | cp >> 6 & 63;
        out[o++] = 128 | cp & 63;
      }
    }
    return out;
  }
  wipe() {
    this.data.fill(0);
    this.len = 0;
  }
  ensure(capacity) {
    if (capacity <= this.data.length) return;
    let next = this.data.length;
    while (next < capacity) next *= 2;
    const grown = new Uint32Array(next);
    grown.set(this.data.subarray(0, this.len));
    this.data.fill(0);
    this.data = grown;
  }
}
function toCodePoints(text) {
  const out = [];
  for (const ch of text) out.push(ch.codePointAt(0));
  return out;
}
function clamp$1(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
const BIDI_CONTROLS = /[؜‎‏‪-‮⁦-⁩]/g;
const INVISIBLE_CHARS = /[­᠎​‌⁠-⁤﻿￹-￻]/g;
const LONE_SURROGATES = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const MAX_RAW_INPUT = 2e4;
function sanitizeInput(raw, opts = {}) {
  if (typeof raw !== "string" || raw.length === 0) return "";
  let s = raw.length > MAX_RAW_INPUT ? raw.slice(0, MAX_RAW_INPUT) : raw;
  s = s.replace(/\r\n?/g, "\n");
  s = s.replace(LONE_SURROGATES, "");
  s = s.replace(CONTROL_CHARS, "");
  s = s.replace(BIDI_CONTROLS, "");
  s = s.replace(INVISIBLE_CHARS, "");
  s = s.replace(/\t/g, opts.multiline ? "    " : " ");
  if (!opts.multiline) s = s.replace(/\n+/g, " ");
  const form = opts.normalize ?? "NFC";
  if (form) s = s.normalize(form);
  if (opts.allow) {
    const re = new RegExp(opts.allow.source, opts.allow.flags.replace(/[gy]/g, ""));
    let filtered = "";
    for (const ch of s) if (ch === "\n" || re.test(ch)) filtered += ch;
    s = filtered;
  }
  if (opts.maxCodePoints !== void 0) {
    if (opts.maxCodePoints <= 0) return "";
    let count = 0;
    let end = 0;
    for (const ch of s) {
      if (count === opts.maxCodePoints) break;
      count++;
      end += ch.length;
    }
    s = s.slice(0, end);
  }
  return s;
}
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const WORD_CHAR = /[\p{L}\p{N}_]/u;
const HISTORY_LIMIT = 100;
class TextField extends Control {
  acceptsText = true;
  inputMode;
  enterKeyHint;
  buf = new SecureBuffer();
  caret = 0;
  anchor = 0;
  multiline;
  rows;
  maxLength;
  allow;
  normalizeForm;
  readOnly;
  placeholder;
  showCounter;
  /** Draw content as mask characters (password fields). */
  masked = false;
  obscuringCharacter = "•";
  /** Index of a character temporarily shown in clear in a masked field (-1 = none). */
  revealIndex = -1;
  formatters;
  selectable;
  /** Extra width reserved on the right of the box (e.g. reveal button). */
  trailingWidth = 0;
  box = new Graphics();
  textLayer = new Container();
  scroller = new Container();
  clip = new Graphics();
  selection = new Graphics();
  caretGfx = new Graphics();
  placeholderText;
  counterText;
  linePool = [];
  lines = [];
  layoutDirty = true;
  scrollX = 0;
  scrollY = 0;
  goalX = null;
  blinkElapsed = 0;
  dragging = false;
  lastClickTime = 0;
  clickCount = 0;
  undoStack = [];
  redoStack = [];
  lastEdit = null;
  constructor(ui, opts) {
    super(ui, opts);
    this.multiline = !!opts.multiline;
    this.rows = Math.max(2, opts.rows ?? 4);
    this.maxLength = Math.max(1, Math.min(opts.maxLength ?? (this.multiline ? 2e3 : 256), 2e4));
    this.allow = opts.allow;
    this.normalizeForm = opts.normalize ?? "NFC";
    this.readOnly = !!opts.readOnly;
    this.placeholder = opts.placeholder ?? "";
    this.showCounter = !!opts.showCounter;
    this.formatters = [...opts.formatters ?? []];
    this.selectable = opts.enableInteractiveSelection ?? true;
    this.inputMode = opts.inputMode ?? "text";
    this.enterKeyHint = opts.enterKeyHint ?? (this.multiline ? "enter" : "next");
    this.placeholderText = new Text({ text: "", style: this.textStyle("body") });
    this.counterText = new Text({ text: "", style: this.textStyle("helper") });
    this.scroller.addChild(this.selection, this.caretGfx);
    this.textLayer.addChild(this.clip, this.placeholderText, this.scroller);
    this.scroller.mask = this.clip;
    this.body.addChildAt(this.box, 0);
    this.body.addChild(this.textLayer);
    this.addChild(this.counterText);
    this.body.eventMode = "static";
    this.body.cursor = "text";
    this.body.on("pointerdown", this.onPointerDown, this);
    this.body.on("pointertap", this.onTouchTap, this);
    this.body.on("globalpointermove", this.onPointerMove, this);
    this.body.on("pointerup", this.onPointerUp, this);
    this.body.on("pointerupoutside", this.onPointerUp, this);
    this.body.on("pointerover", () => this.setHover(true));
    this.body.on("pointerout", () => this.setHover(false));
  }
  // ---------------------------------------------------------------- public API
  get length() {
    return this.buf.length;
  }
  isEmpty() {
    return this.buf.length === 0;
  }
  /** Selected range as [start, end). */
  getSelection() {
    return this.caret < this.anchor ? [this.caret, this.anchor] : [this.anchor, this.caret];
  }
  setSelection(start, end = start) {
    if (!this.selectable) start = end;
    this.anchor = clamp(start, 0, this.buf.length);
    this.caret = clamp(end, 0, this.buf.length);
    this.selectionChanged();
  }
  selectAll() {
    this.setSelection(0, this.buf.length);
  }
  reset() {
    this.buf.wipe();
    this.caret = this.anchor = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.scrollX = this.scrollY = 0;
    this.setError(null);
    this.touched = false;
    this.contentChanged(false);
  }
  wipe() {
    this.buf.wipe();
    this.caret = this.anchor = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.layoutDirty = true;
  }
  /** Replaces content programmatically (sanitised, length-limited). */
  setText(text, emit) {
    const clean = sanitizeInput(text, this.sanitizeOpts(this.maxLength));
    this.buf.set(toCodePoints(clean));
    this.caret = this.anchor = this.buf.length;
    this.undoStack = [];
    this.redoStack = [];
    this.contentChanged(emit);
  }
  // ---------------------------------------------------------------- KeyboardTarget
  ariaRole() {
    return "textbox";
  }
  ariaState() {
    return {
      ...super.ariaState(),
      "aria-multiline": this.multiline ? "true" : null,
      "aria-readonly": this.readOnly ? "true" : null,
      "aria-placeholder": this.placeholder || null
    };
  }
  handleText(text) {
    if (text === "\n" && !this.multiline) {
      this.emit("submit", this);
      return;
    }
    this.replaceSelection(text, "insert");
  }
  handlePaste(text) {
    this.replaceSelection(text, "paste");
  }
  handleDelete(direction) {
    this.deleteDirection(direction, false);
  }
  handleCopy(cut) {
    if (!this.selectable) return null;
    const [s, e] = this.getSelection();
    if (s === e) return null;
    const text = this.buf.toString(s, e);
    if (cut && !this.readOnly) this.deleteRange(s, e, "cut");
    return text;
  }
  handleKeyDown(e) {
    const mod = IS_MAC ? e.metaKey : e.ctrlKey;
    const word = IS_MAC ? e.altKey : e.ctrlKey;
    const shift = e.shiftKey;
    const [s, en] = this.getSelection();
    const hasSel = s !== en;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowRight": {
        const left = e.key === "ArrowLeft";
        let target;
        if (hasSel && !shift && !word && !(IS_MAC && e.metaKey)) target = left ? s : en;
        else if (IS_MAC && e.metaKey) target = left ? this.lineStart(this.caret) : this.lineEnd(this.caret);
        else if (word) target = left ? this.wordLeft(this.caret) : this.wordRight(this.caret);
        else target = this.caret + (left ? -1 : 1);
        this.moveCaret(target, shift);
        return true;
      }
      case "ArrowUp":
      case "ArrowDown": {
        if (!this.multiline) {
          if (!IS_MAC) return false;
          this.moveCaret(e.key === "ArrowUp" ? 0 : this.buf.length, shift);
          return true;
        }
        if (mod) {
          this.moveCaret(e.key === "ArrowUp" ? 0 : this.buf.length, shift);
          return true;
        }
        this.moveVertical(e.key === "ArrowUp" ? -1 : 1, shift);
        return true;
      }
      case "Home":
      case "End": {
        const home = e.key === "Home";
        const target = e.ctrlKey || !this.multiline ? home ? 0 : this.buf.length : home ? this.lineStart(this.caret) : this.lineEnd(this.caret);
        this.moveCaret(target, shift);
        return true;
      }
      case "PageUp":
      case "PageDown":
        if (!this.multiline) return false;
        this.moveVertical((e.key === "PageUp" ? -1 : 1) * this.rows, shift);
        return true;
      case "Backspace":
      case "Delete": {
        const dir = e.key === "Backspace" ? "backward" : "forward";
        if (IS_MAC && e.metaKey && dir === "backward" && !hasSel) {
          this.deleteRange(this.lineStart(this.caret), this.caret, "delete");
        } else {
          this.deleteDirection(dir, word);
        }
        return true;
      }
      case "Enter":
        if (!this.multiline || mod) {
          this.emit("submit", this);
          return true;
        }
        this.replaceSelection("\n", "insert");
        return true;
      case "Escape":
        if (hasSel) {
          this.setSelection(this.caret);
          return true;
        }
        return false;
    }
    if (mod && !e.altKey) {
      switch (e.key.toLowerCase()) {
        case "a":
          if (!this.selectable) return true;
          this.selectAll();
          return true;
        case "z":
          if (shift) this.redo();
          else this.undo();
          return true;
        case "y":
          if (!IS_MAC) {
            this.redo();
            return true;
          }
          return false;
      }
    }
    return false;
  }
  // ---------------------------------------------------------------- editing
  sanitizeOpts(maxCodePoints) {
    return { multiline: this.multiline, allow: this.allow, maxCodePoints, normalize: this.normalizeForm };
  }
  replaceSelection(text, kind) {
    if (this.readOnly || !this._enabled) return;
    const [s, e] = this.getSelection();
    const room = this.maxLength - (this.buf.length - (e - s));
    let formatted = text;
    if (this.formatters.length) {
      const ctx = this.secure ? { before: "", after: "" } : { before: this.buf.toString(0, s), after: this.buf.toString(e) };
      for (const f of this.formatters) formatted = f(formatted, ctx);
    }
    const clean = sanitizeInput(formatted, this.sanitizeOpts(room));
    if (!clean) {
      if (room <= 0) this.ui.announcer.announce(`Maximum of ${this.maxLength} characters reached.`);
      return;
    }
    this.pushHistory(kind === "insert" && clean.length === 1 && clean !== " " ? "type" : kind);
    const cps = toCodePoints(clean);
    this.buf.delete(s, e);
    this.buf.insert(s, cps);
    this.caret = this.anchor = s + cps.length;
    this.onInserted(s, cps.length);
    this.contentChanged(true);
  }
  /** Hook: called after characters are inserted at `index`. */
  onInserted(_index, _count) {
  }
  deleteDirection(dir, word) {
    const [s, e] = this.getSelection();
    if (s !== e) {
      this.deleteRange(s, e, "delete");
      return;
    }
    const target = dir === "backward" ? word ? this.wordLeft(this.caret) : this.caret - 1 : word ? this.wordRight(this.caret) : this.caret + 1;
    const a = clamp(Math.min(target, this.caret), 0, this.buf.length);
    const b = clamp(Math.max(target, this.caret), 0, this.buf.length);
    this.deleteRange(a, b, "delete");
  }
  deleteRange(start, end, kind) {
    if (this.readOnly || !this._enabled || start === end) return;
    this.pushHistory(kind);
    this.buf.delete(start, end);
    this.caret = this.anchor = start;
    this.contentChanged(true);
  }
  /** Secret fields never keep undo history (it would retain old secrets). */
  get keepsHistory() {
    return !this.secure;
  }
  pushHistory(kind) {
    if (!this.keepsHistory) return;
    const now = performance.now();
    const coalesce = this.lastEdit && this.lastEdit.kind === kind && kind !== "paste" && now - this.lastEdit.time < 1e3;
    this.lastEdit = { kind, time: now };
    this.redoStack = [];
    if (coalesce) return;
    this.undoStack.push({ text: this.buf.toString(), caret: this.caret, anchor: this.anchor });
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
  }
  undo() {
    this.restore(this.undoStack, this.redoStack);
  }
  redo() {
    this.restore(this.redoStack, this.undoStack);
  }
  restore(from, to) {
    if (!this.keepsHistory || this.readOnly) return;
    const snap = from.pop();
    if (!snap) return;
    to.push({ text: this.buf.toString(), caret: this.caret, anchor: this.anchor });
    this.buf.set(toCodePoints(snap.text));
    this.caret = snap.caret;
    this.anchor = snap.anchor;
    this.lastEdit = null;
    this.contentChanged(true);
  }
  // ---------------------------------------------------------------- navigation
  moveCaret(index, extend, keepGoal = false) {
    this.caret = clamp(index, 0, this.buf.length);
    if (!extend || !this.selectable) this.anchor = this.caret;
    if (!keepGoal) this.goalX = null;
    this.selectionChanged();
  }
  moveVertical(deltaLines, extend) {
    this.ensureLayout();
    const { x, line } = this.caretPos(this.caret);
    if (this.goalX === null) this.goalX = x;
    const target = line + deltaLines;
    if (target < 0) return this.moveCaret(0, extend, true);
    if (target >= this.lines.length) return this.moveCaret(this.buf.length, extend, true);
    this.moveCaret(this.indexInLine(target, this.goalX), extend, true);
  }
  isWord(i) {
    return WORD_CHAR.test(String.fromCodePoint(this.buf.at(i)));
  }
  wordLeft(i) {
    if (this.masked) return 0;
    while (i > 0 && !this.isWord(i - 1)) i--;
    while (i > 0 && this.isWord(i - 1)) i--;
    return i;
  }
  wordRight(i) {
    const n = this.buf.length;
    if (this.masked) return n;
    while (i < n && !this.isWord(i)) i++;
    while (i < n && this.isWord(i)) i++;
    return i;
  }
  wordAt(i) {
    if (this.masked) return [0, this.buf.length];
    let a = i;
    let b = i;
    const n = this.buf.length;
    if (i < n && this.isWord(i)) {
      while (a > 0 && this.isWord(a - 1)) a--;
      while (b < n && this.isWord(b)) b++;
    } else if (i < n) {
      b = i + 1;
    }
    return [a, b];
  }
  lineStart(i) {
    this.ensureLayout();
    return this.lines[this.lineOf(i)].start;
  }
  lineEnd(i) {
    this.ensureLayout();
    const li = this.lineOf(i);
    const line = this.lines[li];
    const next = this.lines[li + 1];
    if (next && next.start === line.end && line.end > line.start) return line.end - 1;
    return line.end;
  }
  // ---------------------------------------------------------------- layout
  get lineHeight() {
    const t = this.theme;
    return Math.ceil(t.fontSize * t.lineHeight);
  }
  innerWidth() {
    return Math.max(10, this._width - this.theme.paddingX * 2 - this.trailingWidth);
  }
  innerHeight() {
    return this.multiline ? this.rows * this.lineHeight : this.lineHeight;
  }
  bodyHeight() {
    const t = this.theme;
    return this.multiline ? this.innerHeight() + t.paddingY * 2 : t.controlHeight;
  }
  displayChars() {
    const n = this.buf.length;
    if (this.masked) {
      const out2 = new Array(n).fill(this.obscuringCharacter);
      if (this.revealIndex >= 0 && this.revealIndex < n) out2[this.revealIndex] = String.fromCodePoint(this.buf.at(this.revealIndex));
      return out2;
    }
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = String.fromCodePoint(this.buf.at(i));
    return out;
  }
  ensureLayout() {
    if (!this.layoutDirty) return;
    this.layoutDirty = false;
    const chars = this.displayChars();
    const font = cssFont(this.theme);
    const m = this.ui.measurer;
    const mk = (start, end) => {
      const slice = chars.slice(start, end);
      return { start, end, text: slice.join(""), widths: m.prefixWidths(slice, font) };
    };
    this.lines = [];
    if (!this.multiline) {
      this.lines.push(mk(0, chars.length));
      return;
    }
    const maxW = this.innerWidth();
    let p = 0;
    for (; ; ) {
      let pEnd = chars.indexOf("\n", p);
      if (pEnd < 0) pEnd = chars.length;
      let ls = p;
      for (; ; ) {
        let e = ls;
        let acc = "";
        let lastSpace = -1;
        while (e < pEnd) {
          const ch = chars[e];
          if (ch !== " " && e > ls && m.width(acc + ch, font) > maxW) break;
          acc += ch;
          if (ch === " ") lastSpace = e;
          e++;
        }
        if (e >= pEnd) {
          this.lines.push(mk(ls, pEnd));
          break;
        }
        const brk = lastSpace >= ls ? lastSpace + 1 : e;
        this.lines.push(mk(ls, brk));
        ls = brk;
      }
      if (pEnd >= chars.length) break;
      p = pEnd + 1;
    }
  }
  lineOf(index) {
    let lo = 0;
    let hi = this.lines.length - 1;
    while (lo < hi) {
      const mid = lo + hi + 1 >> 1;
      if (this.lines[mid].start <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
  caretPos(index) {
    const li = this.lineOf(index);
    const line = this.lines[li];
    const x = line.widths[clamp(index - line.start, 0, line.widths.length - 1)];
    return { x, y: li * this.lineHeight, line: li };
  }
  indexInLine(li, x) {
    const line = this.lines[li];
    const w2 = line.widths;
    let best = 0;
    for (let j = 1; j < w2.length; j++) {
      if (Math.abs(w2[j] - x) < Math.abs(w2[best] - x)) best = j;
      else if (w2[j] > x) break;
    }
    const next = this.lines[li + 1];
    if (next && next.start === line.end && best === w2.length - 1 && best > 0) best--;
    return line.start + best;
  }
  indexAtPoint(x, y) {
    this.ensureLayout();
    const li = clamp(Math.floor(y / this.lineHeight), 0, this.lines.length - 1);
    return this.indexInLine(li, x);
  }
  scrollToCaret() {
    this.ensureLayout();
    const { x, y } = this.caretPos(this.caret);
    const iw = this.innerWidth();
    const ih = this.innerHeight();
    if (this.multiline) {
      this.scrollX = 0;
      if (y < this.scrollY) this.scrollY = y;
      if (y + this.lineHeight > this.scrollY + ih) this.scrollY = y + this.lineHeight - ih;
      const maxY = Math.max(0, this.lines.length * this.lineHeight - ih);
      this.scrollY = clamp(this.scrollY, 0, maxY);
    } else {
      const total = this.lines[0].widths[this.lines[0].widths.length - 1];
      if (x - this.scrollX > iw - 2) this.scrollX = x - iw + 2;
      if (x < this.scrollX) this.scrollX = Math.max(0, x - iw * 0.25);
      this.scrollX = clamp(this.scrollX, 0, Math.max(0, total - iw + 2));
      this.scrollY = 0;
    }
  }
  // ---------------------------------------------------------------- change plumbing
  contentChanged(emit) {
    this.layoutDirty = true;
    this.goalX = null;
    this.blinkElapsed = 0;
    this.scrollToCaret();
    this.redraw();
    if (emit) {
      this.emit("input", this);
      this.commitChange(true);
    }
  }
  selectionChanged() {
    this.blinkElapsed = 0;
    this.scrollToCaret();
    this.drawBody();
  }
  layout(width) {
    this.layoutDirty = true;
    super.layout(width);
    this.scrollToCaret();
    this.drawBody();
  }
  onFocusChanged(focused) {
    if (focused) {
      this.blinkElapsed = 0;
      this.ui.ticker.add(this.tick, this);
    } else {
      this.ui.ticker.remove(this.tick, this);
      this.dragging = false;
      this.anchor = this.caret;
    }
  }
  tick(ticker) {
    this.blinkElapsed += ticker.deltaMS;
    const [s, e] = this.getSelection();
    const on = s === e && Math.floor(this.blinkElapsed / this.theme.caretBlinkMs) % 2 === 0;
    this.caretGfx.visible = this._focused && on;
  }
  setHover(v) {
    if (this._hovered === v) return;
    this._hovered = v;
    this.drawBody();
  }
  // ---------------------------------------------------------------- pointer
  onPointerDown(e) {
    if (!this._enabled) return;
    if (e.pointerType === "touch") {
      this.ui.focus.claimed = true;
      return;
    }
    this.claimFocus();
    this.placeFromPointer(e);
  }
  onTouchTap(e) {
    if (e.pointerType !== "touch" || !this._enabled || this.ui.focus.gestureMoved) return;
    this.claimFocus();
    this.placeFromPointer(e);
  }
  placeFromPointer(e) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (this.handleTrailingClick(e)) return;
    const now = performance.now();
    this.clickCount = now - this.lastClickTime < 350 ? this.clickCount + 1 : 1;
    this.lastClickTime = now;
    const p = e.getLocalPosition(this.scroller);
    const idx = this.indexAtPoint(p.x, p.y);
    if (!this.selectable) {
      this.moveCaret(idx, false);
    } else if (this.clickCount === 2) {
      const [a, b] = this.wordAt(idx);
      this.setSelection(a, b);
    } else if (this.clickCount >= 3) {
      this.selectAll();
    } else {
      this.moveCaret(idx, e.shiftKey);
      this.dragging = e.pointerType !== "touch";
      if (this.dragging) this.ui.focus.pointerCaptured = true;
    }
  }
  onPointerMove(e) {
    if (!this.dragging) return;
    const p = e.getLocalPosition(this.scroller);
    this.moveCaret(this.indexAtPoint(p.x, p.y), true);
  }
  onPointerUp() {
    if (this.dragging) this.ui.focus.pointerCaptured = false;
    this.dragging = false;
  }
  /** Lets subclasses handle clicks on the trailing area (returns true if consumed). */
  handleTrailingClick(_e) {
    return false;
  }
  enabledCursor() {
    return "text";
  }
  // ---------------------------------------------------------------- drawing
  footerMessage() {
    return this._helper || (this.showCounter ? " " : "");
  }
  redraw() {
    super.redraw();
    if (this.destroyed || !this.counterText) return;
    const t = this.theme;
    this.counterText.visible = this.showCounter;
    if (this.showCounter) {
      const n = this.buf.length;
      this.counterText.text = `${n}/${this.maxLength}`;
      this.counterText.style = this.textStyle("helper", n >= this.maxLength ? t.colors.warning : t.colors.textMuted);
      this.counterText.x = this._width - this.counterText.width;
      this.counterText.y = this.messageText.y;
      this.messageText.style.wordWrapWidth = Math.max(10, this._width - this.counterText.width - 12);
    }
  }
  drawBody() {
    if (!this.placeholderText) return;
    const t = this.theme;
    const c = t.colors;
    const w2 = this._width;
    const h = this.bodyHeight();
    this.ensureLayout();
    this.body.hitArea = new Rectangle(0, 0, w2, h);
    const border = !this._enabled ? c.border : this.hasErrorState ? c.error : this._focused ? c.borderFocus : this._hovered ? c.borderHover : c.border;
    const fill = !this._enabled ? c.surfaceDisabled : this._hovered && !this._focused ? c.surfaceHover : c.surface;
    this.box.clear().roundRect(0, 0, w2, h, t.radius).fill({ color: fill }).stroke({ width: this._focused ? t.borderWidth + 0.5 : t.borderWidth, color: border, alignment: 1 });
    this.drawFocus(0, 0, w2, h, t.radius);
    const lh = this.lineHeight;
    const iw = this.innerWidth();
    const ih = this.innerHeight();
    this.textLayer.x = t.paddingX;
    this.textLayer.y = this.multiline ? t.paddingY : Math.round((h - lh) / 2);
    this.clip.clear().rect(-2, -1, iw + 4, ih + 2).fill(16777215);
    this.scroller.x = -this.scrollX;
    this.scroller.y = -this.scrollY;
    const empty = this.buf.length === 0;
    this.placeholderText.visible = empty && !!this.placeholder;
    if (this.placeholderText.visible) {
      this.placeholderText.text = this.placeholder;
      this.placeholderText.style = this.textStyle("body", c.placeholder);
    }
    const textColor = this._enabled ? c.text : c.textDisabled;
    const first = Math.max(0, Math.floor(this.scrollY / lh));
    const last = Math.min(this.lines.length - 1, Math.ceil((this.scrollY + ih) / lh));
    let used = 0;
    const style2 = this.textStyle("body", textColor);
    for (let li = first; li <= last; li++) {
      const line = this.lines[li];
      if (!line.text) continue;
      let txt = this.linePool[used];
      if (!txt) {
        txt = new Text({ text: "", style: style2 });
        this.linePool.push(txt);
        this.scroller.addChild(txt);
      }
      txt.style = style2;
      txt.text = line.text;
      txt.x = 0;
      txt.y = li * lh;
      txt.visible = true;
      used++;
    }
    for (let i = used; i < this.linePool.length; i++) this.linePool[i].visible = false;
    const [s, e] = this.getSelection();
    this.selection.clear();
    if (s !== e) {
      const ls = this.lineOf(s);
      const le = this.lineOf(e);
      for (let li = ls; li <= le; li++) {
        const line = this.lines[li];
        const a = Math.max(s, line.start);
        const b = Math.min(e, line.end);
        const x0 = line.widths[a - line.start];
        let x1 = line.widths[b - line.start];
        if (li < le && x1 - x0 < 4) x1 = x0 + 4;
        this.selection.rect(x0, li * lh, Math.max(1, x1 - x0), lh);
      }
      this.selection.fill({ color: c.selection, alpha: this._focused ? 1 : 0.5 });
    }
    const cp = this.caretPos(this.caret);
    const caretH = Math.min(lh, Math.round(t.fontSize * 1.25));
    this.caretGfx.clear().rect(Math.round(cp.x), cp.y + (lh - caretH) / 2, t.caretWidth, caretH).fill(c.caret);
    this.caretGfx.visible = this._focused && s === e;
    this.drawTrailing(w2, h);
  }
  /** Hook for subclasses to draw in the trailing area. */
  drawTrailing(_w, _h) {
  }
  destroy(options) {
    this.ui.ticker.remove(this.tick, this);
    super.destroy(options);
  }
}
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
class TextInput extends TextField {
  initial;
  constructor(ui, opts) {
    super(ui, { ...opts, multiline: false });
    this.initial = opts.value ?? "";
    if (this.initial) this.setText(this.initial, false);
    this.redraw();
  }
  getValue() {
    return this.buf.toString();
  }
  setValue(value, emit = true) {
    this.setText(String(value ?? ""), emit);
  }
  reset() {
    super.reset();
    if (this.initial) this.setText(this.initial, false);
  }
}
class TextArea extends TextField {
  initial;
  constructor(ui, opts) {
    super(ui, { ...opts, multiline: true });
    this.initial = opts.value ?? "";
    if (this.initial) this.setText(this.initial, false);
    this.redraw();
  }
  getValue() {
    return this.buf.toString();
  }
  setValue(value, emit = true) {
    this.setText(String(value ?? ""), emit);
  }
  reset() {
    super.reset();
    if (this.initial) this.setText(this.initial, false);
  }
}
class Secret {
  #buffer;
  constructor(buffer) {
    this.#buffer = buffer;
  }
  get length() {
    return this.#buffer.length;
  }
  get isEmpty() {
    return this.#buffer.length === 0;
  }
  /** Exposes the plain text to `fn` only. Do not store or log it. */
  use(fn) {
    return fn(this.#buffer.toString());
  }
  /** UTF-8 bytes without creating a string. Zero the result with `fill(0)` after use. */
  toUtf8() {
    return this.#buffer.toUtf8();
  }
  /** Constant-time comparison that never creates strings. */
  equals(other) {
    return this.#buffer.equals(other.#buffer);
  }
  /** Counts code points matching a predicate without creating strings. */
  count(predicate) {
    let n = 0;
    this.#buffer.forEach((cp) => {
      if (predicate(cp)) n++;
    });
    return n;
  }
  toString() {
    return "[Secret]";
  }
  toJSON() {
    return "[Secret]";
  }
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")]() {
    return "[Secret]";
  }
}
class PasswordInput extends TextField {
  secure = true;
  secret;
  eye = new Graphics();
  showToggle;
  revealTimeoutMs;
  revealLast;
  revealLastMs;
  allowPaste;
  capsWarning;
  revealed = false;
  revealTimer = 0;
  lastCharTimer = 0;
  capsLock = false;
  constructor(ui, opts) {
    super(ui, { maxLength: 128, ...opts, multiline: false, normalize: opts.normalize ?? "NFKC" });
    this.secret = new Secret(this.buf);
    this.masked = true;
    this.showToggle = opts.showVisibilityToggle ?? true;
    this.revealTimeoutMs = opts.revealTimeoutMs ?? 1e4;
    const auto = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    this.revealLast = opts.revealLastChar === "auto" || opts.revealLastChar === void 0 ? auto : opts.revealLastChar;
    this.revealLastMs = opts.revealLastCharMs ?? 1e3;
    const oc = [...opts.obscuringCharacter ?? "•"][0] ?? "•";
    this.obscuringCharacter = oc;
    this.allowPaste = opts.allowPaste ?? true;
    this.capsWarning = opts.capsLockWarning ?? true;
    this.trailingWidth = this.showToggle ? 36 : 0;
    this.body.addChild(this.eye);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.redraw();
  }
  /** Opaque handle; call `secret.use(plain => ...)` only when submitting. */
  getValue() {
    return this.secret;
  }
  setValue(value, emit = true) {
    if (value === this.secret) return;
    if (value.isEmpty) {
      this.wipe();
      this.contentChanged(emit);
      return;
    }
    value.use((plain) => this.setText(plain, emit));
  }
  get isRevealed() {
    return this.revealed;
  }
  setRevealed(v) {
    if (v === this.revealed) return;
    this.revealed = v;
    this.masked = !v;
    this.revealIndex = -1;
    window.clearTimeout(this.revealTimer);
    if (v && this.revealTimeoutMs > 0) {
      this.revealTimer = window.setTimeout(() => this.setRevealed(false), this.revealTimeoutMs);
    }
    this.layoutDirty = true;
    this.drawBody();
    this.ui.announcer.announce(v ? "Password visible" : "Password hidden");
  }
  wipe() {
    window.clearTimeout(this.lastCharTimer);
    this.revealIndex = -1;
    super.wipe();
    if (this.revealed) this.setRevealed(false);
  }
  reset() {
    this.wipe();
    super.reset();
  }
  // -------------------------------------------------------- input overrides
  handleCopy(_cut) {
    this.ui.announcer.announce("Copying is disabled for this field.");
    return null;
  }
  handlePaste(text) {
    if (!this.allowPaste) {
      this.ui.announcer.announce("Pasting is disabled for this field.");
      return;
    }
    super.handlePaste(text);
  }
  handleKeyDown(e) {
    if (this.capsWarning && typeof e.getModifierState === "function") {
      const caps = e.getModifierState("CapsLock");
      if (caps !== this.capsLock) {
        this.capsLock = caps;
        this.redraw();
        if (caps) this.ui.announcer.announce("Caps Lock is on");
      }
    }
    return super.handleKeyDown(e);
  }
  onInserted(index, count) {
    window.clearTimeout(this.lastCharTimer);
    if (!this.revealLast || this.revealed || count !== 1) {
      this.revealIndex = -1;
      return;
    }
    this.revealIndex = index;
    this.lastCharTimer = window.setTimeout(() => {
      this.revealIndex = -1;
      this.layoutDirty = true;
      this.drawBody();
    }, this.revealLastMs);
  }
  ariaState() {
    return { ...super.ariaState(), "aria-roledescription": "password" };
  }
  onFocusChanged(focused) {
    super.onFocusChanged(focused);
    if (!focused) {
      this.setRevealed(false);
      this.revealIndex = -1;
      this.layoutDirty = true;
    }
  }
  footerMessage() {
    if (this.capsLock && this._focused) return "Caps Lock is on";
    return super.footerMessage();
  }
  footerColor() {
    return this.capsLock && this._focused ? this.theme.colors.warning : null;
  }
  // -------------------------------------------------------- drawing
  handleTrailingClick(e) {
    if (!this.showToggle) return false;
    const p = e.getLocalPosition(this.body);
    if (p.x < this._width - this.trailingWidth - 4) return false;
    this.setRevealed(!this.revealed);
    return true;
  }
  drawTrailing(w2, h) {
    if (!this.eye) return;
    const g = this.eye.clear();
    if (!this.showToggle) return;
    const c = this.theme.colors;
    Icons.eye(g, w2 - 22, h / 2, 20, this._enabled ? c.textMuted : c.textDisabled, !this.revealed);
  }
  destroy(options) {
    window.clearTimeout(this.revealTimer);
    window.clearTimeout(this.lastCharTimer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    super.destroy(options);
  }
  onVisibility = () => {
    if (document.hidden) this.setRevealed(false);
  };
}
function approach(current, target, speed, deltaMS) {
  const k = 1 - Math.pow(1 - Math.min(0.99, Math.max(0.01, speed)), deltaMS / 16.67);
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 1e-3 ? target : next;
}
class Checkbox extends Control {
  checked;
  initial;
  indeterminate;
  progress;
  animating = false;
  box = new Graphics();
  mark = new Graphics();
  inlineLabel;
  constructor(ui, opts) {
    super(ui, opts);
    this.labelAbove = false;
    this.checked = this.initial = !!opts.checked;
    this.indeterminate = !!opts.indeterminate;
    this.progress = this.checked || this.indeterminate ? 1 : 0;
    this.inlineLabel = new Text({ text: "", style: this.textStyle("body") });
    this.body.addChild(this.box, this.mark, this.inlineLabel);
    this.body.eventMode = "static";
    this.body.cursor = this._enabled ? "pointer" : "not-allowed";
    this.bindTap(this.body, () => this.toggle());
    this.body.on("pointerover", () => this.setHover(true));
    this.body.on("pointerout", () => this.setHover(false));
    this.redraw();
  }
  getValue() {
    return this.checked;
  }
  setValue(v, emit = true) {
    v = !!v;
    if (v === this.checked && !this.indeterminate) return;
    this.checked = v;
    this.indeterminate = false;
    this.animate();
    this.ui.focus.sync(this);
    this.commitChange(emit);
  }
  toggle() {
    if (!this._enabled) return;
    this.setValue(!this.checked);
  }
  isEmpty() {
    return !this.checked;
  }
  reset() {
    this.checked = this.initial;
    this.progress = this.checked ? 1 : 0;
    this.touched = false;
    this.setError(null);
    this.redraw();
  }
  ariaRole() {
    return "checkbox";
  }
  ariaState() {
    return { ...super.ariaState(), "aria-checked": this.indeterminate ? "mixed" : String(this.checked) };
  }
  handleKeyDown(e) {
    if (e.key === " " || e.key === "Spacebar") {
      this.toggle();
      return true;
    }
    return false;
  }
  bodyHeight() {
    const t = this.theme;
    return Math.max(t.checkboxSize, this.inlineLabel ? this.labelHeight() : 0);
  }
  labelHeight() {
    if (!this._label) return 0;
    this.inlineLabel.style.wordWrapWidth = this.labelWidth();
    return Math.ceil(this.inlineLabel.height);
  }
  labelWidth() {
    return Math.max(20, this._width - this.theme.checkboxSize - 12 - this.infoIconSpace());
  }
  setHover(v) {
    this._hovered = v;
    this.drawBody();
  }
  animate() {
    if (this.animating) return;
    this.animating = true;
    this.ui.ticker.add(this.tick, this);
  }
  tick(t) {
    const target = this.checked || this.indeterminate ? 1 : 0;
    this.progress = approach(this.progress, target, this.theme.animationSpeed, t.deltaMS);
    this.drawBody();
    if (this.progress === target) {
      this.ui.ticker.remove(this.tick, this);
      this.animating = false;
    }
  }
  drawBody() {
    if (!this.inlineLabel) return;
    const t = this.theme;
    const c = t.colors;
    const s = t.checkboxSize;
    const text = this.required ? `${this._label} *` : this._label;
    this.inlineLabel.text = text;
    this.inlineLabel.style = this.textStyle("body", this._enabled ? c.text : c.textDisabled, this.labelWidth());
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
    if (on && this._enabled && this._hovered) this.box.roundRect(0, by, s, s, Math.min(6, t.radius / 2)).fill({ color: 0, alpha: 0.08 });
    this.mark.clear();
    if (this.indeterminate) Icons.dash(this.mark, s / 2, by + s / 2, s, c.primaryText);
    else if (p > 0.01) Icons.check(this.mark, s / 2, by + s / 2, s, c.primaryText, 2.2, p);
    this.mark.alpha = Math.min(1, p * 1.5);
    this.drawFocus(0, by, s, s, Math.min(6, t.radius / 2));
    this.placeInfo(this.body, this.inlineLabel.x + this.inlineLabel.width + 6, by + s / 2);
    this.body.hitArea = new Rectangle(-4, -4, Math.min(this._width, s + 16 + this.inlineLabel.width + this.infoIconSpace()) + 8, h + 8);
  }
  destroy(options) {
    this.ui.ticker.remove(this.tick, this);
    super.destroy(options);
  }
}
class Switch extends Control {
  isOn;
  initial;
  pos;
  animating = false;
  track = new Graphics();
  thumb = new Graphics();
  title;
  desc;
  description;
  constructor(ui, opts) {
    super(ui, opts);
    this.labelAbove = false;
    this.isOn = this.initial = !!opts.value;
    this.pos = this.isOn ? 1 : 0;
    this.description = opts.description ?? "";
    this.title = new Text({ text: "", style: this.textStyle("body") });
    this.desc = new Text({ text: "", style: this.textStyle("helper") });
    this.body.addChild(this.title, this.desc, this.track, this.thumb);
    this.body.eventMode = "static";
    this.body.cursor = "pointer";
    this.bindTap(this.body, () => this.toggle());
    this.body.on("pointerover", () => (this._hovered = true, this.drawBody()));
    this.body.on("pointerout", () => (this._hovered = false, this.drawBody()));
    this.redraw();
  }
  getValue() {
    return this.isOn;
  }
  setValue(v, emit = true) {
    if (!!v === this.isOn) return;
    this.isOn = !!v;
    this.startAnim();
    this.ui.focus.sync(this);
    this.commitChange(emit);
  }
  toggle() {
    if (this._enabled) this.setValue(!this.isOn);
  }
  isEmpty() {
    return !this.isOn;
  }
  reset() {
    this.isOn = this.initial;
    this.pos = this.isOn ? 1 : 0;
    this.touched = false;
    this.setError(null);
    this.redraw();
  }
  ariaRole() {
    return "switch";
  }
  ariaState() {
    return { ...super.ariaState(), "aria-checked": String(this.isOn) };
  }
  handleKeyDown(e) {
    if (e.key === " " || e.key === "Enter") {
      this.toggle();
      return true;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      this.setValue(e.key === "ArrowRight");
      return true;
    }
    return false;
  }
  textWidth() {
    return Math.max(20, this._width - this.theme.toggleWidth - 16 - this.infoIconSpace());
  }
  bodyHeight() {
    if (!this.title) return this.theme.toggleHeight;
    this.title.style.wordWrapWidth = this.textWidth();
    this.desc.style.wordWrapWidth = this.textWidth();
    const th = (this._label ? this.title.height : 0) + (this.description ? this.desc.height + 2 : 0);
    return Math.max(this.theme.toggleHeight, Math.ceil(th));
  }
  startAnim() {
    if (this.animating) return;
    this.animating = true;
    this.ui.ticker.add(this.tick, this);
  }
  tick(t) {
    const target = this.isOn ? 1 : 0;
    this.pos = approach(this.pos, target, this.theme.animationSpeed, t.deltaMS);
    this.drawBody();
    if (this.pos === target) {
      this.ui.ticker.remove(this.tick, this);
      this.animating = false;
    }
  }
  drawBody() {
    if (!this.title) return;
    const t = this.theme;
    const c = t.colors;
    const tw = this.textWidth();
    this.title.text = this.required ? `${this._label} *` : this._label;
    this.title.style = this.textStyle("body", this._enabled ? c.text : c.textDisabled, tw);
    this.desc.text = this.description;
    this.desc.style = this.textStyle("helper", this._enabled ? c.textMuted : c.textDisabled, tw);
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
    const pad2 = 3;
    const r = H / 2 - pad2;
    const cx = x + pad2 + r + (W - 2 * pad2 - 2 * r) * p;
    this.thumb.clear().circle(cx, y + H / 2 + 1, r).fill({ color: c.shadow, alpha: 0.18 }).circle(cx, y + H / 2, r).fill(this._enabled ? c.thumb : c.textDisabled);
    this.drawFocus(x, y, W, H, H / 2);
    const lineH = Math.ceil(t.fontSize * t.lineHeight);
    this.placeInfo(this.body, Math.min(this.title.width, this.textWidth()) + 6, Math.min(lineH, this.title.height || lineH) / 2);
    this.body.hitArea = new Rectangle(0, 0, this._width, h);
  }
  destroy(options) {
    this.ui.ticker.remove(this.tick, this);
    super.destroy(options);
  }
}
class RadioGroup extends Control {
  options;
  initial;
  value;
  active = 0;
  hoverIndex = -1;
  direction;
  items = [];
  animating = false;
  height_ = 0;
  constructor(ui, opts) {
    super(ui, opts);
    this.options = opts.options.map((o) => ({ ...o }));
    this.direction = opts.direction ?? "vertical";
    this.value = this.initial = this.isValid(opts.value) ? opts.value : null;
    this.active = Math.max(0, this.options.findIndex((o) => o.value === this.value));
    for (let i = 0; i < this.options.length; i++) {
      const root = new Container();
      const ring = new Graphics();
      const text = new Text({ text: "", style: this.textStyle("body") });
      root.addChild(ring, text);
      root.eventMode = "static";
      root.cursor = this.options[i].disabled ? "not-allowed" : "pointer";
      this.bindTap(root, () => this.select(i));
      root.on("pointerover", () => (this.hoverIndex = i, this.drawBody()));
      root.on("pointerout", () => (this.hoverIndex = -1, this.drawBody()));
      this.body.addChild(root);
      this.items.push({ root, ring, text, dot: this.options[i].value === this.value ? 1 : 0, x: 0, y: 0, w: 0 });
    }
    this.redraw();
  }
  getValue() {
    return this.value;
  }
  setValue(v, emit = true) {
    if (v !== null && !this.isValid(v)) return;
    if (v === this.value) return;
    this.value = v;
    const idx = this.options.findIndex((o) => o.value === v);
    if (idx >= 0) this.active = idx;
    this.startAnim();
    this.ui.focus.sync(this);
    this.commitChange(emit);
  }
  isEmpty() {
    return this.value === null;
  }
  reset() {
    this.value = this.initial;
    this.items.forEach((it, i) => it.dot = this.options[i].value === this.value ? 1 : 0);
    this.touched = false;
    this.setError(null);
    this.redraw();
  }
  isValid(v) {
    return this.options.some((o) => o.value === v && !o.disabled);
  }
  select(i) {
    if (!this._enabled || this.options[i]?.disabled) return;
    this.active = i;
    this.setValue(this.options[i].value);
  }
  ariaRole() {
    return "radiogroup";
  }
  ariaLabel() {
    const cur = this.options.find((o) => o.value === this.value);
    return `${super.ariaLabel()}${cur ? `, selected ${cur.label}` : ", nothing selected"}`;
  }
  handleKeyDown(e) {
    const n = this.options.length;
    const step = (dir) => {
      for (let k = 1; k <= n; k++) {
        const i = (this.active + dir * k + n) % n;
        if (!this.options[i].disabled) return this.select(i);
      }
    };
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        step(1);
        return true;
      case "ArrowUp":
      case "ArrowLeft":
        step(-1);
        return true;
      case " ":
        this.select(this.active);
        return true;
    }
    return false;
  }
  bodyHeight() {
    return this.height_;
  }
  startAnim() {
    if (this.animating) return;
    this.animating = true;
    this.ui.ticker.add(this.tick, this);
  }
  tick(t) {
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
  redraw() {
    this.measure();
    super.redraw();
  }
  /** Positions the items (wrapping rows in horizontal mode). */
  measure() {
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
      it.text.style = this.textStyle("body", disabled ? t.colors.textDisabled : t.colors.text);
      it.w = s + 10 + it.text.width;
      if (this.direction === "horizontal") {
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
    this.height_ = this.items.length === 0 ? 0 : this.direction === "horizontal" ? y + rowH : y - gapY;
  }
  drawBody() {
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
      it.ring.clear().circle(s / 2, cy, s / 2 - 1).fill(disabled ? c.surfaceDisabled : c.surface).stroke({ width: selected ? 2 : t.borderWidth, color: border });
      if (it.dot > 0.01) it.ring.circle(s / 2, cy, (s / 2 - 5) * it.dot).fill(disabled ? c.textDisabled : accent);
      it.text.position.set(s + 10, (rowH - it.text.height) / 2);
      if (i === this.active && this._focused && this._focusVisible) {
        const o2 = t.focusRingOffset + t.focusRingWidth / 2;
        this.focusRing.circle(it.x + s / 2, it.y + cy, s / 2 + o2).stroke({ width: t.focusRingWidth, color: this._error ? c.error : c.focusRing, alpha: 0.85 });
      }
    });
  }
  destroy(options) {
    this.ui.ticker.remove(this.tick, this);
    super.destroy(options);
  }
}
class Select extends Control {
  options;
  initial;
  value;
  placeholder;
  formatSelected;
  menuWidth;
  formatOption;
  box = new Graphics();
  chevron = new Graphics();
  valueText;
  open = false;
  highlight = -1;
  scrollTop = 0;
  menu = new Container();
  catcher = new Graphics();
  panel = new Graphics();
  list = new Container();
  listMask = new Graphics();
  itemTexts = [];
  itemBg = new Graphics();
  typeahead = "";
  typeaheadTimer = 0;
  menuAbove = false;
  menuDrag = null;
  constructor(ui, opts) {
    super(ui, opts);
    this.options = opts.options.map((o) => ({ ...o }));
    this.placeholder = opts.placeholder ?? "Select…";
    this.formatSelected = opts.formatSelected;
    this.menuWidth = opts.menuWidth;
    this.formatOption = opts.formatOption;
    this.value = this.initial = this.isValid(opts.value) ? opts.value : null;
    this.valueText = new Text({ text: "", style: this.textStyle("body") });
    this.body.addChildAt(this.box, 0);
    this.body.addChild(this.valueText, this.chevron);
    this.body.eventMode = "static";
    this.body.cursor = "pointer";
    this.bindTap(this.body, () => this.setOpen(!this.open));
    this.body.on("pointerover", () => (this._hovered = true, this.drawBody()));
    this.body.on("pointerout", () => (this._hovered = false, this.drawBody()));
    this.catcher.eventMode = "static";
    this.catcher.on("pointerdown", () => {
      this.ui.focus.claimed = true;
      this.setOpen(false);
    });
    this.list.mask = this.listMask;
    this.list.addChild(this.itemBg);
    this.menu.addChild(this.catcher, this.panel, this.listMask, this.list);
    this.panel.eventMode = "static";
    this.panel.on("pointerdown", (e) => {
      this.ui.focus.claimed = true;
      e.stopPropagation();
    });
    this.list.eventMode = "static";
    this.list.on("pointermove", (e) => this.hoverAt(e));
    this.list.on("pointertap", (e) => {
      this.ui.focus.claimed = true;
      if (this.menuDrag?.moved) return;
      const i = this.indexAt(e);
      if (i >= 0) this.choose(i);
    });
    this.list.on("pointerdown", (e) => {
      this.ui.focus.claimed = true;
      this.menuDrag = { y: e.global.y, moved: false };
      e.stopPropagation();
    });
    this.list.on("globalpointermove", (e) => {
      const d = this.menuDrag;
      if (!d || !this.open || e.pointerType === "mouse") return;
      const dy = e.global.y - d.y;
      if (!d.moved && Math.abs(dy) < 6) return;
      d.moved = true;
      d.y = e.global.y;
      this.scrollBy(-dy);
    });
    this.list.on("pointerup", () => setTimeout(() => this.menuDrag = null));
    this.list.on("pointerupoutside", () => this.menuDrag = null);
    this.menu.on("wheel", (e) => {
      this.scrollBy(e.deltaY);
      e.preventDefault();
      e.stopPropagation();
    });
    this.menu.eventMode = "static";
    this.redraw();
  }
  getValue() {
    return this.value;
  }
  setValue(v, emit = true) {
    if (v !== null && !this.isValid(v)) return;
    if (v === this.value) return;
    this.value = v;
    this.drawBody();
    this.ui.focus.sync(this);
    this.commitChange(emit);
  }
  isEmpty() {
    return this.value === null;
  }
  reset() {
    this.setOpen(false);
    this.value = this.initial;
    this.touched = false;
    this.setError(null);
    this.redraw();
  }
  get isOpen() {
    return this.open;
  }
  isValid(v) {
    return this.options.some((o) => o.value === v && !o.disabled);
  }
  // ------------------------------------------------------------ open / close
  setOpen(v) {
    if (v === this.open || v && !this._enabled) return;
    this.open = v;
    if (v) {
      this.highlight = Math.max(0, this.options.findIndex((o) => o.value === this.value));
      this.ensureVisible(this.highlight, true);
      this.ui.overlay.addChild(this.menu);
      this.ui.focus.keyInterceptor = this.menuKeys;
      this.ui.ticker.add(this.followAnchor, this);
      this.drawMenu();
    } else {
      this.menu.parent?.removeChild(this.menu);
      if (this.ui.focus.keyInterceptor === this.menuKeys) this.ui.focus.keyInterceptor = null;
      this.ui.ticker.remove(this.followAnchor, this);
    }
    this.ui.focus.sync(this);
    this.drawBody();
  }
  choose(i) {
    const o = this.options[i];
    if (!o || o.disabled) return;
    this.setValue(o.value);
    this.setOpen(false);
  }
  // ------------------------------------------------------------ keyboard
  ariaRole() {
    return "combobox";
  }
  ariaLabel() {
    const cur = this.options.find((o) => o.value === this.value);
    return `${super.ariaLabel()}, ${cur ? cur.label : "nothing selected"}`;
  }
  ariaState() {
    return { ...super.ariaState(), "aria-expanded": String(this.open), "aria-haspopup": "listbox" };
  }
  handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (e.key.startsWith("Arrow") && !e.altKey) {
        this.stepValue(e.key === "ArrowDown" ? 1 : -1);
        return true;
      }
      this.setOpen(true);
      return true;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const i = this.findTypeahead(e.key);
      if (i >= 0) this.setValue(this.options[i].value);
      return true;
    }
    return false;
  }
  stepValue(dir) {
    const n = this.options.length;
    let i = this.options.findIndex((o) => o.value === this.value);
    for (let k = 0; k < n; k++) {
      i = Math.min(n - 1, Math.max(0, i + dir));
      if (!this.options[i].disabled) return this.setValue(this.options[i].value);
    }
  }
  menuKeys = (e) => {
    if (!this.open) return false;
    const n = this.options.length;
    const move = (to, dir) => {
      let i = to;
      for (let k = 0; k < n && this.options[i]?.disabled; k++) i = Math.min(n - 1, Math.max(0, i + dir));
      this.highlight = i;
      this.ensureVisible(i);
      this.drawMenu();
    };
    switch (e.key) {
      case "ArrowDown":
        move(Math.min(n - 1, this.highlight + 1), 1);
        return true;
      case "ArrowUp":
        move(Math.max(0, this.highlight - 1), -1);
        return true;
      case "Home":
        move(0, 1);
        return true;
      case "End":
        move(n - 1, -1);
        return true;
      case "Enter":
      case " ":
        this.choose(this.highlight);
        return true;
      case "Escape":
        this.setOpen(false);
        return true;
      case "Tab":
        this.setOpen(false);
        return false;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const i = this.findTypeahead(e.key);
      if (i >= 0) move(i, 1);
      return true;
    }
    return false;
  };
  findTypeahead(ch) {
    window.clearTimeout(this.typeaheadTimer);
    this.typeahead += ch.toLowerCase();
    this.typeaheadTimer = window.setTimeout(() => this.typeahead = "", 700);
    return this.options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(this.typeahead));
  }
  // ------------------------------------------------------------ menu geometry
  visibleCount() {
    return Math.min(this.options.length, this.theme.dropdownMaxVisible);
  }
  menuHeight() {
    return this.visibleCount() * this.theme.dropdownItemHeight + 8;
  }
  maxScroll() {
    return Math.max(0, this.options.length * this.theme.dropdownItemHeight - (this.menuHeight() - 8));
  }
  scrollBy(dy) {
    this.scrollTop = Math.min(this.maxScroll(), Math.max(0, this.scrollTop + dy));
    this.drawMenu();
  }
  ensureVisible(i, center = false) {
    const ih = this.theme.dropdownItemHeight;
    const vh = this.menuHeight() - 8;
    if (center) this.scrollTop = i * ih - vh / 2 + ih / 2;
    else if (i * ih < this.scrollTop) this.scrollTop = i * ih;
    else if ((i + 1) * ih > this.scrollTop + vh) this.scrollTop = (i + 1) * ih - vh;
    this.scrollTop = Math.min(this.maxScroll(), Math.max(0, this.scrollTop));
  }
  indexAt(e) {
    const p = e.getLocalPosition(this.list);
    const i = Math.floor((p.y + this.scrollTop - 4) / this.theme.dropdownItemHeight);
    return i >= 0 && i < this.options.length ? i : -1;
  }
  hoverAt(e) {
    const i = this.indexAt(e);
    if (i !== this.highlight && i >= 0) {
      this.highlight = i;
      this.drawMenu();
    }
  }
  followAnchor(_t) {
    if (!this.open) return;
    if (!this.isFocusable()) return this.setOpen(false);
    this.positionMenu();
  }
  positionMenu() {
    const b = this.body.getBounds();
    const screen = this.ui.app.screen;
    const mh = this.menuHeight();
    const below = b.y + b.height + 4;
    this.menuAbove = below + mh > screen.height - 8 && b.y - mh - 4 > 8;
    const mx = Math.max(8, Math.min(b.x, screen.width - this.menuW() - 8));
    const local = this.ui.overlay.toLocal({ x: mx, y: this.menuAbove ? b.y - mh - 4 : below });
    this.panel.position.set(local.x, local.y);
    this.list.position.set(local.x, local.y);
    this.listMask.position.set(local.x, local.y);
    const origin = this.ui.overlay.toLocal({ x: 0, y: 0 });
    this.catcher.clear().rect(origin.x, origin.y, screen.width, screen.height).fill({ color: 0, alpha: 1e-3 });
  }
  menuW() {
    return Math.min(Math.max(this._width, this.menuWidth ?? 0), this.ui.app.screen.width - 16);
  }
  drawMenu() {
    const t = this.theme;
    const c = t.colors;
    const w2 = this.menuW();
    const mh = this.menuHeight();
    const ih = t.dropdownItemHeight;
    this.positionMenu();
    this.panel.clear().roundRect(0, 6, w2, mh, t.radius).fill({ color: c.shadow, alpha: 0.12 }).roundRect(0, 0, w2, mh, t.radius).fill(c.surface).stroke({ width: 1, color: c.border, alignment: 1 });
    this.listMask.clear().roundRect(0, 4, w2, mh - 8, 2).fill(16777215);
    this.list.hitArea = new Rectangle(0, 4, w2, mh - 8);
    this.itemBg.clear();
    while (this.itemTexts.length < this.options.length) {
      const tx = new Text({ text: "", style: this.textStyle("body") });
      this.itemTexts.push(tx);
      this.list.addChild(tx);
    }
    this.options.forEach((o, i) => {
      const y = 4 + i * ih - this.scrollTop;
      const selected = o.value === this.value;
      if (i === this.highlight && !o.disabled) this.itemBg.rect(4, y, w2 - 8, ih).fill({ color: c.primary, alpha: 0.1 });
      if (selected) this.itemBg.rect(4, y + 8, 3, ih - 16).fill(c.primary);
      const tx = this.itemTexts[i];
      tx.text = this.formatOption ? this.formatOption(o) : o.label;
      tx.style = { ...this.textStyle("body", o.disabled ? c.textDisabled : selected ? c.primary : c.text), fontWeight: selected ? "600" : t.fontWeight };
      tx.position.set(t.paddingX, y + (ih - tx.height) / 2);
      tx.visible = y + ih > 0 && y < mh;
    });
    if (this.maxScroll() > 0) {
      const vh = mh - 8;
      const total = this.options.length * ih;
      const barH = Math.max(24, vh * vh / total);
      const barY = 4 + this.scrollTop / this.maxScroll() * (vh - barH);
      this.itemBg.roundRect(w2 - 6, barY, 3, barH, 1.5).fill({ color: c.textMuted, alpha: 0.5 });
    }
  }
  // ------------------------------------------------------------ closed state
  bodyHeight() {
    return this.theme.controlHeight;
  }
  onFocusChanged(focused) {
    if (!focused) this.setOpen(false);
  }
  drawBody() {
    if (!this.valueText) return;
    const t = this.theme;
    const c = t.colors;
    const w2 = this._width;
    const h = this.bodyHeight();
    const border = !this._enabled ? c.border : this.hasErrorState ? c.error : this._focused || this.open ? c.borderFocus : this._hovered ? c.borderHover : c.border;
    this.box.clear().roundRect(0, 0, w2, h, t.radius).fill(!this._enabled ? c.surfaceDisabled : this._hovered && !this._focused ? c.surfaceHover : c.surface).stroke({ width: this._focused ? t.borderWidth + 0.5 : t.borderWidth, color: border, alignment: 1 });
    const cur = this.options.find((o) => o.value === this.value);
    this.valueText.text = cur ? this.formatSelected ? this.formatSelected(cur) : cur.label : this.placeholder;
    this.valueText.style = this.textStyle("body", !this._enabled ? c.textDisabled : cur ? c.text : c.placeholder);
    this.valueText.position.set(t.paddingX, Math.round((h - this.valueText.height) / 2));
    this.chevron.clear();
    Icons.chevron(this.chevron, w2 - 22, h / 2, 22, this._enabled ? c.textMuted : c.textDisabled, this.open !== this.menuAbove && this.open);
    this.drawFocus(0, 0, w2, h, t.radius);
    this.body.hitArea = new Rectangle(0, 0, w2, h);
    if (this.open) this.drawMenu();
  }
  destroy(options) {
    this.setOpen(false);
    window.clearTimeout(this.typeaheadTimer);
    this.menu.destroy({ children: true });
    super.destroy(options);
  }
}
class Slider extends Control {
  min;
  max;
  step;
  value;
  initial;
  format;
  showValue;
  dragging = false;
  track = new Graphics();
  thumb = new Graphics();
  valueText;
  constructor(ui, opts) {
    super(ui, opts);
    this.min = Number.isFinite(opts.min) ? opts.min : 0;
    this.max = Number.isFinite(opts.max) && opts.max > this.min ? opts.max : this.min + 100;
    this.step = opts.step && opts.step > 0 ? opts.step : 1;
    this.format = opts.format ?? ((v) => String(v));
    this.showValue = opts.showValue ?? true;
    this.value = this.initial = this.snap(opts.value ?? this.min);
    this.valueText = new Text({ text: "", style: this.textStyle("body") });
    this.body.addChild(this.track, this.thumb, this.valueText);
    this.body.eventMode = "static";
    this.body.cursor = "pointer";
    this.body.on("pointerdown", this.onDown, this);
    this.body.on("globalpointermove", this.onMove, this);
    this.body.on("pointerup", this.onUp, this);
    this.body.on("pointerupoutside", this.onUp, this);
    ui.on("gesturecancel", this.onUp, this);
    this.body.on("pointerover", () => (this._hovered = true, this.drawBody()));
    this.body.on("pointerout", () => (this._hovered = false, this.drawBody()));
    this.redraw();
  }
  getValue() {
    return this.value;
  }
  setValue(v, emit = true) {
    const n = this.snap(v);
    if (n === this.value) return;
    this.value = n;
    this.drawBody();
    this.ui.focus.sync(this);
    this.commitChange(emit);
  }
  isEmpty() {
    return false;
  }
  reset() {
    this.value = this.initial;
    this.touched = false;
    this.setError(null);
    this.redraw();
  }
  snap(v) {
    if (!Number.isFinite(v)) v = this.min;
    const s = Math.round((v - this.min) / this.step) * this.step + this.min;
    const decimals = (String(this.step).split(".")[1] ?? "").length;
    return Math.min(this.max, Math.max(this.min, Number(s.toFixed(decimals))));
  }
  ariaRole() {
    return "slider";
  }
  ariaState() {
    return {
      ...super.ariaState(),
      "aria-valuemin": String(this.min),
      "aria-valuemax": String(this.max),
      "aria-valuenow": String(this.value),
      "aria-valuetext": this.format(this.value)
    };
  }
  handleKeyDown(e) {
    const big = Math.max(this.step, (this.max - this.min) / 10);
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        this.setValue(this.value + this.step);
        return true;
      case "ArrowLeft":
      case "ArrowDown":
        this.setValue(this.value - this.step);
        return true;
      case "PageUp":
        this.setValue(this.value + big);
        return true;
      case "PageDown":
        this.setValue(this.value - big);
        return true;
      case "Home":
        this.setValue(this.min);
        return true;
      case "End":
        this.setValue(this.max);
        return true;
    }
    return false;
  }
  trackGeom() {
    const t = this.theme;
    const valueW = this.showValue ? 56 : 0;
    const x0 = t.sliderThumbSize / 2;
    const x1 = this._width - valueW - t.sliderThumbSize / 2;
    return { x0, x1, cy: this.bodyHeight() / 2 };
  }
  valueAt(e) {
    const { x0, x1 } = this.trackGeom();
    const p = e.getLocalPosition(this.body);
    const r = Math.min(1, Math.max(0, (p.x - x0) / Math.max(1, x1 - x0)));
    return this.min + r * (this.max - this.min);
  }
  onDown(e) {
    this.claimFocus();
    if (!this._enabled) return;
    this.dragging = true;
    this.ui.focus.pointerCaptured = true;
    this.setValue(this.valueAt(e));
  }
  onMove(e) {
    if (this.dragging) this.setValue(this.valueAt(e));
  }
  onUp() {
    if (!this.dragging) return;
    this.dragging = false;
    this.ui.focus.pointerCaptured = false;
    this.drawBody();
  }
  bodyHeight() {
    return Math.max(this.theme.sliderThumbSize + 8, 32);
  }
  drawBody() {
    if (!this.valueText) return;
    const t = this.theme;
    const c = t.colors;
    const { x0, x1, cy } = this.trackGeom();
    const r = (this.value - this.min) / (this.max - this.min);
    const tx = x0 + (x1 - x0) * r;
    const th = t.sliderTrackHeight;
    const accent = !this._enabled ? c.textDisabled : this._error ? c.error : c.primary;
    this.track.clear().roundRect(x0 - th / 2, cy - th / 2, x1 - x0 + th, th, th / 2).fill(c.track).roundRect(x0 - th / 2, cy - th / 2, tx - x0 + th, th, th / 2).fill(accent);
    const rad = t.sliderThumbSize / 2 + (this.dragging ? 2 : 0);
    this.thumb.clear();
    if ((this._hovered || this.dragging) && this._enabled) this.thumb.circle(tx, cy, rad + 7).fill({ color: accent, alpha: 0.12 });
    this.thumb.circle(tx, cy + 1, rad).fill({ color: c.shadow, alpha: 0.2 }).circle(tx, cy, rad).fill(c.thumb).stroke({ width: 2, color: accent });
    this.drawFocus(tx - rad, cy - rad, rad * 2, rad * 2, rad);
    this.valueText.visible = this.showValue;
    this.valueText.text = this.format(this.value);
    this.valueText.style = this.textStyle("body", this._enabled ? c.text : c.textDisabled);
    this.valueText.position.set(this._width - this.valueText.width, cy - this.valueText.height / 2);
    this.body.hitArea = new Rectangle(0, 0, this._width, this.bodyHeight());
  }
  destroy(options) {
    this.ui.off("gesturecancel", this.onUp, this);
    super.destroy(options);
  }
}
class Button extends Control {
  bg = new Graphics();
  spinner = new Graphics();
  caption;
  _text;
  variant;
  block;
  pressed = false;
  _loading = false;
  spin = 0;
  onPress;
  constructor(ui, opts) {
    super(ui, opts);
    this.labelAbove = false;
    this._text = opts.text;
    this.variant = opts.variant ?? "primary";
    this.block = opts.block ?? true;
    this.onPress = opts.onPress;
    this.caption = new Text({ text: "", style: this.textStyle("body") });
    this.body.addChild(this.bg, this.spinner, this.caption);
    this.body.eventMode = "static";
    this.body.cursor = "pointer";
    this.body.on("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      this.pressed = true;
      this.drawBody();
    });
    this.bindTap(this.body, () => void this.press());
    this.body.on("pointerup", () => {
      this.pressed = false;
      this.drawBody();
    });
    this.body.on("pointerupoutside", () => (this.pressed = false, this.drawBody()));
    ui.on("gesturecancel", this.cancelPress, this);
    this.body.on("pointerover", () => (this._hovered = true, this.drawBody()));
    this.body.on("pointerout", () => (this._hovered = false, this.pressed = false, this.drawBody()));
    this.redraw();
  }
  get text() {
    return this._text;
  }
  set text(v) {
    this._text = v;
    this.redraw();
  }
  get loading() {
    return this._loading;
  }
  set loading(v) {
    if (v === this._loading) return;
    this._loading = v;
    if (v) this.ui.ticker.add(this.tick, this);
    else this.ui.ticker.remove(this.tick, this);
    this.ui.focus.sync(this);
    this.drawBody();
  }
  async press() {
    if (!this._enabled || this._loading) return;
    this.emit("press", this);
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
  getValue() {
    return null;
  }
  setValue() {
  }
  reset() {
  }
  isEmpty() {
    return false;
  }
  ariaRole() {
    return "button";
  }
  ariaLabel() {
    return this._text;
  }
  ariaState() {
    return { ...super.ariaState(), "aria-busy": this._loading ? "true" : null };
  }
  handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      if (!e.repeat) void this.press();
      return true;
    }
    return false;
  }
  bodyHeight() {
    return this.theme.buttonHeight;
  }
  cancelPress() {
    if (!this.pressed) return;
    this.pressed = false;
    this.drawBody();
  }
  tick(t) {
    this.spin += t.deltaMS / 140;
    this.drawBody();
  }
  drawBody() {
    if (!this.caption) return;
    const t = this.theme;
    const h = this.bodyHeight();
    this.caption.text = this._text;
    const palette = this.colors();
    this.caption.style = { ...this.textStyle("body", palette.fg), fontWeight: "600" };
    const w2 = this.block ? this._width : Math.min(this._width, this.caption.width + t.paddingX * 2.5);
    const r = Math.min(t.buttonRadius, h / 2);
    this.bg.clear().roundRect(0, 0, w2, h, r).fill(palette.bg);
    if (palette.border !== null) this.bg.stroke({ width: t.borderWidth, color: palette.border, alignment: 1 });
    this.caption.alpha = this._loading ? 0 : 1;
    this.caption.position.set(Math.round((w2 - this.caption.width) / 2), Math.round((h - this.caption.height) / 2));
    this.spinner.clear();
    if (this._loading) {
      const cx = w2 / 2;
      const cy = h / 2;
      const rad = 9;
      this.spinner.arc(cx, cy, rad, this.spin, this.spin + Math.PI * 1.4).stroke({ width: 2.5, color: palette.fg, cap: "round" });
    }
    this.drawFocus(0, 0, w2, h, r);
    this.body.hitArea = new Rectangle(0, 0, w2, h);
    this.body.cursor = !this._enabled ? "not-allowed" : this._loading ? "progress" : "pointer";
  }
  colors() {
    const c = this.theme.colors;
    if (!this._enabled) return { bg: c.surfaceDisabled, fg: c.textDisabled, border: c.border };
    const shade = (base, hover, press) => this.pressed ? press : this._hovered ? hover : base;
    switch (this.variant) {
      case "secondary":
        return { bg: shade(c.secondary, c.secondaryHover, mix(c.secondaryHover, c.text, 0.08)), fg: c.secondaryText, border: null };
      case "outline":
        return { bg: shade(c.surface, c.surfaceHover, c.secondary), fg: c.text, border: c.border };
      case "ghost":
        return { bg: shade(c.surface, c.secondary, c.secondaryHover), fg: c.primary, border: null };
      case "danger":
        return { bg: shade(c.error, mix(c.error, 0, 0.12), mix(c.error, 0, 0.22)), fg: 16777215, border: null };
      default:
        return { bg: shade(c.primary, c.primaryHover, c.primaryPressed), fg: c.primaryText, border: null };
    }
  }
  destroy(options) {
    this.ui.ticker.remove(this.tick, this);
    this.ui.off("gesturecancel", this.cancelPress, this);
    super.destroy(options);
  }
}
class BotGuard {
  start = performance.now();
  interactions = 0;
  opts;
  constructor(opts = {}) {
    this.opts = { minFillMs: 2e3, minInteractions: 3, ...opts };
  }
  recordInteraction(e) {
    if (e.isTrusted) this.interactions++;
  }
  check(now = performance.now()) {
    if (now - this.start < this.opts.minFillMs) return { ok: false, reason: "Submitted too quickly. Please try again." };
    if (this.interactions < this.opts.minInteractions) return { ok: false, reason: "Please complete the form manually." };
    return { ok: true };
  }
}
class RateLimiter {
  attempts = [];
  lockedUntil = 0;
  lockouts = 0;
  opts;
  constructor(opts = {}) {
    this.opts = { maxAttempts: 5, windowMs: 6e4, lockoutMs: 15e3, maxLockoutMs: 15 * 6e4, ...opts };
  }
  attempt(now = performance.now()) {
    if (now < this.lockedUntil) return { allowed: false, retryInMs: this.lockedUntil - now };
    this.attempts = this.attempts.filter((t) => now - t < this.opts.windowMs);
    if (this.attempts.length >= this.opts.maxAttempts) {
      const duration = Math.min(this.opts.lockoutMs * 2 ** this.lockouts, this.opts.maxLockoutMs);
      this.lockouts++;
      this.lockedUntil = now + duration;
      this.attempts = [];
      return { allowed: false, retryInMs: duration };
    }
    this.attempts.push(now);
    return { allowed: true, retryInMs: 0 };
  }
  /** Call after a successful submission. */
  reset() {
    this.attempts = [];
    this.lockedUntil = 0;
    this.lockouts = 0;
  }
}
const PFE_VERSION = "pfe1";
const PFE_INFO = "pixiform/pfe1/aes-256-gcm";
const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("Web Crypto unavailable: serve the page over HTTPS or localhost.");
  return s;
};
const keyCache = /* @__PURE__ */ new Map();
function importServerKey(spki) {
  let k = keyCache.get(spki);
  if (!k) {
    k = subtle().importKey("spki", b64uDecode(spki), { name: "ECDH", namedCurve: "P-256" }, false, []);
    keyCache.set(spki, k);
  }
  return k;
}
async function sealBytes(plaintext, key2, field) {
  if (key2.alg !== "PFE1") throw new Error(`Unsupported algorithm ${key2.alg}`);
  if (!/^[A-Za-z0-9_-]{16}$/.test(key2.kid)) throw new Error("Bad key id");
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key2.challenge)) throw new Error("Bad challenge");
  const s = subtle();
  const serverKey = await importServerKey(key2.spki);
  const eph = await s.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const epk = new Uint8Array(await s.exportKey("raw", eph.publicKey));
  const shared = await s.deriveBits({ name: "ECDH", public: serverKey }, eph.privateKey, 256);
  const hkdfKey = await s.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  const aesKey = await s.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: epk, info: new TextEncoder().encode(PFE_INFO) },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  new Uint8Array(shared).fill(0);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const header = `${PFE_VERSION}.${key2.kid}.${b64uEncode(epk)}.${b64uEncode(iv)}`;
  const aad = new TextEncoder().encode(`${header}|${key2.challenge}|${field}`);
  const ct = new Uint8Array(await s.encrypt({ name: "AES-GCM", iv, additionalData: aad, tagLength: 128 }, aesKey, plaintext));
  return `${header}.${b64uEncode(ct)}`;
}
async function sealSecret(secret, key2, field) {
  const bytes = secret.toUtf8();
  try {
    return await sealBytes(bytes, key2, field);
  } finally {
    bytes.fill(0);
  }
}
function b64uEncode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64uDecode(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
class Form extends EventEmitter {
  ui;
  controls = /* @__PURE__ */ new Map();
  opts;
  limiter;
  guard;
  submitting = false;
  idleTimer = 0;
  offInteraction;
  submitButton = null;
  constructor(ui, opts) {
    super();
    this.ui = ui;
    this.opts = { autovalidateMode: "onUserInteraction", idleTimeoutMs: 5 * 6e4, wipeSecrets: "always", ...opts };
    this.limiter = opts.rateLimit === false ? null : new RateLimiter(opts.rateLimit);
    this.guard = opts.botGuard === false ? null : new BotGuard(opts.botGuard);
    this.offInteraction = ui.onInteraction((e) => {
      this.guard?.recordInteraction(e);
      this.armIdle();
    });
    this.armIdle();
  }
  get isSubmitting() {
    return this.submitting;
  }
  add(...controls) {
    for (const c of controls) {
      if (this.controls.has(c.fieldName)) throw new Error(`Duplicate field name "${c.fieldName}"`);
      this.controls.set(c.fieldName, c);
      c.formContext = () => ({ getField: (n) => this.controls.get(n) });
      if (this.opts.autovalidateMode === "disabled") c.validateOn = "submit";
      if (this.opts.autovalidateMode === "always") {
        c.validateOn = "change";
        c.touched = true;
      }
      c.on("submit", this.onFieldSubmit, this);
    }
    return this;
  }
  /** Wires a button to submit this form (shows a spinner while submitting). */
  bindSubmit(button) {
    this.submitButton = button;
    button.onPress = async () => {
      await this.submit();
    };
    return this;
  }
  /** The registered controls, in the order they were added. */
  get fields() {
    return [...this.controls.values()];
  }
  get(name) {
    return this.controls.get(name);
  }
  values() {
    const out = /* @__PURE__ */ Object.create(null);
    for (const [name, c] of this.controls) {
      if (c.ariaRole() === "button") continue;
      out[name] = c.getValue();
    }
    return out;
  }
  /**
   * JSON-ready values: strings, numbers, booleans and null. Dates are ISO strings,
   * phones E.164. Password fields are encrypted with `encryptionKey` (empty ones become '').
   *
   *   const body = await form.serialize({ encryptionKey: session.encryption });
   *   await secureSubmit('/api/register', body, { csrfToken });
   */
  async serialize(opts = {}) {
    const out = /* @__PURE__ */ Object.create(null);
    for (const [name, c] of this.controls) {
      if (c.ariaRole() === "button") continue;
      if (opts.include && !opts.include.includes(name)) continue;
      if (opts.exclude?.includes(name)) continue;
      const v = c.getValue();
      if (v instanceof Secret) {
        if (opts.secrets === "omit") continue;
        if (v.isEmpty) out[name] = "";
        else if (opts.encryptionKey) out[name] = await sealSecret(v, opts.encryptionKey, name);
        else throw new Error(`serialize: "${name}" is a secret field; pass encryptionKey (or secrets: 'omit')`);
      } else if (v === void 0) out[name] = null;
      else if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v)) out[name] = v;
      else out[name] = String(v);
    }
    return out;
  }
  /**
   * Fills fields from plain data (a saved draft, a record being edited, an agent's
   * prefill). Values go through each control's own checks: text is sanitised and
   * length-limited, choices must be one of the options. Secret and one-time-code fields
   * are never set this way, and unknown names are ignored.
   */
  setValues(values, opts = {}) {
    const result = { applied: [], skipped: /* @__PURE__ */ Object.create(null) };
    if (!values || typeof values !== "object") return result;
    for (const name of Object.keys(values)) {
      const c = this.controls.get(name);
      const v = values[name];
      if (!c || c.ariaRole() === "button") {
        result.skipped[name] = "unknown field";
        continue;
      }
      if (c.secure || c.sensitive) {
        result.skipped[name] = "secret field";
        continue;
      }
      const current = c.getValue();
      const expected = current === null ? null : typeof current;
      const ok = v === null ? expected !== "boolean" && expected !== "number" : expected === null ? typeof v === "string" || typeof v === "number" : typeof v === expected;
      if (!ok) {
        result.skipped[name] = "wrong type";
        continue;
      }
      c.setValue(v, opts.emit ?? true);
      const after = c.getValue();
      if (v !== null && after !== v && after === current) {
        result.skipped[name] = "not allowed";
        continue;
      }
      result.applied.push(name);
      if (opts.validate) {
        c.touched = true;
        void c.validate();
      }
    }
    return result;
  }
  async validate() {
    const errors = {};
    const list = [...this.controls.values()].filter((c) => c.ariaRole() !== "button");
    const results = await Promise.all(list.map((c) => (c.touched = true, c.validate())));
    results.forEach((r, i) => {
      if (r) errors[list[i].fieldName] = r;
    });
    return errors;
  }
  async submit() {
    if (this.submitting) return null;
    this.submitting = true;
    this.emit("submitstart");
    if (this.submitButton) this.submitButton.loading = true;
    try {
      const errors = await this.validate();
      const names = Object.keys(errors);
      if (names.length) {
        this.controls.get(names[0])?.focus();
        this.ui.announcer.announce(`${names.length} field${names.length > 1 ? "s need" : " needs"} attention. ${errors[names[0]]}`, true);
        this.emit("invalid", errors);
        return { ok: false, fieldErrors: errors };
      }
      const values = this.values();
      let prevented = false;
      this.emit("beforesubmit", {
        values,
        preventDefault: () => prevented = true,
        get defaultPrevented() {
          return prevented;
        }
      });
      if (prevented) return null;
      const bot = this.guard?.check();
      if (bot && !bot.ok) return this.block(bot.reason, "bot");
      const limit = this.limiter?.attempt();
      if (limit && !limit.allowed) return this.block(`Too many attempts. Try again in ${Math.ceil(limit.retryInMs / 1e3)}s.`, "rate_limit");
      this.emit("submitting");
      let result;
      try {
        result = await this.opts.onSubmit(values, this) ?? { ok: true };
      } catch (err) {
        this.emit("error", err instanceof Error ? err : new Error(String(err)));
        result = { ok: false, message: "Something went wrong. Please try again." };
      }
      if (result.fieldErrors) {
        for (const [name, msg] of Object.entries(result.fieldErrors)) this.controls.get(name)?.setError(msg, "server");
        const first = Object.keys(result.fieldErrors)[0];
        if (first) this.controls.get(first)?.focus();
      }
      const wipe = this.opts.wipeSecrets;
      if (wipe === "always" || wipe === "success" && result.ok) this.wipeSecrets();
      if (result.ok) this.limiter?.reset();
      if (result.message) this.ui.announcer.announce(result.message, !result.ok);
      this.emit(result.ok ? "success" : "failure", result);
      return result;
    } finally {
      this.submitting = false;
      if (this.submitButton) this.submitButton.loading = false;
    }
  }
  /** Zeroes every secret field's memory. */
  wipeSecrets() {
    for (const c of this.controls.values()) {
      if (c.secure || c.sensitive) {
        c.wipe();
        c.redraw();
        this.ui.focus.sync(c);
        c.emit("change", c.getValue(), c);
      }
    }
  }
  reset() {
    for (const c of this.controls.values()) c.reset();
    this.wipeSecrets();
    this.emit("reset");
  }
  destroy() {
    window.clearTimeout(this.idleTimer);
    this.offInteraction();
    this.wipeSecrets();
    for (const c of this.controls.values()) c.off("submit", this.onFieldSubmit, this);
    this.controls.clear();
    this.removeAllListeners();
  }
  block(reason, code) {
    this.ui.announcer.announce(reason, true);
    this.emit("blocked", reason, code);
    return { ok: false, message: reason };
  }
  /** Enter (or OTP completion) moves to the next field of THIS form, or submits from the last one. */
  onFieldSubmit(source) {
    const list = [...this.controls.values()];
    const idx = source ? list.indexOf(source) : -1;
    const next = list.slice(idx + 1).find((c) => c.isFocusable());
    if (idx >= 0 && next) next.focus();
    else void this.submit();
  }
  armIdle() {
    const ms = this.opts.idleTimeoutMs ?? 0;
    window.clearTimeout(this.idleTimer);
    if (ms <= 0) return;
    this.idleTimer = window.setTimeout(() => {
      const hadSecrets = [...this.controls.values()].some((c) => c.secure && !c.isEmpty());
      this.wipeSecrets();
      if (hadSecrets) {
        this.ui.announcer.announce("Passwords were cleared after inactivity.");
        this.emit("idle");
      }
    }, ms);
  }
}
function publicRules(rules) {
  const secret = new Set(Object.entries(rules).filter(([, r]) => r.type === "secret").map(([k]) => k));
  return Object.fromEntries(
    Object.entries(rules).filter(([, r]) => r.type !== "secret" && !(r.matches && secret.has(r.matches)))
  );
}
function rulesToJsonSchema(rules, opts = {}) {
  const source = opts.includeSecrets ? rules : publicRules(rules);
  const properties = {};
  const required = [];
  for (const [name, rule] of Object.entries(source)) {
    if (opts.omit?.includes(name)) continue;
    properties[name] = fieldSchema(rule);
    if (rule.required || rule.mustBeTrue) required.push(name);
  }
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    ...opts.title ? { title: opts.title } : {},
    ...opts.description ? { description: opts.description } : {},
    properties,
    required,
    additionalProperties: false
  };
}
function fieldSchema(r) {
  const notes = [];
  const s = { title: r.label };
  switch (r.type) {
    case "text":
    case "secret":
      s.type = "string";
      if (r.minLength !== void 0) s.minLength = r.minLength;
      if (r.maxLength !== void 0) s.maxLength = r.maxLength;
      if (r.pattern) s.pattern = r.pattern.source;
      if (r.patternMessage) notes.push(r.patternMessage);
      if (r.inputMode === "email") s.format = "email";
      if (r.type === "secret") s.writeOnly = true;
      break;
    case "number":
      s.type = r.step !== void 0 && Number.isInteger(r.step) ? "integer" : "number";
      if (r.min !== void 0) s.minimum = r.min;
      if (r.max !== void 0) s.maximum = r.max;
      if (r.step !== void 0 && r.step !== 1) s.multipleOf = r.step;
      break;
    case "choice":
      s.type = "string";
      s.enum = [...r.options ?? []];
      break;
    case "boolean":
      s.type = "boolean";
      if (r.mustBeTrue) {
        s.const = true;
        notes.push("Must be true; only set it when the user has explicitly agreed.");
      }
      break;
    case "date":
      s.type = "string";
      if (r.withTime) {
        s.pattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$";
        notes.push("Local date and time, 'YYYY-MM-DDTHH:mm'.");
      } else {
        s.format = "date";
        notes.push("Date, 'YYYY-MM-DD'.");
      }
      if (r.minDate) notes.push(`On or after ${describeDate(r.minDate)}.`);
      if (r.maxDate) notes.push(`On or before ${describeDate(r.maxDate)}.`);
      if (r.minAge !== void 0) notes.push(`Person must be at least ${r.minAge} years old.`);
      if (r.maxAge !== void 0) notes.push(`Person must be at most ${r.maxAge} years old.`);
      if (r.notInPast) notes.push("Must be in the future.");
      if (r.weekdaysOnly) notes.push("Monday to Friday only.");
      break;
  }
  if (r.matches) notes.push(`Must equal "${r.matches}".`);
  if (notes.length) s.description = notes.join(" ");
  return s;
}
function describeDate(v) {
  const m = /^today(?:([+-])(\d+))?$/.exec(v);
  if (!m) return v;
  if (!m[1]) return "today";
  return `${m[2]} day${m[2] === "1" ? "" : "s"} ${m[1] === "+" ? "from" : "before"} today`;
}
const heightOf = (c) => c.layoutHeight !== void 0 ? c.layoutHeight : c.height;
const insets = (v, h = v, b = v, l = h) => ({ top: v, right: h, bottom: b, left: l });
class Column extends Container {
  constructor(items = [], gap = 16, padding = insets(0)) {
    super();
    this.items = items;
    this.gap = gap;
    this.padding = padding;
    for (const it of items) this.attach(it);
  }
  items;
  gap;
  padding;
  width_ = 0;
  height_ = 0;
  laying = false;
  add(...items) {
    for (const it of items) {
      this.items.push(it);
      this.attach(it);
    }
    if (this.width_) this.layout(this.width_);
    return this;
  }
  /** Extra spacing between two items. */
  static spacer(h) {
    const c = new Container();
    Object.defineProperty(c, "layoutHeight", { value: h });
    return c;
  }
  get layoutHeight() {
    return this.height_;
  }
  layout(width) {
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
    this.emit("resize", this);
  }
  attach(it) {
    this.addChild(it);
    it.on("resize", () => {
      if (!this.laying && this.width_) this.layout(this.width_);
    });
  }
}
class Row extends Container {
  constructor(items, gap = 16, breakpoint = 480) {
    super();
    this.items = items;
    this.gap = gap;
    this.breakpoint = breakpoint;
    for (const it of items) {
      this.addChild(it);
      it.on("resize", () => {
        if (!this.laying && this.width_) this.layout(this.width_);
      });
    }
  }
  items;
  gap;
  breakpoint;
  width_ = 0;
  height_ = 0;
  laying = false;
  get layoutHeight() {
    return this.height_;
  }
  layout(width) {
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
      const w2 = (width - this.gap * (n - 1)) / n;
      let h = 0;
      this.items.forEach((it, i) => {
        it.layout?.(w2);
        it.position.set(i * (w2 + this.gap), 0);
        h = Math.max(h, heightOf(it));
      });
      this.height_ = h;
    }
    this.laying = false;
    this.emit("resize", this);
  }
}
class ScrollView extends Container {
  constructor(ui, content) {
    super();
    this.ui = ui;
    this.content = content;
    this.addChild(this.clip, content, this.bar);
    content.mask = this.clip;
    this.eventMode = "static";
    this.on("wheel", this.onWheel, this);
    this.on("pointerdown", this.onDown, this);
    this.on("globalpointermove", this.onMove, this);
    this.on("pointerup", this.onUp, this);
    this.on("pointerupoutside", this.onUp, this);
    content.on("resize", () => this.clampScroll());
    ui.on("focuschange", (c, viaKeyboard) => {
      if (c && viaKeyboard) this.reveal(c.view);
    });
    ui.ticker.add(this.tick, this);
  }
  ui;
  content;
  clip = new Graphics();
  bar = new Graphics();
  viewW = 0;
  viewH = 0;
  scrollY = 0;
  velocity = 0;
  drag = null;
  setViewport(w2, h) {
    this.viewW = w2;
    this.viewH = h;
    this.hitArea = new Rectangle(0, 0, w2, h);
    this.clip.clear().rect(0, 0, w2, h).fill(16777215);
    this.content.layout?.(w2);
    this.clampScroll();
    const cur = this.ui.focus.current;
    if (cur) this.reveal(cur.view);
  }
  scrollTo(y) {
    this.scrollY = y;
    this.clampScroll();
  }
  /** Scrolls so `target` is fully visible (with margin). */
  reveal(target, margin = 24) {
    const b = target.getBounds();
    const top = this.toLocal({ x: 0, y: b.y }).y;
    const bottom = top + b.height;
    if (top < margin) this.scrollTo(this.scrollY + top - margin);
    else if (bottom > this.viewH - margin) this.scrollTo(this.scrollY + bottom - this.viewH + margin);
  }
  maxScroll() {
    return Math.max(0, heightOf(this.content) - this.viewH);
  }
  clampScroll() {
    this.scrollY = Math.min(this.maxScroll(), Math.max(0, this.scrollY));
    const y = -Math.round(this.scrollY);
    if (y !== this.content.y) this.ui.emit("scroll", this.scrollY);
    this.content.y = y;
    this.drawBar();
    const cur = this.ui.focus.current;
    if (cur) this.ui.repositionProxy(cur);
  }
  drawBar() {
    this.bar.clear();
    const max = this.maxScroll();
    if (max <= 0) return;
    const total = heightOf(this.content);
    const h = Math.max(32, this.viewH * this.viewH / total);
    const y = this.scrollY / max * (this.viewH - h);
    this.bar.roundRect(this.viewW - 6, y + 2, 4, h - 4, 2).fill({ color: this.ui.theme.colors.textMuted, alpha: 0.4 });
  }
  onWheel(e) {
    this.velocity = 0;
    const before = this.scrollY;
    this.scrollTo(this.scrollY + (e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY));
    if (this.scrollY !== before) e.preventDefault();
  }
  onDown(e) {
    this.velocity = 0;
    if (e.pointerType === "mouse") return;
    this.drag = { id: e.pointerId, startY: e.global.y, lastY: e.global.y, lastT: performance.now(), active: false };
  }
  onMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id || this.ui.focus.pointerCaptured) return;
    if (!d.active && Math.abs(e.global.y - d.startY) < 8) return;
    d.active = true;
    this.ui.focus.gestureMoved = true;
    const now = performance.now();
    const dy = e.global.y - d.lastY;
    this.velocity = -dy / Math.max(1, now - d.lastT) * 16;
    d.lastY = e.global.y;
    d.lastT = now;
    this.scrollTo(this.scrollY - dy);
  }
  onUp() {
    this.drag = null;
  }
  tick(t) {
    if (this.drag || Math.abs(this.velocity) < 0.1) return;
    this.scrollTo(this.scrollY + this.velocity * (t.deltaMS / 16));
    this.velocity *= Math.pow(0.94, t.deltaMS / 16);
  }
  destroy(options) {
    this.ui.ticker.remove(this.tick, this);
    super.destroy(options);
  }
}
const style = (t, size, fill, weight = t.fontWeight, wrap = 0) => ({
  fontFamily: t.fontFamily.join(","),
  fontSize: size,
  fontWeight: weight,
  fill,
  lineHeight: Math.ceil(size * t.lineHeight),
  wordWrap: wrap > 0,
  wordWrapWidth: wrap
});
class Label extends Container {
  constructor(ui, value, variant = "body") {
    super();
    this.ui = ui;
    this.value = value;
    this.variant = variant;
    this.txt = new Text({ text: value });
    this.addChild(this.txt);
    ui.on("themechange", () => this.layout(this.width_));
  }
  ui;
  value;
  variant;
  txt;
  width_ = 0;
  get text() {
    return this.value;
  }
  set text(v) {
    this.value = v;
    this.layout(this.width_);
  }
  /** Accessibility outline: titles become headings, everything else a paragraph. */
  a11yText() {
    return { text: this.value, heading: this.variant === "title" };
  }
  get layoutHeight() {
    return Math.ceil(this.txt.height);
  }
  layout(width) {
    this.width_ = width;
    const t = this.ui.theme;
    const c = t.colors;
    const s = this.variant === "title" ? style(t, t.titleFontSize, c.text, "700", width) : this.variant === "subtitle" ? style(t, t.fontSize, c.textMuted, t.fontWeight, width) : this.variant === "caption" ? style(t, t.helperFontSize, c.textMuted, t.fontWeight, width) : style(t, t.fontSize, c.text, t.fontWeight, width);
    this.txt.style = s;
    this.txt.text = this.value;
    this.emit("resize", this);
  }
}
function estimateStrength(secret) {
  const len = secret.length;
  if (len === 0) return { score: 0, label: "" };
  const lower = secret.count((c) => c >= 97 && c <= 122) > 0;
  const upper = secret.count((c) => c >= 65 && c <= 90) > 0;
  const digit = secret.count((c) => c >= 48 && c <= 57) > 0;
  const other = secret.count((c) => !(c >= 97 && c <= 122) && !(c >= 65 && c <= 90) && !(c >= 48 && c <= 57)) > 0;
  const classes = [lower, upper, digit, other].filter(Boolean).length;
  let score = 0;
  if (len >= 8) score++;
  if (len >= 12) score++;
  if (classes >= 3) score++;
  if (len >= 16 && classes >= 3) score++;
  if (len < 8) score = 0;
  const s = Math.min(4, score);
  return { score: s, label: ["Too weak", "Weak", "Fair", "Good", "Strong"][s] };
}
class StrengthMeter extends Container {
  constructor(ui) {
    super();
    this.ui = ui;
    this.caption = new Text({ text: "" });
    this.addChild(this.bars, this.caption);
    ui.on("themechange", () => this.draw());
  }
  ui;
  bars = new Graphics();
  caption;
  width_ = 0;
  result = { score: 0, label: "" };
  shown = 0;
  animating = false;
  update(secret) {
    this.result = estimateStrength(secret);
    if (!this.animating) {
      this.animating = true;
      this.ui.ticker.add(this.tick, this);
    }
  }
  get layoutHeight() {
    return 12 + Math.ceil(this.caption.height);
  }
  layout(width) {
    this.width_ = width;
    this.draw();
  }
  tick(t) {
    const target = this.result.label ? this.result.score + 1 : 0;
    this.shown = approach(this.shown, target, 0.25, t.deltaMS);
    this.draw();
    if (this.shown === target) {
      this.ui.ticker.remove(this.tick, this);
      this.animating = false;
    }
  }
  draw() {
    const t = this.ui.theme;
    const c = t.colors;
    const colors = [c.error, c.error, c.warning, c.success, c.success];
    const color = colors[this.result.score];
    const gap = 6;
    const w2 = (this.width_ - gap * 3) / 4;
    this.bars.clear();
    for (let i = 0; i < 4; i++) {
      this.bars.roundRect(i * (w2 + gap), 0, w2, 6, 3).fill(c.track);
      const segs = this.result.score === 0 ? Math.min(1, this.shown) : this.shown - 1;
      const f = Math.max(0, Math.min(1, segs - i));
      if (f > 0) this.bars.roundRect(i * (w2 + gap), 0, w2 * f, 6, 3).fill(color);
    }
    const before = this.layoutHeight;
    this.caption.style = style(t, t.helperFontSize, this.result.label ? color : c.textMuted, t.fontWeight, Math.max(40, this.width_));
    this.caption.text = this.result.label ? `Password strength: ${this.result.label}` : "Use 12+ characters with a mix of letters, numbers & symbols";
    this.caption.y = 12;
    if (this.layoutHeight !== before) this.emit("resize", this);
  }
}
class Toast extends Container {
  constructor(ui) {
    super();
    this.ui = ui;
    this.txt = new Text({ text: "" });
    this.addChild(this.bg, this.txt);
    this.alpha = 0;
    this.eventMode = "none";
    ui.overlay.addChild(this);
    ui.ticker.add(this.tick, this);
  }
  ui;
  bg = new Graphics();
  txt;
  timer = 0;
  alphaTarget = 0;
  show(message, kind = "info", ms = 4e3) {
    const t = this.ui.theme;
    const c = t.colors;
    const screen = this.ui.app.screen;
    const maxW = Math.min(520, screen.width - 32);
    this.txt.style = style(t, t.fontSize - 1, c.inverseText, "500", maxW - 56);
    this.txt.text = message;
    const w2 = Math.min(maxW, this.txt.width + 56);
    const h = Math.max(48, this.txt.height + 24);
    const accent = kind === "success" ? c.success : kind === "error" ? c.error : c.primary;
    this.bg.clear().roundRect(0, 4, w2, h, 12).fill({ color: c.shadow, alpha: 0.2 }).roundRect(0, 0, w2, h, 12).fill(c.inverseSurface);
    this.bg.circle(22, h / 2, 5).fill(accent);
    this.txt.position.set(40, (h - this.txt.height) / 2);
    this.position.set(Math.round((screen.width - w2) / 2), screen.height - h - 24);
    this.ui.overlay.addChild(this);
    this.alphaTarget = 1;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.alphaTarget = 0, ms);
    this.ui.announcer.announce(message, kind === "error");
  }
  tick(t) {
    this.alpha = approach(this.alpha, this.alphaTarget, 0.2, t.deltaMS);
    this.visible = this.alpha > 0.01;
  }
}
class PrivacyScreen extends Container {
  constructor(ui, message = "Content hidden for your privacy") {
    super();
    this.ui = ui;
    this.message = message;
    this.txt = new Text({ text: "" });
    this.addChild(this.bg, this.icon, this.txt);
    this.visible = false;
    this.eventMode = "static";
    this.on("pointerdown", (e) => {
      e.stopPropagation();
      this.hide();
    });
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("focus", this.onFocus);
    document.addEventListener("visibilitychange", this.onVisibility);
  }
  ui;
  message;
  bg = new Graphics();
  icon = new Graphics();
  txt;
  enabled_ = true;
  set enabled(v) {
    this.enabled_ = v;
    if (!v) this.hide();
  }
  show() {
    if (!this.enabled_) return;
    const t = this.ui.theme;
    const c = t.colors;
    const { width: w2, height: h } = this.ui.app.screen;
    this.bg.clear().rect(0, 0, w2, h).fill(c.background);
    this.icon.clear().circle(w2 / 2, h / 2 - 28, 30).fill({ color: c.primary, alpha: 0.12 });
    Icons.lock(this.icon, w2 / 2, h / 2 - 28, 30, c.primary);
    this.txt.style = style(t, t.fontSize, c.textMuted, "500");
    this.txt.text = this.message;
    this.txt.position.set(Math.round((w2 - this.txt.width) / 2), h / 2 + 16);
    this.ui.overlay.addChild(this);
    this.visible = true;
    this.ui.app.render();
  }
  hide() {
    this.visible = false;
  }
  onBlur = () => this.show();
  onFocus = () => this.hide();
  onVisibility = () => document.hidden ? this.show() : void 0;
  destroy(options) {
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("focus", this.onFocus);
    document.removeEventListener("visibilitychange", this.onVisibility);
    super.destroy(options);
  }
}
const perChar = (re, keep) => {
  const r = new RegExp(re.source, re.flags.replace(/[gy]/g, ""));
  return (s) => {
    let out = "";
    for (const ch of s) if (r.test(ch) === keep) out += ch;
    return out;
  };
};
const Formatters = {
  /** Keep only characters matching `re` (like FilteringTextInputFormatter.allow). */
  allow: (re) => perChar(re, true),
  /** Drop characters matching `re` (like FilteringTextInputFormatter.deny). */
  deny: (re) => perChar(re, false),
  digitsOnly: () => perChar(/[0-9]/, true),
  upperCase: () => (s) => s.toUpperCase(),
  lowerCase: () => (s) => s.toLowerCase(),
  /** No leading spaces and no runs of spaces. */
  singleSpaces: () => (s, ctx) => {
    let out = s.replace(/[ \t]{2,}/g, " ");
    if (out.startsWith(" ") && (ctx.before === "" || ctx.before.endsWith(" "))) out = out.slice(1);
    if (out.endsWith(" ") && ctx.after.startsWith(" ")) out = out.slice(0, -1);
    return out;
  },
  /** Strips anything that looks like markup, as defence in depth for values echoed elsewhere. */
  noMarkup: () => perChar(/[<>`]/, false)
};
function readCsrfToken() {
  const el = document.querySelector('meta[name="csrf-token"]');
  return el?.content || null;
}
async function secureSubmit(url, body, opts = {}) {
  const target = new URL(url, window.location.href);
  const sameOrigin = target.origin === window.location.origin;
  if (!sameOrigin) {
    if (!opts.allowedOrigins?.includes(target.origin)) throw new Error(`Refusing to submit to untrusted origin ${target.origin}`);
    if (target.protocol !== "https:") throw new Error("Cross-origin submissions require HTTPS");
  }
  if (target.username || target.password) throw new Error("Credentials in URLs are not allowed");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...opts.headers
  };
  const token = opts.csrfToken === void 0 ? readCsrfToken() : opts.csrfToken;
  if (token) headers[opts.csrfHeader ?? "X-CSRF-Token"] = token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), opts.timeoutMs ?? 15e3);
  opts.signal?.addEventListener("abort", () => controller.abort(opts.signal.reason), { once: true });
  try {
    return await fetch(target.href, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials: sameOrigin ? "same-origin" : "omit",
      mode: sameOrigin ? "same-origin" : "cors",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}
function parseISODate(s, withTime = false) {
  if (typeof s !== "string") return null;
  const m = (withTime ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/).exec(s);
  if (!m) return null;
  const [y, mo, d, hh, mm] = [+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0];
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (y < 1e3 || mo < 1 || mo > 12 || d < 1 || d > dim || hh > 23 || mm > 59) return null;
  return { y, m: mo, d, hh, mm };
}
function localToday(offsetDays = 0) {
  const n = /* @__PURE__ */ new Date();
  const t = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate() + offsetDays));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), hh: 0, mm: 0 };
}
function resolveRuleDate(s) {
  if (!s) return null;
  const rel = /^today([+-]\d+)?$/.exec(s);
  return rel ? localToday(rel[1] ? +rel[1] : 0) : parseISODate(s);
}
const dayKey = (p) => p.y * 1e4 + p.m * 100 + p.d;
function ageOn(birth, on) {
  let age = on.y - birth.y;
  if (on.m < birth.m || on.m === birth.m && on.d < birth.d) age--;
  return age;
}
function shortDate(p) {
  return `${p.d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][p.m - 1]} ${p.y}`;
}
const COMMON_PASSWORDS = /* @__PURE__ */ new Set([
  "123456789012",
  "password1234",
  "qwertyuiop12",
  "iloveyou1234",
  "password123!",
  "Password123!",
  "admin1234567",
  "welcome12345",
  "letmein12345",
  "qwerty123456",
  "1q2w3e4r5t6y",
  "abc123456789",
  "passw0rd1234",
  "p@ssw0rd1234",
  "P@ssw0rd1234",
  "changeme1234",
  "football1234",
  "monkey123456"
]);
function charClasses(s) {
  let n = 0;
  if (/[a-z]/.test(s)) n++;
  if (/[A-Z]/.test(s)) n++;
  if (/[0-9]/.test(s)) n++;
  if (/[^A-Za-z0-9]/.test(s)) n++;
  return n;
}
function codePointLength(s) {
  let n = 0;
  for (const _ of s) n++;
  return n;
}
function checkPassword(pw, p, context = {}) {
  const len = codePointLength(pw);
  if (len < p.minLength) return `Use at least ${p.minLength} characters.`;
  if (len > p.maxLength) return `Use at most ${p.maxLength} characters.`;
  if (charClasses(pw) < p.minCharClasses) return `Mix at least ${p.minCharClasses} of: lowercase, uppercase, numbers, symbols.`;
  if (p.noTripleRepeat && /(.)\1\1/u.test(pw)) return "Avoid repeating the same character 3+ times.";
  if (p.rejectCommon && COMMON_PASSWORDS.has(pw)) return "This password is too common.";
  const lower = pw.toLowerCase();
  for (const f of p.notContainingFields) {
    const v = context[f];
    if (typeof v !== "string") continue;
    const parts = f === "email" ? [v.split("@")[0]] : v.split(/\s+/);
    for (const part of parts) {
      if (part.length >= 3 && lower.includes(part.toLowerCase())) return "Password must not contain your name, username or email.";
    }
  }
  return null;
}
function validateValue(rule, value, all = {}) {
  const empty = value === void 0 || value === null || value === "" || rule.type === "boolean" && value === false;
  if (empty) {
    if (rule.required) return rule.requiredMessage ?? `${rule.label} is required.`;
    return null;
  }
  switch (rule.type) {
    case "text":
    case "secret": {
      if (typeof value !== "string") return `${rule.label} is invalid.`;
      const len = codePointLength(value);
      if (rule.minLength !== void 0 && len < rule.minLength) return `${rule.label} must be at least ${rule.minLength} characters.`;
      if (rule.maxLength !== void 0 && len > rule.maxLength) return `${rule.label} must be at most ${rule.maxLength} characters.`;
      if (rule.charset) {
        const re = new RegExp(rule.charset.source, rule.charset.flags.replace(/[gy]/g, ""));
        for (const ch of value) if (ch !== "\n" && !re.test(ch)) return `${rule.label} contains characters that are not allowed.`;
      }
      if (rule.pattern && !rule.pattern.test(value)) return rule.patternMessage ?? `${rule.label} is invalid.`;
      if (rule.password) {
        const r = checkPassword(value, rule.password, all);
        if (r) return r;
      }
      if (rule.matches && value !== all[rule.matches]) return rule.matchesMessage ?? `${rule.label} does not match.`;
      return null;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return `${rule.label} must be a number.`;
      if (rule.min !== void 0 && value < rule.min) return `${rule.label} must be at least ${rule.min}.`;
      if (rule.max !== void 0 && value > rule.max) return `${rule.label} must be at most ${rule.max}.`;
      if (rule.step && Math.abs((value - (rule.min ?? 0)) / rule.step % 1) > 1e-9) return `${rule.label} is invalid.`;
      return null;
    }
    case "boolean":
      if (typeof value !== "boolean") return `${rule.label} is invalid.`;
      if (rule.mustBeTrue && value !== true) return rule.requiredMessage ?? `${rule.label} must be accepted.`;
      return null;
    case "choice":
      if (typeof value !== "string" || !rule.options?.includes(value)) return `Choose a valid ${rule.label.toLowerCase()}.`;
      return null;
    case "date": {
      const p = parseISODate(value, !!rule.withTime);
      if (!p) return `Enter a valid ${rule.withTime ? "date and time" : "date"}.`;
      const min = resolveRuleDate(rule.minDate);
      const max = resolveRuleDate(rule.maxDate);
      if (min && dayKey(p) < dayKey(min)) return `Choose a date on or after ${shortDate(min)}.`;
      if (max && dayKey(p) > dayKey(max)) return `Choose a date on or before ${shortDate(max)}.`;
      const today2 = localToday();
      if (rule.minAge !== void 0 && ageOn(p, today2) < rule.minAge) return `You must be at least ${rule.minAge} years old.`;
      if (rule.maxAge !== void 0 && ageOn(p, today2) > rule.maxAge) return `Please check the year: the age can be at most ${rule.maxAge}.`;
      if (rule.weekdaysOnly) {
        const wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
        if (wd === 0 || wd === 6) return "Choose a weekday (Monday to Friday).";
      }
      if (rule.notInPast) {
        const now = /* @__PURE__ */ new Date();
        const when = new Date(p.y, p.m - 1, p.d, p.hh, p.mm);
        const cutoff = rule.withTime ? now : new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (when < cutoff) return rule.withTime ? "Choose a time in the future." : "Choose today or a later date.";
      }
      return null;
    }
  }
}
function ruleValidator(rule) {
  return (value, ctx) => {
    if (value instanceof Secret) {
      if (rule.matches) {
        const other = ctx.getField?.(rule.matches)?.getValue();
        if (other instanceof Secret && !value.equals(other)) return rule.matchesMessage ?? `${rule.label} does not match.`;
      }
      const context = {};
      for (const f of rule.password?.notContainingFields ?? []) {
        const v = ctx.getField?.(f)?.getValue();
        if (typeof v === "string") context[f] = v;
      }
      const { matches: _ignored, ...rest } = rule;
      return value.use((plain) => validateValue(rest, plain, context));
    }
    return validateValue(rule, typeof value === "string" && rule.type === "text" ? value.trim() : value);
  };
}
function fromRule(rules, name) {
  const rule = rules[name];
  if (!rule) throw new Error(`No rule for field "${name}"`);
  return {
    name,
    label: rule.label,
    required: !!rule.required,
    requiredMessage: rule.requiredMessage,
    maxLength: rule.password?.maxLength ?? rule.maxLength,
    allow: rule.charset,
    inputMode: rule.inputMode,
    validators: [ruleValidator(rule)],
    // Date rules also configure a DatePicker (range, time, weekdays).
    ...rule.type === "date" ? {
      min: rule.minDate,
      max: rule.maxDate,
      time: rule.withTime ? { step: 15 } : void 0,
      isDateDisabled: rule.weekdaysOnly ? (iso) => {
        const [y, m, d] = iso.split("-").map(Number);
        const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        return wd === 0 || wd === 6;
      } : void 0
    } : {}
  };
}
const DIGIT = /[0-9]/;
class OtpInput extends Control {
  acceptsText = true;
  sensitive = true;
  inputMode = "numeric";
  enterKeyHint = "done";
  autocomplete = "one-time-code";
  length;
  groupSize;
  obscure;
  autoSubmit;
  buf = new SecureBuffer(16);
  caret = 0;
  initial;
  webOtp;
  webOtpAbort = null;
  boxes = new Graphics();
  separators = new Graphics();
  caretGfx = new Graphics();
  digitLayer = new Container();
  digits = [];
  boxRects = [];
  blink = 0;
  shake = 0;
  hoverIndex = -1;
  ticking = false;
  constructor(ui, opts) {
    super(ui, opts);
    this.length = Math.max(4, Math.min(10, Math.round(opts.length ?? 6)));
    this.groupSize = Math.max(0, Math.min(this.length - 1, Math.round(opts.groupSize ?? 0)));
    this.obscure = !!opts.obscure;
    this.autoSubmit = !!opts.autoSubmit;
    this.webOtp = !!opts.webOtp;
    this.initial = this.clean(opts.value ?? "", this.length);
    if (this.initial) this.buf.set(toCodePoints(this.initial));
    this.caret = this.buf.length;
    this.validators.unshift(
      (v) => v.length > 0 && v.length < this.length ? `Enter all ${this.length} digits.` : null
    );
    for (let i = 0; i < this.length; i++) {
      const t = new Text({ text: "", style: this.textStyle("body") });
      t.anchor.set(0.5);
      this.digits.push(t);
      this.digitLayer.addChild(t);
    }
    this.body.addChild(this.boxes, this.separators, this.digitLayer, this.caretGfx);
    this.body.eventMode = "static";
    this.body.cursor = "text";
    this.bindTap(this.body, (e) => this.placeCaret(e));
    this.body.on("pointermove", (e) => {
      const i = this.boxAt(e.getLocalPosition(this.body).x);
      if (i !== this.hoverIndex) {
        this.hoverIndex = i;
        this.drawBody();
      }
    });
    this.body.on("pointerout", () => {
      this.hoverIndex = -1;
      this.drawBody();
    });
    this.redraw();
  }
  // ------------------------------------------------------------------ value
  getValue() {
    return this.buf.toString();
  }
  setValue(value, emit = true) {
    const digits = this.clean(String(value ?? ""), this.length);
    this.buf.set(toCodePoints(digits));
    this.caret = this.buf.length;
    this.changed(emit);
  }
  isEmpty() {
    return this.buf.length === 0;
  }
  get isComplete() {
    return this.buf.length === this.length;
  }
  reset() {
    this.buf.set(toCodePoints(this.initial));
    this.caret = this.buf.length;
    this.touched = false;
    this.setError(null);
    this.redraw();
  }
  clear() {
    this.setValue("");
  }
  wipe() {
    this.buf.wipe();
    this.caret = 0;
  }
  /** Errors trigger a short shake, like most OTP UIs. */
  setError(message, code) {
    const had = this.error;
    super.setError(message, code);
    if (message && message !== had && !this.ui.reducedMotion) {
      this.shake = 1;
      this.startTicking();
    }
  }
  clean(text, max) {
    return sanitizeInput(text, { allow: DIGIT, normalize: "NFKC", maxCodePoints: max });
  }
  changed(emit) {
    this.blink = 0;
    this.redraw();
    this.ui.focus.sync(this);
    if (!emit) return;
    this.commitChange(true);
    if (this.isComplete) {
      this.emit("complete", this.getValue(), this);
      if (this.autoSubmit) this.emit("submit", this);
    }
  }
  // ------------------------------------------------------------------ editing
  /** Typing overwrites at the caret; multi-digit input (paste/SMS autofill) fills forward. */
  handleText(text) {
    if (text === "\n") {
      this.emit("submit", this);
      return;
    }
    if (!this._enabled) return;
    const digits = this.clean(text, 64);
    if (!digits) {
      this.ui.announcer.announce("Digits only");
      if (!this.ui.reducedMotion) this.shake = 0.6;
      this.startTicking();
      return;
    }
    let pos = digits.length >= this.length ? 0 : Math.min(this.caret, this.buf.length);
    if (pos >= this.length) {
      this.ui.announcer.announce("Code is complete. Use Backspace to change it.");
      return;
    }
    if (pos === 0 && digits.length >= this.length) this.buf.wipe();
    for (const ch of digits) {
      if (pos >= this.length) break;
      if (pos < this.buf.length) this.buf.delete(pos, pos + 1);
      this.buf.insert(pos, [ch.codePointAt(0)]);
      pos++;
    }
    this.caret = Math.min(pos, this.length);
    this.changed(true);
  }
  handlePaste(text) {
    this.handleText(text);
  }
  handleCopy() {
    this.ui.announcer.announce("Copying is disabled for this field.");
    return null;
  }
  handleDelete(direction) {
    if (!this._enabled) return;
    if (direction === "backward") {
      if (this.caret === 0) return;
      this.buf.delete(this.caret - 1, this.caret);
      this.caret--;
    } else {
      if (this.caret >= this.buf.length) return;
      this.buf.delete(this.caret, this.caret + 1);
    }
    this.changed(true);
  }
  handleKeyDown(e) {
    const mod = e.ctrlKey || e.metaKey || e.altKey;
    switch (e.key) {
      case "ArrowLeft":
        this.moveCaret(mod ? 0 : this.caret - 1);
        return true;
      case "ArrowRight":
        this.moveCaret(mod ? this.buf.length : this.caret + 1);
        return true;
      case "Home":
        this.moveCaret(0);
        return true;
      case "End":
        this.moveCaret(this.buf.length);
        return true;
      case "Backspace":
        if (mod) {
          this.buf.delete(0, this.caret);
          this.caret = 0;
          this.changed(true);
        } else this.handleDelete("backward");
        return true;
      case "Delete":
        this.handleDelete("forward");
        return true;
      case "Enter":
        this.emit("submit", this);
        return true;
      case "Escape":
        if (!this.isEmpty()) {
          this.clear();
          return true;
        }
        return false;
    }
    return false;
  }
  /** The caret sits on a filled box (overwrite) or the first empty one; `length` = past the end. */
  moveCaret(i) {
    this.caret = Math.max(0, Math.min(i, this.buf.length));
    this.blink = 0;
    this.drawBody();
  }
  placeCaret(e) {
    const i = this.boxAt(e.getLocalPosition(this.body).x);
    this.moveCaret(i < 0 ? this.buf.length : Math.min(i, this.buf.length));
  }
  boxAt(x) {
    for (let i = 0; i < this.boxRects.length; i++) {
      const r = this.boxRects[i];
      if (x >= r.x - 4 && x <= r.x + r.w + 4) return i;
    }
    return -1;
  }
  // ------------------------------------------------------------------ a11y
  ariaLabel() {
    const base = super.ariaLabel();
    return `${base}, ${this.length}-digit code, ${this.buf.length} entered`;
  }
  // ------------------------------------------------------------------ focus, WebOTP, animation
  onFocusChanged(focused) {
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
  startWebOtp() {
    if (!this.webOtp || this.webOtpAbort || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    this.webOtpAbort = ac;
    navigator.credentials.get({
      otp: { transport: ["sms"] },
      signal: ac.signal
    }).then((cred) => {
      if (cred?.code && !ac.signal.aborted) this.handleText(cred.code);
    }).catch(() => {
    }).finally(() => {
      if (this.webOtpAbort === ac) this.webOtpAbort = null;
    });
  }
  startTicking() {
    if (this.ticking || this.destroyed) return;
    this.ticking = true;
    this.ui.ticker.add(this.tick, this);
  }
  tick(t) {
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
  geometry() {
    const t = this.theme;
    const gap = this._width < 360 ? 6 : 10;
    const groups = this.groupSize > 0 ? Math.ceil(this.length / this.groupSize) - 1 : 0;
    const sepW = groups > 0 ? 18 : 0;
    const avail = this._width - gap * (this.length - 1 - groups) - (gap * 2 + sepW) * groups;
    const boxW = Math.max(28, Math.min(56, Math.floor(avail / this.length)));
    const boxH = Math.round(Math.max(t.controlHeight + 8, Math.min(64, boxW * 1.2)));
    return { boxW, gap, sepW, boxH };
  }
  bodyHeight() {
    return this.geometry().boxH;
  }
  drawBody() {
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
          this.separators.roundRect(x + (sepW - 10) / 2, boxH / 2 - 1, 10, 2, 1).fill(this._enabled ? c.textMuted : c.textDisabled);
          x += sepW + gap;
        } else {
          x += gap;
        }
      }
      this.boxRects.push({ x, w: boxW });
      const filled = i < value.length;
      const isActive = this._focused && i === active && !(this.isComplete && this.caret >= this.length);
      const border = !this._enabled ? c.border : this._error ? c.error : isActive ? c.borderFocus : this.hoverIndex === i ? c.borderHover : filled ? c.borderHover : c.border;
      const fill = !this._enabled ? c.surfaceDisabled : filled ? c.surface : this.hoverIndex === i ? c.surfaceHover : c.surface;
      this.boxes.roundRect(x, 0, boxW, boxH, t.radius).fill(fill).stroke({ width: isActive ? t.borderWidth + 1 : t.borderWidth, color: border, alignment: 1 });
      const txt = this.digits[i];
      txt.text = filled ? this.obscure ? "•" : value[i] : "";
      txt.style = {
        ...this.textStyle("body", this._enabled ? c.text : c.textDisabled),
        fontSize: Math.round(Math.min(boxW * 0.55, t.fontSize * 1.7)),
        fontWeight: "600",
        lineHeight: void 0
      };
      txt.position.set(x + boxW / 2, boxH / 2);
      x += boxW;
    }
    const r = this.boxRects[active];
    const caretH = Math.round(boxH * 0.45);
    this.caretGfx.clear();
    if (r && active >= value.length) {
      this.caretGfx.rect(r.x + r.w / 2 - t.caretWidth / 2, (boxH - caretH) / 2, t.caretWidth + 0.5, caretH).fill(c.caret);
    }
    this.caretGfx.visible = this._focused && !this.isComplete;
    const total = x;
    this.drawFocus(0, 0, total, boxH, t.radius);
    this.body.hitArea = new Rectangle(-4, -4, total + 8, boxH + 8);
  }
  destroy(options) {
    this.webOtpAbort?.abort();
    this.ui.ticker.remove(this.tick, this);
    super.destroy(options);
  }
}
const pad = (n, w2 = 2) => String(n).padStart(w2, "0");
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const weekday = (y, m, d) => new Date(Date.UTC(y, m, d)).getUTCDay();
const key = (v) => v.y * 1e4 + (v.m + 1) * 100 + v.d;
function addDays(v, n) {
  const t = new Date(Date.UTC(v.y, v.m, v.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}
function addMonths(v, n) {
  const total = v.y * 12 + v.m + n;
  const y = Math.floor(total / 12);
  const m = (total % 12 + 12) % 12;
  return { y, m, d: Math.min(v.d, daysInMonth(y, m)) };
}
function today() {
  const n = /* @__PURE__ */ new Date();
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
}
const sameDay = (a, b) => !!a && !!b && key(a) === key(b);
const toISODate = (v) => `${pad(v.y, 4)}-${pad(v.m + 1)}-${pad(v.d)}`;
const toISO = (v, withTime) => withTime ? `${toISODate(v)}T${pad(v.hh)}:${pad(v.mm)}` : toISODate(v);
function parseISO(s) {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2] - 1;
  const d = +m[3];
  const hh = m[4] ? +m[4] : 0;
  const mm = m[5] ? +m[5] : 0;
  if (mo < 0 || mo > 11 || d < 1 || d > daysInMonth(y, mo) || hh > 23 || mm > 59) return null;
  return { y, m: mo, d, hh, mm };
}
function resolveDate(s) {
  if (!s) return null;
  const rel = /^today([+-]\d+)?$/.exec(s.trim());
  if (rel) return addDays(today(), rel[1] ? +rel[1] : 0);
  return parseISO(s);
}
const utcDate = (v, hh = 0, mm = 0) => new Date(Date.UTC(v.y, v.m, v.d, hh, mm));
function formatters(locale) {
  const long = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const medium = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const monthYear = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const monthShort = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const weekdayNarrow = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return {
    long: (v) => long.format(utcDate(v)),
    medium: (v) => medium.format(utcDate(v)),
    monthYear: (y, m) => monthYear.format(utcDate({ y, m, d: 1 })),
    monthShort: (m) => monthShort.format(utcDate({ y: 2024, m, d: 1 })),
    // 2023-01-01 was a Sunday.
    weekdayNarrow: (wd) => weekdayNarrow.format(utcDate({ y: 2023, m: 0, d: 1 + wd })),
    weekdayShort: (wd) => weekdayShort.format(utcDate({ y: 2023, m: 0, d: 1 + wd }))
  };
}
function localeUses12h(locale) {
  return !!new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hour12;
}
function localeFirstDay(locale) {
  try {
    const loc = new Intl.Locale(locale ?? navigator.language);
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info?.firstDay) return info.firstDay % 7;
  } catch {
  }
  return 1;
}
function formatTime(hh, mm, hour12) {
  if (!hour12) return `${pad(hh)}:${pad(mm)}`;
  const h = hh % 12 === 0 ? 12 : hh % 12;
  return `${h}:${pad(mm)} ${hh < 12 ? "AM" : "PM"}`;
}
const PAD = 12;
const HEADER = 36;
const WEEKDAYS_H = 24;
const CELL_H = 38;
const TIME_H = 64;
const FOOTER_H = 36;
class DatePicker extends Control {
  withTime;
  step;
  hour12;
  firstDay;
  placeholder;
  clearable;
  value;
  initial;
  minD;
  maxD;
  isDateDisabledFn;
  defaultTime;
  fmt;
  // closed field
  box = new Graphics();
  icons = new Graphics();
  valueText;
  // popup
  open = false;
  calView = "days";
  zone = "grid";
  viewYear = 2e3;
  viewMonth = 0;
  active = today();
  hover = null;
  typed = "";
  typedTimer = 0;
  popup = new Container();
  catcher = new Graphics();
  panel = new Graphics();
  marks = new Graphics();
  titleText;
  weekdayTexts = [];
  cellTexts = [];
  timeTexts = [];
  footerTexts = [];
  constructor(ui, opts) {
    super(ui, opts);
    const t = typeof opts.time === "object" ? opts.time : {};
    this.withTime = !!opts.time;
    this.step = Math.max(1, Math.min(60, Math.round(t.step ?? 15)));
    this.hour12 = t.hour12 ?? localeUses12h(opts.locale);
    const dt = /^(\d{2}):(\d{2})$/.exec(t.defaultTime ?? "09:00");
    this.defaultTime = dt ? { hh: Math.min(23, +dt[1]), mm: Math.min(59, +dt[2]) } : { hh: 9, mm: 0 };
    this.firstDay = ((opts.firstDayOfWeek ?? localeFirstDay(opts.locale)) % 7 + 7) % 7;
    this.fmt = formatters(opts.locale);
    this.placeholder = opts.placeholder ?? (this.withTime ? "Select date and time" : "Select a date");
    this.clearable = opts.clearable ?? !opts.required;
    this.minD = resolveDate(opts.min);
    this.maxD = resolveDate(opts.max);
    this.isDateDisabledFn = opts.isDateDisabled;
    this.value = this.normalize(parseISO(opts.value ?? null));
    this.initial = this.value ? toISO(this.value, this.withTime) : null;
    const style2 = this.textStyle("body");
    this.valueText = new Text({ text: "", style: style2 });
    this.titleText = new Text({ text: "", style: style2 });
    for (let i = 0; i < 7; i++) this.weekdayTexts.push(new Text({ text: "", style: style2 }));
    for (let i = 0; i < 42; i++) this.cellTexts.push(new Text({ text: "", style: style2 }));
    for (let i = 0; i < 5; i++) this.timeTexts.push(new Text({ text: "", style: style2 }));
    for (let i = 0; i < 3; i++) this.footerTexts.push(new Text({ text: "", style: style2 }));
    for (const txt of [this.titleText, ...this.weekdayTexts, ...this.cellTexts, ...this.timeTexts, ...this.footerTexts]) txt.anchor.set(0.5);
    this.body.addChildAt(this.box, 0);
    this.body.addChild(this.valueText, this.icons);
    this.body.eventMode = "static";
    this.body.cursor = "pointer";
    this.bindTap(this.body, (e) => this.onFieldTap(e));
    this.body.on("pointerover", () => (this._hovered = true, this.drawBody()));
    this.body.on("pointerout", () => (this._hovered = false, this.drawBody()));
    this.catcher.eventMode = "static";
    this.catcher.on("pointerdown", () => {
      this.ui.focus.claimed = true;
      this.setOpen(false);
    });
    this.panel.eventMode = "static";
    this.panel.cursor = "pointer";
    this.panel.on("pointerdown", (e) => {
      this.ui.focus.claimed = true;
      e.stopPropagation();
    });
    this.panel.on("pointertap", (e) => this.onPanelTap(e));
    this.panel.on("pointermove", (e) => {
      const h = this.hitTest(e);
      if (JSON.stringify(h) !== JSON.stringify(this.hover)) {
        this.hover = h;
        this.drawPopup();
      }
    });
    this.panel.on("pointerout", () => (this.hover = null, this.drawPopup()));
    this.popup.addChild(this.catcher, this.panel, this.marks, this.titleText, ...this.weekdayTexts, ...this.cellTexts, ...this.timeTexts, ...this.footerTexts);
    this.marks.eventMode = "none";
    this.redraw();
  }
  // ------------------------------------------------------------------ value
  getValue() {
    return this.value ? toISO(this.value, this.withTime) : null;
  }
  setValue(v, emit = true) {
    const next = this.normalize(parseISO(v));
    if ((next ? toISO(next, this.withTime) : null) === this.getValue()) return;
    this.value = next;
    this.changed(emit);
  }
  /** The value as a JS Date in local time (null when empty). */
  getDate() {
    const v = this.value;
    return v ? new Date(v.y, v.m, v.d, this.withTime ? v.hh : 0, this.withTime ? v.mm : 0) : null;
  }
  isEmpty() {
    return this.value === null;
  }
  reset() {
    this.setOpen(false);
    this.value = this.normalize(parseISO(this.initial));
    this.touched = false;
    this.setError(null);
    this.redraw();
  }
  get isOpen() {
    return this.open;
  }
  normalize(v) {
    if (!v) return null;
    if (!this.withTime) return { ...v, hh: 0, mm: 0 };
    return { ...v, mm: Math.round(v.mm / this.step) * this.step >= 60 ? 60 - this.step : Math.round(v.mm / this.step) * this.step };
  }
  changed(emit) {
    this.drawBody();
    if (this.open) this.drawPopup();
    this.ui.focus.sync(this);
    if (emit) this.commitChange(true);
  }
  isDisabledDate(v) {
    const k = key(v);
    if (this.minD && k < key(this.minD)) return true;
    if (this.maxD && k > key(this.maxD)) return true;
    return !!this.isDateDisabledFn?.(toISO({ ...v, hh: 0, mm: 0 }, false));
  }
  clampToRange(v) {
    if (this.minD && key(v) < key(this.minD)) return { ...this.minD };
    if (this.maxD && key(v) > key(this.maxD)) return { ...this.maxD };
    return v;
  }
  selectDate(v) {
    if (this.isDisabledDate(v)) {
      this.ui.announcer.announce("That date is not available.");
      return;
    }
    const time = this.value ?? { ...this.defaultTime };
    this.value = { ...v, hh: this.withTime ? time.hh : 0, mm: this.withTime ? time.mm : 0 };
    this.active = { ...v };
    this.viewYear = v.y;
    this.viewMonth = v.m;
    this.changed(true);
    if (!this.withTime) this.setOpen(false);
    else this.ui.announcer.announce(`${this.fmt.long(v)} selected. Press Tab to set the time.`);
  }
  adjustTime(zone, dir) {
    const base = this.value ?? { ...this.clampToRange(today()), ...this.defaultTime };
    let { hh, mm } = base;
    if (zone === "hour") hh = (hh + dir + 24) % 24;
    else if (zone === "minute") mm = (mm + dir * this.step + 60) % 60;
    else hh = (hh + 12) % 24;
    this.value = { ...base, hh, mm };
    this.changed(true);
    this.ui.announcer.announce(formatTime(hh, mm, this.hour12));
  }
  typeTime(digit) {
    if (this.zone !== "hour" && this.zone !== "minute") return;
    window.clearTimeout(this.typedTimer);
    this.typed = (this.typed + digit).slice(-2);
    this.typedTimer = window.setTimeout(() => this.typed = "", 900);
    const n = parseInt(this.typed, 10);
    const base = this.value ?? { ...this.clampToRange(today()), ...this.defaultTime };
    let { hh, mm } = base;
    if (this.zone === "hour") {
      if (this.hour12) {
        const h12 = Math.min(12, Math.max(1, n || 12));
        hh = h12 % 12 + (hh >= 12 ? 12 : 0);
      } else hh = Math.min(23, n);
    } else {
      mm = Math.min(59, Math.round(n / this.step) * this.step) % 60;
    }
    this.value = { ...base, hh, mm };
    this.changed(true);
  }
  // ------------------------------------------------------------------ open / close
  setOpen(v) {
    if (v === this.open || v && !this._enabled) return;
    this.open = v;
    if (v) {
      this.active = this.clampToRange(this.value ? { ...this.value } : today());
      this.viewYear = this.active.y;
      this.viewMonth = this.active.m;
      this.calView = "days";
      this.zone = "grid";
      this.hover = null;
      this.ui.overlay.addChild(this.popup);
      this.ui.focus.keyInterceptor = this.popupKeys;
      this.ui.ticker.add(this.follow, this);
      this.drawPopup();
      this.ui.announcer.announce(`Calendar open. ${this.fmt.long(this.active)}. Use arrow keys to choose.`);
    } else {
      this.popup.parent?.removeChild(this.popup);
      if (this.ui.focus.keyInterceptor === this.popupKeys) this.ui.focus.keyInterceptor = null;
      this.ui.ticker.remove(this.follow, this);
    }
    this.ui.focus.sync(this);
    this.drawBody();
  }
  onFocusChanged(focused) {
    if (!focused) this.setOpen(false);
  }
  follow(_t) {
    if (!this.open) return;
    if (!this.isFocusable()) return this.setOpen(false);
    this.positionPopup();
  }
  // ------------------------------------------------------------------ keyboard
  ariaRole() {
    return "combobox";
  }
  ariaLabel() {
    const v = this.value;
    const text = v ? `${this.fmt.long(v)}${this.withTime ? `, ${formatTime(v.hh, v.mm, this.hour12)}` : ""}` : "no date selected";
    return `${super.ariaLabel()}, ${text}`;
  }
  ariaState() {
    return { ...super.ariaState(), "aria-expanded": String(this.open), "aria-haspopup": "dialog" };
  }
  handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " " || e.key === "F4" || e.key === "ArrowDown" && e.altKey) {
      this.setOpen(true);
      return true;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && this.clearable && this.value) {
      this.setValue(null);
      this.ui.announcer.announce("Date cleared");
      return true;
    }
    return false;
  }
  popupKeys = (e) => {
    if (!this.open) return false;
    if (e.key === "Escape") {
      if (this.calView !== "days" && this.zone === "grid") {
        this.calView = this.calView === "years" ? "months" : "days";
        this.drawPopup();
      } else this.setOpen(false);
      return true;
    }
    if (e.key === "Tab") {
      if (!this.withTime) {
        this.setOpen(false);
        return false;
      }
      const zones = this.hour12 ? ["grid", "hour", "minute", "ampm"] : ["grid", "hour", "minute"];
      const i = zones.indexOf(this.zone);
      this.zone = zones[(i + (e.shiftKey ? -1 : 1) + zones.length) % zones.length];
      this.typed = "";
      this.drawPopup();
      this.ui.announcer.announce(this.zone === "grid" ? "Calendar" : this.zone === "ampm" ? "AM or PM" : this.zone);
      return true;
    }
    if (this.zone !== "grid") return this.timeKeys(e);
    if (this.calView === "days") return this.dayKeys(e);
    return this.pickerKeys(e);
  };
  moveActive(next) {
    this.active = next;
    this.viewYear = next.y;
    this.viewMonth = next.m;
    this.drawPopup();
    const v = this.value;
    this.ui.announcer.announce(
      `${this.fmt.long(next)}${this.isDisabledDate(next) ? ", unavailable" : ""}${v && sameDay(v, next) ? ", selected" : ""}`
    );
  }
  dayKeys(e) {
    const a = this.active;
    switch (e.key) {
      case "ArrowLeft":
        this.moveActive(addDays(a, -1));
        return true;
      case "ArrowRight":
        this.moveActive(addDays(a, 1));
        return true;
      case "ArrowUp":
        this.moveActive(addDays(a, -7));
        return true;
      case "ArrowDown":
        this.moveActive(addDays(a, 7));
        return true;
      case "PageUp":
        this.moveActive(addMonths(a, e.shiftKey ? -12 : -1));
        return true;
      case "PageDown":
        this.moveActive(addMonths(a, e.shiftKey ? 12 : 1));
        return true;
      case "Home":
        this.moveActive(addDays(a, -((weekday(a.y, a.m, a.d) - this.firstDay + 7) % 7)));
        return true;
      case "End":
        this.moveActive(addDays(a, 6 - (weekday(a.y, a.m, a.d) - this.firstDay + 7) % 7));
        return true;
      case "t":
      case "T":
        this.moveActive(today());
        return true;
      case "Enter":
      case " ":
        this.selectDate(a);
        return true;
    }
    return e.key.length === 1;
  }
  pickerKeys(e) {
    const months = this.calView === "months";
    const i = months ? this.viewMonth : this.viewYear;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3, PageUp: -12, PageDown: 12 }[e.key];
    if (step !== void 0) {
      if (months) {
        const total = this.viewYear * 12 + i + step;
        this.viewYear = Math.floor(total / 12);
        this.viewMonth = (total % 12 + 12) % 12;
      } else {
        this.viewYear = i + step;
      }
      this.drawPopup();
      this.ui.announcer.announce(months ? this.fmt.monthYear(this.viewYear, this.viewMonth) : String(this.viewYear));
      return true;
    }
    if (e.key === "Enter" || e.key === " ") {
      if (months) {
        this.calView = "days";
        this.active = this.clampToRange({ y: this.viewYear, m: this.viewMonth, d: Math.min(this.active.d, daysInMonth(this.viewYear, this.viewMonth)) });
      } else {
        this.calView = "months";
      }
      this.drawPopup();
      return true;
    }
    return e.key.length === 1;
  }
  timeKeys(e) {
    const z = this.zone;
    switch (e.key) {
      case "ArrowUp":
        this.adjustTime(z, 1);
        return true;
      case "ArrowDown":
        this.adjustTime(z, -1);
        return true;
      case "ArrowLeft":
      case "ArrowRight": {
        const zones = this.hour12 ? ["hour", "minute", "ampm"] : ["hour", "minute"];
        const i = zones.indexOf(z) + (e.key === "ArrowRight" ? 1 : -1);
        this.zone = zones[Math.max(0, Math.min(zones.length - 1, i))];
        this.typed = "";
        this.drawPopup();
        return true;
      }
      case "Enter":
        this.setOpen(false);
        return true;
    }
    if (/^[0-9]$/.test(e.key)) {
      this.typeTime(e.key);
      return true;
    }
    if (z === "ampm" && /^[aApP]$/.test(e.key)) {
      const pm = /p/i.test(e.key);
      const v = this.value;
      if (v && pm !== v.hh >= 12) this.adjustTime("ampm", 1);
      return true;
    }
    return e.key.length === 1;
  }
  // ------------------------------------------------------------------ pointer
  onFieldTap(e) {
    const p = e.getLocalPosition(this.body);
    if (this.clearable && this.value && p.x > this._width - 64 && p.x < this._width - 36) {
      this.setValue(null);
      this.ui.announcer.announce("Date cleared");
      return;
    }
    this.setOpen(!this.open);
  }
  onPanelTap(e) {
    this.ui.focus.claimed = true;
    if (this.ui.focus.gestureMoved) return;
    const h = this.hitTest(e);
    if (!h) return;
    switch (h.kind) {
      case "prev":
      case "next": {
        const d = h.kind === "prev" ? -1 : 1;
        if (this.calView === "days") {
          const t = addMonths({ y: this.viewYear, m: this.viewMonth, d: 1 }, d);
          this.viewYear = t.y;
          this.viewMonth = t.m;
        } else this.viewYear += this.calView === "months" ? d : d * 12;
        break;
      }
      case "title":
        this.calView = this.calView === "days" ? "months" : this.calView === "months" ? "years" : "days";
        break;
      case "cell":
        if (this.calView === "days") {
          const date = this.cellDate(h.index);
          return this.selectDate(date);
        }
        if (this.calView === "months") {
          this.viewMonth = h.index;
          this.calView = "days";
        } else {
          this.viewYear = this.yearPageStart() + h.index;
          this.calView = "months";
        }
        break;
      case "time":
        this.zone = h.zone;
        this.adjustTime(h.zone, h.dir);
        return;
      case "today": {
        const t = this.clampToRange(today());
        this.calView = "days";
        return this.selectDate(t);
      }
      case "clear":
        this.setValue(null);
        this.setOpen(false);
        return;
      case "done":
        this.setOpen(false);
        return;
    }
    this.drawPopup();
  }
  // ------------------------------------------------------------------ geometry
  popupWidth() {
    return Math.min(328, this.ui.app.screen.width - 16);
  }
  gridTop() {
    return PAD + HEADER + 6;
  }
  gridHeight() {
    return WEEKDAYS_H + CELL_H * 6;
  }
  timeTop() {
    return this.gridTop() + this.gridHeight() + 8;
  }
  footerTop() {
    return this.withTime ? this.timeTop() + TIME_H + 8 : this.gridTop() + this.gridHeight() + 8;
  }
  popupHeight() {
    return this.footerTop() + FOOTER_H + PAD;
  }
  gridOffset() {
    return (weekday(this.viewYear, this.viewMonth, 1) - this.firstDay + 7) % 7;
  }
  cellDate(i) {
    return addDays({ y: this.viewYear, m: this.viewMonth, d: 1 }, i - this.gridOffset());
  }
  yearPageStart() {
    return Math.floor(this.viewYear / 12) * 12;
  }
  timeBoxes() {
    const W = this.popupWidth();
    const w2 = 56;
    const gap = 10;
    const zones = this.hour12 ? ["hour", "minute", "ampm"] : ["hour", "minute"];
    const total = zones.length * w2 + (zones.length - 1) * gap + 14;
    let x = W - PAD - total;
    return zones.map((zone, i) => {
      const box = { zone, x, w: w2 };
      x += w2 + gap + (i === 0 ? 14 : 0);
      return box;
    });
  }
  hitTest(e) {
    const p = e.getLocalPosition(this.panel);
    const W = this.popupWidth();
    if (p.y >= PAD && p.y <= PAD + HEADER) {
      if (p.x < PAD + HEADER) return { kind: "prev" };
      if (p.x > W - PAD - HEADER) return { kind: "next" };
      return { kind: "title" };
    }
    const gt = this.gridTop();
    const gw = W - PAD * 2;
    if (p.y >= gt && p.y < gt + this.gridHeight() && p.x >= PAD && p.x < W - PAD) {
      if (this.calView === "days") {
        if (p.y < gt + WEEKDAYS_H) return null;
        const col2 = Math.floor((p.x - PAD) / gw * 7);
        const row2 = Math.floor((p.y - gt - WEEKDAYS_H) / CELL_H);
        return { kind: "cell", index: row2 * 7 + col2 };
      }
      const col = Math.floor((p.x - PAD) / gw * 3);
      const row = Math.floor((p.y - gt) / this.gridHeight() * 4);
      return { kind: "cell", index: row * 3 + col };
    }
    if (this.withTime) {
      const tt = this.timeTop() + 8;
      if (p.y >= tt && p.y <= tt + 48) {
        for (const b of this.timeBoxes()) {
          if (p.x >= b.x && p.x <= b.x + b.w) {
            if (b.zone === "ampm") return { kind: "time", zone: "ampm", dir: 1 };
            return { kind: "time", zone: b.zone, dir: p.y < tt + 24 ? 1 : -1 };
          }
        }
      }
    }
    const ft = this.footerTop();
    if (p.y >= ft && p.y <= ft + FOOTER_H) {
      if (p.x < PAD + 76) return { kind: "today" };
      if (this.clearable && this.value && p.x < PAD + 152) return { kind: "clear" };
      if (this.withTime && p.x > W - PAD - 80) return { kind: "done" };
    }
    return null;
  }
  positionPopup() {
    const b = this.body.getBounds();
    const screen = this.ui.app.screen;
    const W = this.popupWidth();
    const H = this.popupHeight();
    const below = b.y + b.height + 6;
    let y;
    if (below + H <= screen.height - 8) y = below;
    else if (b.y - H - 6 >= 8) y = b.y - H - 6;
    else y = Math.max(8, screen.height - H - 8);
    const x = Math.max(8, Math.min(b.x, screen.width - W - 8));
    const local = this.ui.overlay.toLocal({ x, y });
    this.popup.position.set(local.x, local.y);
    const origin = this.popup.toLocal({ x: 0, y: 0 });
    this.catcher.clear().rect(origin.x, origin.y, screen.width, screen.height).fill({ color: 0, alpha: 1e-3 });
  }
  // ------------------------------------------------------------------ drawing: popup
  drawPopup() {
    if (!this.open) return;
    this.positionPopup();
    const t = this.theme;
    const c = t.colors;
    const W = this.popupWidth();
    const H = this.popupHeight();
    const g = this.marks.clear();
    this.panel.clear().roundRect(0, 6, W, H, t.radius + 4).fill({ color: c.shadow, alpha: 0.14 }).roundRect(0, 0, W, H, t.radius + 4).fill(c.surface).stroke({ width: 1, color: c.border, alignment: 1 });
    this.panel.hitArea = new Rectangle(0, 0, W, H);
    const hov = (h) => JSON.stringify(h) === JSON.stringify(this.hover);
    const style2 = (size, fill, weight = t.fontWeight) => ({
      fontFamily: t.fontFamily.join(","),
      fontSize: size,
      fill,
      fontWeight: weight
    });
    for (const [kind, cx, dir] of [["prev", PAD + HEADER / 2, "left"], ["next", W - PAD - HEADER / 2, "right"]]) {
      if (hov({ kind })) g.circle(cx, PAD + HEADER / 2, 16).fill({ color: c.text, alpha: 0.07 });
      Icons.arrow(g, cx, PAD + HEADER / 2, 20, c.text, dir);
    }
    const title2 = this.calView === "days" ? this.fmt.monthYear(this.viewYear, this.viewMonth) : this.calView === "months" ? String(this.viewYear) : `${this.yearPageStart()} – ${this.yearPageStart() + 11}`;
    this.titleText.text = title2;
    this.titleText.style = style2(t.fontSize, c.text, "600");
    this.titleText.position.set(W / 2 - 8, PAD + HEADER / 2);
    if (hov({ kind: "title" })) g.roundRect(W / 2 - this.titleText.width / 2 - 14, PAD + 4, this.titleText.width + 36, HEADER - 8, 8).fill({ color: c.text, alpha: 0.07 });
    Icons.chevron(g, W / 2 + this.titleText.width / 2 + 4, PAD + HEADER / 2, 16, c.textMuted, this.calView !== "days");
    const gt = this.gridTop();
    const gw = W - PAD * 2;
    const todayD = today();
    for (const txt of [...this.weekdayTexts, ...this.cellTexts]) txt.visible = false;
    const focusRing = (x, y, w2, h, r) => g.roundRect(x - 2, y - 2, w2 + 4, h + 4, r + 2).stroke({ width: 2, color: c.focusRing });
    if (this.calView === "days") {
      const cw = gw / 7;
      for (let i = 0; i < 7; i++) {
        const wt = this.weekdayTexts[i];
        wt.visible = true;
        wt.text = this.fmt.weekdayShort((this.firstDay + i) % 7).slice(0, 2);
        wt.style = style2(t.helperFontSize, c.textMuted, "600");
        wt.position.set(PAD + cw * i + cw / 2, gt + WEEKDAYS_H / 2);
      }
      for (let i = 0; i < 42; i++) {
        const d = this.cellDate(i);
        const x = PAD + i % 7 * cw;
        const y = gt + WEEKDAYS_H + Math.floor(i / 7) * CELL_H;
        const inMonth = d.m === this.viewMonth;
        const disabled = this.isDisabledDate(d);
        const selected = sameDay(this.value, d);
        const isToday = sameDay(todayD, d);
        const isActive = sameDay(this.active, d) && this.zone === "grid";
        const r = Math.min(cw, CELL_H) / 2 - 3;
        const cx = x + cw / 2;
        const cy = y + CELL_H / 2;
        if (selected) g.circle(cx, cy, r).fill(disabled ? c.textDisabled : c.primary);
        else if (hov({ kind: "cell", index: i }) && !disabled) g.circle(cx, cy, r).fill({ color: c.primary, alpha: 0.1 });
        if (isToday && !selected) g.circle(cx, cy, r).stroke({ width: 1.5, color: c.primary });
        if (isActive) g.circle(cx, cy, r + 3).stroke({ width: 2, color: c.focusRing });
        const txt = this.cellTexts[i];
        txt.visible = true;
        txt.text = String(d.d);
        txt.style = style2(t.fontSize - 1, selected ? c.primaryText : disabled ? c.textDisabled : inMonth ? c.text : c.textMuted, selected || isToday ? "600" : t.fontWeight);
        txt.alpha = inMonth || selected ? 1 : 0.55;
        txt.position.set(cx, cy);
        if (disabled && inMonth) g.moveTo(cx - 7, cy + 1).lineTo(cx + 7, cy + 1).stroke({ width: 1, color: c.textDisabled });
      }
    } else {
      const cw = gw / 3;
      const ch = this.gridHeight() / 4;
      for (let i = 0; i < 12; i++) {
        const x = PAD + i % 3 * cw;
        const y = gt + Math.floor(i / 3) * ch;
        const months = this.calView === "months";
        const label = months ? this.fmt.monthShort(i) : String(this.yearPageStart() + i);
        const isSel = months ? !!this.value && this.value.y === this.viewYear && this.value.m === i : !!this.value && this.value.y === this.yearPageStart() + i;
        const isCur = months ? this.viewMonth === i : this.viewYear === this.yearPageStart() + i;
        const bx = x + 6;
        const by = y + 8;
        const bw = cw - 12;
        const bh = ch - 16;
        if (isSel) g.roundRect(bx, by, bw, bh, 10).fill(c.primary);
        else if (hov({ kind: "cell", index: i })) g.roundRect(bx, by, bw, bh, 10).fill({ color: c.primary, alpha: 0.1 });
        if (isCur && this.zone === "grid") focusRing(bx, by, bw, bh, 10);
        const txt = this.cellTexts[i];
        txt.visible = true;
        txt.alpha = 1;
        txt.text = label;
        txt.style = style2(t.fontSize, isSel ? c.primaryText : c.text, isSel ? "600" : t.fontWeight);
        txt.position.set(x + cw / 2, y + ch / 2);
      }
    }
    for (const txt of this.timeTexts) txt.visible = false;
    if (this.withTime) {
      const tt = this.timeTop();
      g.moveTo(PAD, tt).lineTo(W - PAD, tt).stroke({ width: 1, color: c.border, alpha: 0.6 });
      const v = this.value ?? { ...this.clampToRange(today()), ...this.defaultTime };
      const label = this.timeTexts[0];
      label.visible = true;
      label.text = "Time";
      label.style = style2(t.fontSize - 1, c.textMuted, "500");
      label.position.set(PAD + label.width / 2, tt + 8 + 24);
      const boxes = this.timeBoxes();
      boxes.forEach((b, i) => {
        const by = tt + 8;
        const focused = this.zone === b.zone;
        g.roundRect(b.x, by, b.w, 48, 10).fill(c.surface).stroke({ width: focused ? 2 : 1, color: focused ? c.borderFocus : c.border, alignment: 1 });
        if (b.zone !== "ampm") {
          const up = hov({ kind: "time", zone: b.zone, dir: 1 });
          const down = hov({ kind: "time", zone: b.zone, dir: -1 });
          Icons.arrow(g, b.x + b.w / 2, by + 7, 12, up ? c.primary : c.textMuted, "up");
          Icons.arrow(g, b.x + b.w / 2, by + 41, 12, down ? c.primary : c.textMuted, "down");
        }
        const txt = this.timeTexts[i + 1];
        txt.visible = true;
        const h12 = v.hh % 12 === 0 ? 12 : v.hh % 12;
        txt.text = b.zone === "hour" ? String(this.hour12 ? h12 : v.hh).padStart(2, "0") : b.zone === "minute" ? String(v.mm).padStart(2, "0") : v.hh < 12 ? "AM" : "PM";
        txt.style = style2(t.fontSize + 1, this.value ? c.text : c.placeholder, "600");
        txt.position.set(b.x + b.w / 2, by + 24);
        if (i === 0) {
          const colon = this.timeTexts[4];
          colon.visible = true;
          colon.text = ":";
          colon.style = style2(t.fontSize + 2, c.textMuted, "600");
          colon.position.set(b.x + b.w + 12, by + 23);
        }
      });
    }
    const ft = this.footerTop();
    const items = [{ kind: "today", label: "Today", x: PAD + 38 }];
    if (this.clearable && this.value) items.push({ kind: "clear", label: "Clear", x: PAD + 114 });
    if (this.withTime) items.push({ kind: "done", label: "Done", x: W - PAD - 40, strong: true });
    this.footerTexts.forEach((txt) => txt.visible = false);
    items.forEach((it, i) => {
      const txt = this.footerTexts[i];
      txt.visible = true;
      txt.text = it.label;
      txt.style = style2(t.fontSize - 1, it.strong ? c.primaryText : c.primary, "600");
      txt.position.set(it.x, ft + FOOTER_H / 2);
      const bw = Math.max(64, txt.width + 24);
      if (it.strong) g.roundRect(it.x - bw / 2, ft + 2, bw, FOOTER_H - 4, 9).fill(hov({ kind: it.kind }) ? c.primaryHover : c.primary);
      else if (hov({ kind: it.kind })) g.roundRect(it.x - bw / 2, ft + 2, bw, FOOTER_H - 4, 9).fill({ color: c.primary, alpha: 0.1 });
    });
  }
  // ------------------------------------------------------------------ drawing: field
  bodyHeight() {
    return this.theme.controlHeight;
  }
  drawBody() {
    if (!this.valueText) return;
    const t = this.theme;
    const c = t.colors;
    const w2 = this._width;
    const h = this.bodyHeight();
    const border = !this._enabled ? c.border : this.hasErrorState ? c.error : this._focused || this.open ? c.borderFocus : this._hovered ? c.borderHover : c.border;
    this.box.clear().roundRect(0, 0, w2, h, t.radius).fill(!this._enabled ? c.surfaceDisabled : this._hovered && !this._focused ? c.surfaceHover : c.surface).stroke({ width: this._focused ? t.borderWidth + 0.5 : t.borderWidth, color: border, alignment: 1 });
    const v = this.value;
    this.valueText.text = v ? `${this.fmt.medium(v)}${this.withTime ? ` · ${formatTime(v.hh, v.mm, this.hour12)}` : ""}` : this.placeholder;
    this.valueText.style = this.textStyle("body", !this._enabled ? c.textDisabled : v ? c.text : c.placeholder);
    this.valueText.position.set(t.paddingX, Math.round((h - this.valueText.height) / 2));
    const ic = this.icons.clear();
    Icons.calendar(ic, w2 - 22, h / 2, 22, this._enabled ? this.open ? c.primary : c.textMuted : c.textDisabled);
    if (this.clearable && v && this._enabled) Icons.close(ic, w2 - 50, h / 2, 16, c.textMuted);
    this.drawFocus(0, 0, w2, h, t.radius);
    this.body.hitArea = new Rectangle(0, 0, w2, h);
    if (this.open) this.drawPopup();
  }
  destroy(options) {
    this.setOpen(false);
    window.clearTimeout(this.typedTimer);
    this.popup.destroy({ children: true });
    super.destroy(options);
  }
}
const COUNTRIES = [
  { iso: "IN", name: "India", dial: "91", pattern: "##### #####", min: 10, max: 10, trunk: "0" },
  { iso: "US", name: "United States", dial: "1", pattern: "(###) ###-####", min: 10, max: 10 },
  { iso: "CA", name: "Canada", dial: "1", pattern: "(###) ###-####", min: 10, max: 10 },
  { iso: "GB", name: "United Kingdom", dial: "44", pattern: "#### ######", min: 9, max: 10, trunk: "0" },
  { iso: "AU", name: "Australia", dial: "61", pattern: "### ### ###", min: 9, max: 9, trunk: "0" },
  { iso: "DE", name: "Germany", dial: "49", pattern: "### ########", min: 6, max: 11, trunk: "0" },
  { iso: "FR", name: "France", dial: "33", pattern: "# ## ## ## ##", min: 9, max: 9, trunk: "0" },
  { iso: "ES", name: "Spain", dial: "34", pattern: "### ## ## ##", min: 9, max: 9 },
  { iso: "IT", name: "Italy", dial: "39", pattern: "### ### ####", min: 6, max: 11 },
  { iso: "NL", name: "Netherlands", dial: "31", pattern: "# ########", min: 9, max: 9, trunk: "0" },
  { iso: "IE", name: "Ireland", dial: "353", pattern: "## ### ####", min: 7, max: 9, trunk: "0" },
  { iso: "SE", name: "Sweden", dial: "46", pattern: "##-### ## ##", min: 7, max: 9, trunk: "0" },
  { iso: "CH", name: "Switzerland", dial: "41", pattern: "## ### ## ##", min: 9, max: 9, trunk: "0" },
  { iso: "TR", name: "Turkey", dial: "90", pattern: "### ### ## ##", min: 10, max: 10, trunk: "0" },
  { iso: "RU", name: "Russia", dial: "7", pattern: "### ###-##-##", min: 10, max: 10, trunk: "8" },
  { iso: "IL", name: "Israel", dial: "972", pattern: "##-###-####", min: 8, max: 9, trunk: "0" },
  { iso: "AE", name: "United Arab Emirates", dial: "971", pattern: "## ### ####", min: 8, max: 9, trunk: "0" },
  { iso: "SA", name: "Saudi Arabia", dial: "966", pattern: "## ### ####", min: 9, max: 9, trunk: "0" },
  { iso: "EG", name: "Egypt", dial: "20", pattern: "### ### ####", min: 10, max: 10, trunk: "0" },
  { iso: "ZA", name: "South Africa", dial: "27", pattern: "## ### ####", min: 9, max: 9, trunk: "0" },
  { iso: "NG", name: "Nigeria", dial: "234", pattern: "### ### ####", min: 10, max: 10, trunk: "0" },
  { iso: "KE", name: "Kenya", dial: "254", pattern: "### ######", min: 9, max: 9, trunk: "0" },
  { iso: "PK", name: "Pakistan", dial: "92", pattern: "### #######", min: 10, max: 10, trunk: "0" },
  { iso: "BD", name: "Bangladesh", dial: "880", pattern: "####-######", min: 10, max: 10, trunk: "0" },
  { iso: "LK", name: "Sri Lanka", dial: "94", pattern: "## ### ####", min: 9, max: 9, trunk: "0" },
  { iso: "NP", name: "Nepal", dial: "977", pattern: "###-#######", min: 8, max: 10, trunk: "0" },
  { iso: "CN", name: "China", dial: "86", pattern: "### #### ####", min: 11, max: 11, trunk: "0" },
  { iso: "HK", name: "Hong Kong", dial: "852", pattern: "#### ####", min: 8, max: 8 },
  { iso: "JP", name: "Japan", dial: "81", pattern: "##-####-####", min: 9, max: 10, trunk: "0" },
  { iso: "KR", name: "South Korea", dial: "82", pattern: "##-####-####", min: 9, max: 10, trunk: "0" },
  { iso: "SG", name: "Singapore", dial: "65", pattern: "#### ####", min: 8, max: 8 },
  { iso: "MY", name: "Malaysia", dial: "60", pattern: "##-### ####", min: 9, max: 10, trunk: "0" },
  { iso: "ID", name: "Indonesia", dial: "62", pattern: "###-####-####", min: 9, max: 12, trunk: "0" },
  { iso: "PH", name: "Philippines", dial: "63", pattern: "### ### ####", min: 10, max: 10, trunk: "0" },
  { iso: "TH", name: "Thailand", dial: "66", pattern: "## ### ####", min: 9, max: 9, trunk: "0" },
  { iso: "VN", name: "Vietnam", dial: "84", pattern: "### ### ####", min: 9, max: 10, trunk: "0" },
  { iso: "NZ", name: "New Zealand", dial: "64", pattern: "## ### ####", min: 8, max: 10, trunk: "0" },
  { iso: "BR", name: "Brazil", dial: "55", pattern: "(##) #####-####", min: 10, max: 11 },
  { iso: "MX", name: "Mexico", dial: "52", pattern: "## #### ####", min: 10, max: 10 },
  { iso: "AR", name: "Argentina", dial: "54", pattern: "## ####-####", min: 10, max: 11, trunk: "0" }
];
function flagEmoji(iso) {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 127462 + c.charCodeAt(0) - 65));
}
function formatNational(digits, pattern) {
  let out = "";
  let i = 0;
  for (const ch of pattern) {
    if (i >= digits.length) break;
    if (ch === "#") out += digits[i++];
    else out += ch;
  }
  if (i < digits.length) out += (out ? " " : "") + digits.slice(i);
  return out.replace(/[\s\-–(]+$/, "");
}
const IS_WINDOWS = /Win/.test(navigator.platform || navigator.userAgent);
class NationalNumberField extends TextInput {
  onInternational = null;
  /** Multi-character input (SMS/contact autofill, IME commit) with a + or 00 prefix is a full number. */
  handleText(text) {
    if (this.onInternational && text.length > 1 && /^\s*(\+|00)/.test(text)) {
      this.onInternational(text);
      return;
    }
    super.handleText(text);
  }
  handlePaste(text) {
    if (this.onInternational && /^\s*(\+|00)/.test(text)) {
      this.onInternational(text);
      return;
    }
    super.handlePaste(text);
  }
}
class PhoneInput extends Control {
  focusInside = false;
  countryField;
  numberField;
  countries;
  byIso = /* @__PURE__ */ new Map();
  initial;
  initialCountry;
  country;
  formatting = false;
  baseLabel = "";
  width_ = 0;
  constructor(ui, opts) {
    super(ui, opts);
    let list = opts.countries ?? COUNTRIES;
    if (opts.onlyCountries?.length) list = list.filter((c) => opts.onlyCountries.includes(c.iso));
    const pref = opts.preferredCountries ?? [];
    this.countries = [...pref.map((p) => list.find((c) => c.iso === p)).filter((c) => !!c), ...list.filter((c) => !pref.includes(c.iso))];
    for (const c of this.countries) this.byIso.set(c.iso, c);
    const region = (navigator.language.split("-")[1] ?? "").toUpperCase();
    this.initialCountry = this.byIso.has(opts.defaultCountry ?? "") ? opts.defaultCountry : this.byIso.has(region) ? region : this.byIso.has("US") ? "US" : this.countries[0].iso;
    this.country = this.byIso.get(this.initialCountry);
    const flags = opts.showFlags ?? !IS_WINDOWS;
    const badge = (c) => flags ? `${flagEmoji(c.iso)}  +${c.dial}` : `${c.iso} +${c.dial}`;
    const childBase = { theme: opts.theme, disabled: opts.disabled, hideLabel: true };
    this.countryField = new Select(ui, {
      ...childBase,
      name: `${this.fieldName}Country`,
      label: `${opts.label ?? "Phone"} country code`,
      value: this.country.iso,
      // Plain labels drive type-ahead ("uni" → United…) and screen readers; flags are display-only.
      options: this.countries.map((c) => ({ value: c.iso, label: `${c.name} (+${c.dial})` })),
      formatOption: (o) => flags ? `${flagEmoji(o.value)}  ${o.label}` : o.label,
      formatSelected: (o) => badge(this.byIso.get(o.value)),
      menuWidth: 300,
      validateOn: "submit"
    });
    this.numberField = new NationalNumberField(ui, {
      ...childBase,
      name: `${this.fieldName}Number`,
      label: opts.label ?? "Phone number",
      placeholder: opts.placeholder ?? this.example(),
      inputMode: "tel",
      allow: /[0-9 +]/,
      maxLength: 22,
      validateOn: "submit"
    });
    this.numberField.onInternational = (text) => this.applyInternational(text);
    this.baseLabel = opts.label ?? "Phone number";
    this.syncNumberLabel();
    this.body.addChild(this.countryField, this.numberField);
    this.countryField.on("change", (iso) => {
      this.country = this.byIso.get(iso) ?? this.country;
      if (!opts.placeholder) this.numberField.placeholder = this.example();
      this.syncNumberLabel();
      this.reformat(true);
      this.commitChange(true);
      if (this.countryField.focused) this.numberField.focus();
    });
    this.numberField.on("input", () => this.reformat(false));
    this.numberField.on("change", () => !this.formatting && this.commitChange(true));
    this.numberField.on("submit", () => this.emit("submit", this));
    for (const child of [this.countryField, this.numberField]) {
      child.on("resize", () => this.redraw());
      child.on("blur", () => queueMicrotask(() => this.onChildBlur()));
      child.on("focus", () => {
        if (this.focusInside) return;
        this.focusInside = true;
        this.emit("focus", this);
      });
    }
    this.validators.unshift((v) => this.lengthError(v));
    this.initial = opts.value ?? "";
    if (this.initial) this.setValue(this.initial, false);
    this.redraw();
  }
  // ------------------------------------------------------------------ value
  /** E.164, e.g. '+919876543210'. '' when no digits are entered. */
  getValue() {
    const raw = this.numberField?.getValue() ?? "";
    if (/^\s*(\+|00)/.test(raw)) {
      const d = raw.replace(/\D/g, "").replace(/^00/, "");
      return d ? `+${d}` : "";
    }
    const digits = this.nationalDigits();
    return digits ? `+${this.country.dial}${digits}` : "";
  }
  setValue(value, emit = true) {
    if (!value) {
      this.numberField.setValue("", false);
    } else {
      this.applyInternational(value, false);
    }
    if (emit) this.commitChange(true);
    else this.redraw();
  }
  /** Selected country, national digits and E.164 value. */
  getParts() {
    return { country: this.country, national: this.nationalDigits(), e164: this.getValue() };
  }
  isEmpty() {
    return this.nationalDigits().length === 0;
  }
  reset() {
    this.countryField.setValue(this.initialCountry, false);
    this.country = this.byIso.get(this.initialCountry);
    this.numberField.reset();
    if (this.initial) this.applyInternational(this.initial, false);
    this.touched = false;
    this.setError(null);
    this.redraw();
  }
  /** Focus goes to the number part. */
  focus() {
    this.numberField.focus();
  }
  isFocusable() {
    return false;
  }
  setError(message, code) {
    super.setError(message, code);
    this.countryField?.markInvalid(!!message);
    this.numberField?.markInvalid(!!message);
  }
  get enabled() {
    return this._enabled;
  }
  set enabled(v) {
    super.enabled = v;
    this.countryField.enabled = v;
    this.numberField.enabled = v;
  }
  // ------------------------------------------------------------------ helpers
  /** Screen readers hear the country with the number, e.g. "Phone, United Kingdom +44". */
  syncNumberLabel() {
    this.numberField.fieldLabel = `${this.baseLabel}, ${this.country.name} +${this.country.dial}`;
    this.ui.focus.sync(this.numberField);
  }
  nationalDigits() {
    let d = (this.numberField?.getValue() ?? "").replace(/\D/g, "");
    const trunk = this.country.trunk;
    if (trunk && d.startsWith(trunk)) d = d.slice(trunk.length);
    return d;
  }
  example() {
    const c = this.country;
    return formatNational("9876543210987".slice(0, c.max), c.pattern);
  }
  lengthError(value) {
    if (!value) return null;
    const n = this.nationalDigits().length;
    const c = this.country;
    if (n < c.min || n > c.max) {
      const len = c.min === c.max ? `${c.min}` : `${c.min}–${c.max}`;
      return `Enter a valid ${c.name} number (${len} digits).`;
    }
    if (value.length > 16) return "Phone numbers can have at most 15 digits.";
    return null;
  }
  /** Live formatting while the caret is at the end of the number. */
  reformat(force) {
    const f = this.numberField;
    const raw = f.getValue();
    if (/^\s*(\+|00)/.test(raw)) {
      const d = raw.replace(/\D/g, "").replace(/^00/, "");
      if (force || d.length >= 8) this.applyInternational(raw, false);
      return;
    }
    let digits = raw.replace(/\D/g, "");
    const trunk = this.country.trunk;
    if (trunk && digits.startsWith(trunk)) digits = digits.slice(trunk.length);
    const formatted = formatNational(digits, this.country.pattern);
    const [, selEnd] = f.getSelection();
    if (formatted !== raw && (force || selEnd === f.length)) {
      this.formatting = true;
      f.setValue(formatted, false);
      this.formatting = false;
    }
  }
  /** Parses '+44 7911 123456' / '0044…', picks the country, keeps the national digits. */
  applyInternational(text, emit = true) {
    let digits = text.replace(/\D/g, "");
    if (/^\s*00/.test(text)) digits = digits.slice(2);
    let match;
    for (const c of this.countries) {
      if (!digits.startsWith(c.dial)) continue;
      if (!match || c.dial.length > match.dial.length || c.dial === match.dial && c.iso === this.country.iso) match = c;
    }
    if (match) {
      this.country = match;
      this.countryField.setValue(match.iso, false);
      digits = digits.slice(match.dial.length);
      this.numberField.placeholder = this.example();
      this.syncNumberLabel();
    }
    this.numberField.setValue(formatNational(digits, this.country.pattern), false);
    if (emit) {
      this.ui.announcer.announce(`${this.country.name}, +${this.country.dial}`);
      this.commitChange(true);
    }
    this.redraw();
  }
  onChildBlur() {
    const cur = this.ui.focus.current;
    if (cur === this.countryField || cur === this.numberField) return;
    this.focusInside = false;
    this.touched = true;
    this.reformat(true);
    if (this.validateOn === "blur" || this._error) void this.validate();
    this.emit("blur", this);
  }
  // ------------------------------------------------------------------ layout
  bodyHeight() {
    if (!this.countryField) return this.theme.controlHeight;
    return Math.max(this.countryField.layoutHeight, this.numberField.layoutHeight);
  }
  drawBody() {
    if (!this.countryField || !this.numberField) return;
    if (this.width_ !== this._width) {
      this.width_ = this._width;
      const cw = Math.round(Math.max(104, Math.min(140, this._width * 0.32)));
      this.countryField.layout(cw);
      this.numberField.layout(this._width - cw - 8);
      this.numberField.x = cw + 8;
    }
  }
  layout(width) {
    this.width_ = 0;
    super.layout(width);
  }
}
let autoId = 0;
class FieldGroup extends Control {
  content;
  variant;
  collapsible;
  bg = new Graphics();
  header = new Container();
  chevron = new Graphics();
  badge = new Graphics();
  titleText;
  descText;
  badgeText;
  _title;
  _description;
  _expanded;
  laying = false;
  watched = /* @__PURE__ */ new Set();
  focusInside = false;
  constructor(ui, opts) {
    super(ui, { ...opts, name: opts.name ?? `group${++autoId}`, label: opts.title, hideLabel: true });
    this.labelAbove = false;
    this.variant = opts.variant ?? "outline";
    this.collapsible = !!opts.collapsible;
    this._expanded = !(this.collapsible && opts.collapsed);
    this._title = opts.title;
    this._description = opts.description ?? "";
    this.titleText = new Text({ text: "" });
    this.descText = new Text({ text: "" });
    this.badgeText = new Text({ text: "" });
    this.content = new Column([], opts.gap ?? 18);
    this.content.visible = this._expanded;
    this.badge.addChild(this.badgeText);
    this.header.addChild(this.titleText, this.descText, this.badge, this.chevron);
    this.body.addChildAt(this.bg, 0);
    this.body.addChild(this.header, this.content);
    this.content.on("resize", () => {
      if (!this.laying) this.redraw();
    });
    if (this.collapsible) {
      this.header.eventMode = "static";
      this.header.cursor = "pointer";
      this.bindTap(this.header, () => this.toggle());
      this.header.on("pointerover", () => (this._hovered = true, this.drawBody()));
      this.header.on("pointerout", () => (this._hovered = false, this.drawBody()));
    }
    ui.on("focuschange", this.onFocusChange, this);
    if (opts.disabled) queueMicrotask(() => this.setDisabled(true));
    this.redraw();
  }
  // ---------------------------------------------------------------- API
  /** Adds fields (or rows, labels, nested groups). */
  add(...items) {
    this.laying = true;
    this.content.add(...items);
    this.laying = false;
    for (const it of items) this.watch(it);
    if (this._width) this.layout(this._width);
    return this;
  }
  get title() {
    return this._title;
  }
  set title(v) {
    this._title = v;
    this._label = v;
    this.redraw();
    this.ui.focus.sync(this);
  }
  get description() {
    return this._description;
  }
  set description(v) {
    this._description = v ?? "";
    this.redraw();
  }
  get expanded() {
    return this._expanded;
  }
  /** Opens or folds the group (no-op for non-collapsible groups when folding). */
  setExpanded(expanded) {
    if (!this.collapsible && !expanded) return;
    if (expanded === this._expanded) return;
    this._expanded = expanded;
    this.content.visible = expanded;
    const cur = this.ui.focus.current;
    if (!expanded && cur && cur !== this && this.containsView(cur.view)) {
      if (this.isFocusable()) this.ui.focus.focus(this, true);
      else this.ui.focus.blur();
    }
    this.redraw();
    this.ui.focus.sync(this);
    this.ui.announcer.announce(`${this._title} ${expanded ? "expanded" : "collapsed"}`);
    this.emit("toggle", expanded);
  }
  toggle() {
    this.setExpanded(!this._expanded);
  }
  /** Every control inside the group (including nested groups' fields). */
  controls() {
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        if (c instanceof FieldGroup) walk(c.content);
        else if (c instanceof Control) out.push(c);
        else walk(c);
      }
    };
    walk(this.content);
    return out;
  }
  /** Number of fields inside that currently show an error. */
  get errorCount() {
    return this.controls().filter((c) => !!c.error).length;
  }
  /** Enables/disables every control inside the group. */
  setDisabled(disabled) {
    for (const c of this.controls()) c.enabled = !disabled;
  }
  // ---------------------------------------------------------------- Control
  getValue() {
    return null;
  }
  setValue() {
  }
  reset() {
  }
  isEmpty() {
    return false;
  }
  isFocusable() {
    return this.collapsible && super.isFocusable();
  }
  layout(width) {
    this._width = Math.max(120, width);
    this.laying = true;
    this.content.layout(this.innerWidth());
    this.laying = false;
    this.redraw();
  }
  ariaRole() {
    return "button";
  }
  ariaLabel() {
    return this._title;
  }
  ariaDescription() {
    const n = this.errorCount;
    const help = [this._description, this._info].filter(Boolean).join(". ");
    return {
      help: help || void 0,
      error: n ? `${n} field${n > 1 ? "s need" : " needs"} attention` : void 0
    };
  }
  activate() {
    if (this.collapsible) this.toggle();
  }
  /** Accessibility outline: a labelled group, with the header as a button when collapsible. */
  a11yGroup() {
    return {
      title: this._title,
      description: [this._description, this._info].filter(Boolean).join(". ") || void 0,
      expanded: this._expanded,
      content: this.content,
      header: this.collapsible ? this : null,
      headerView: this.header
    };
  }
  ariaState() {
    return { "aria-expanded": this.collapsible ? String(this._expanded) : null };
  }
  handleKeyDown(e) {
    if (!this.collapsible) return false;
    if (e.key === "Enter" || e.key === " ") {
      if (!e.repeat) this.toggle();
      return true;
    }
    if (e.key === "ArrowRight" && !this._expanded) return this.setExpanded(true), true;
    if (e.key === "ArrowLeft" && this._expanded) return this.setExpanded(false), true;
    return false;
  }
  // ---------------------------------------------------------------- layout + drawing
  pad() {
    if (this.variant === "plain") return { x: 0, y: 0 };
    return { x: this._width < 440 ? 14 : 20, y: this._width < 440 ? 14 : 18 };
  }
  innerWidth() {
    return Math.max(80, this._width - this.pad().x * 2);
  }
  headerHeightPx() {
    const t = this.theme;
    const titleH = Math.ceil((t.fontSize + 1) * t.lineHeight);
    const descH = this._description ? Math.ceil(this.descText.height) + 2 : 0;
    return Math.max(titleH + descH, 24);
  }
  sectionGap() {
    return this.variant === "plain" ? 14 : 16;
  }
  bodyHeight() {
    const p = this.pad();
    const content = this._expanded ? this.sectionGap() + this.content.layoutHeight : 0;
    return p.y + this.headerHeightPx() + content + p.y;
  }
  drawBody() {
    if (!this.content) return;
    const t = this.theme;
    const c = t.colors;
    const p = this.pad();
    const w2 = this._width;
    const inner = this.innerWidth();
    const errors = this.errorCount;
    const chevronW = this.collapsible ? 28 : 0;
    this.badgeText.text = errors ? `${errors} to fix` : "";
    this.badgeText.style = {
      fontFamily: t.fontFamily.join(","),
      fontSize: t.helperFontSize,
      fontWeight: "600",
      fill: c.error,
      lineHeight: Math.ceil(t.helperFontSize * t.lineHeight)
    };
    const badgeW = errors ? Math.ceil(this.badgeText.width) + 16 : 0;
    const reserve = chevronW + (badgeW ? badgeW + 8 : 0);
    const textW = Math.max(60, inner - reserve - this.infoIconSpace());
    this.titleText.style = {
      fontFamily: t.fontFamily.join(","),
      fontSize: t.fontSize + 1,
      fontWeight: "650",
      fill: this._enabled ? c.text : c.textDisabled,
      lineHeight: Math.ceil((t.fontSize + 1) * t.lineHeight),
      wordWrap: true,
      wordWrapWidth: textW
    };
    this.titleText.text = this._title;
    this.descText.style = {
      fontFamily: t.fontFamily.join(","),
      fontSize: t.helperFontSize,
      fill: c.textMuted,
      lineHeight: Math.ceil(t.helperFontSize * t.lineHeight),
      wordWrap: true,
      wordWrapWidth: textW + this.infoIconSpace()
    };
    this.descText.text = this._description;
    this.descText.visible = !!this._description;
    const hh = this.headerHeightPx();
    this.header.position.set(p.x, p.y);
    this.titleText.position.set(0, 0);
    const titleLine = Math.ceil((t.fontSize + 1) * t.lineHeight);
    this.descText.position.set(0, Math.ceil(this.titleText.height) + 2);
    this.placeInfo(this.header, Math.ceil(Math.min(this.titleText.width, textW)) + 8, titleLine / 2);
    this.badge.clear();
    this.badge.visible = !!errors;
    if (errors) {
      const bh = Math.ceil(t.helperFontSize * t.lineHeight) + 4;
      const bx = inner - chevronW - badgeW;
      const by = Math.round((titleLine - bh) / 2);
      this.badge.position.set(bx, by);
      this.badge.roundRect(0, 0, badgeW, bh, bh / 2).fill({ color: c.error, alpha: 0.12 });
      this.badgeText.position.set(8, 2);
    }
    this.chevron.clear();
    if (this.collapsible) {
      const color = this._hovered ? c.text : c.textMuted;
      Icons.chevron(this.chevron, inner - 12, titleLine / 2, 22, color, this._expanded);
    }
    this.header.hitArea = this.collapsible ? new Rectangle(-p.x, -p.y, w2, hh + p.y * 2) : null;
    this.content.position.set(p.x, p.y + hh + this.sectionGap());
    const h = this.bodyHeight();
    const r = t.radius + 4;
    const border = errors ? c.error : c.border;
    this.bg.clear();
    if (this.variant === "card") {
      this.bg.roundRect(0, 3, w2, h, r).fill({ color: c.shadow, alpha: 0.05 }).roundRect(0, 0, w2, h, r).fill(c.surface).stroke({ width: 1, color: border, alpha: errors ? 0.9 : 0.6, alignment: 1 });
    } else if (this.variant === "outline") {
      if (this.collapsible && this._hovered && !this._expanded) this.bg.roundRect(0, 0, w2, h, r).fill(c.surfaceHover);
      this.bg.roundRect(0, 0, w2, h, r).stroke({ width: 1, color: border, alpha: errors ? 0.9 : 0.75, alignment: 1 });
    } else {
      this.bg.rect(0, hh + 6, w2, 1).fill({ color: border, alpha: errors ? 0.9 : 0.6 });
    }
    if (this.variant === "plain") this.drawFocus(0, 0, w2, hh, 6);
    else this.drawFocus(0, 0, w2, this._expanded ? p.y + hh + Math.round(p.y / 2) : h, r);
  }
  // ---------------------------------------------------------------- internals
  watch(item) {
    const controls = [];
    if (item instanceof FieldGroup) controls.push(...item.controls());
    else if (item instanceof Control) controls.push(item);
    else {
      const walk = (n) => n.children.forEach((ch) => ch instanceof Control ? controls.push(ch) : walk(ch));
      walk(item);
    }
    for (const ctl of controls) {
      if (this.watched.has(ctl)) continue;
      this.watched.add(ctl);
      ctl.on("validate", this.onChildValidate, this);
    }
  }
  onChildValidate(error) {
    if (error && !this._expanded) this.setExpanded(true);
    this.redraw();
    this.ui.focus.sync(this);
  }
  containsView(view) {
    for (let n = view; n; n = n.parent) if (n === this.content) return true;
    return false;
  }
  onFocusChange(cur) {
    const inside = !!cur && (cur === this || this.containsView(cur.view));
    if (inside && !this.focusInside && cur !== this) this.ui.announcer.announce(`${this._title} group`);
    this.focusInside = inside;
  }
  destroy(options) {
    this.ui.off("focuschange", this.onFocusChange, this);
    for (const c of this.watched) c.off("validate", this.onChildValidate, this);
    this.watched.clear();
    super.destroy(options);
  }
}
const uuid = () => typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
class FormAnalytics {
  constructor(ui, form, opts = {}) {
    this.ui = ui;
    this.opts = opts;
    this.formId = String(opts.formId ?? "form").slice(0, 64);
    this.enabled = Math.random() < Math.min(1, Math.max(0, opts.sampleRate ?? 1));
    if (!this.enabled) return;
    for (const c of form.fields) this.watchField(c);
    for (const c of form.fields) for (let n = c.parent; n; n = n.parent) if (n instanceof FieldGroup) this.watchGroup(n);
    this.watchGroups(ui.content);
    this.listen(form, "submitstart", () => {
      this.attempts++;
      this.emit({ type: "submit_attempt", attempt: this.attempts, durationMs: this.sinceStart() });
    });
    this.listen(form, "invalid", (errors) => {
      const names = this.visibleNames(Object.keys(errors));
      this.emit({ type: "submit_invalid", attempt: this.attempts, errorCount: Object.keys(errors).length, errorFields: names });
    });
    this.listen(form, "success", () => {
      this.succeeded = true;
      this.emit({ type: "submit_success", attempt: this.attempts, durationMs: this.sinceStart() });
    });
    this.listen(form, "failure", (r) => {
      const names = this.visibleNames(Object.keys(r.fieldErrors ?? {}));
      this.emit({ type: "submit_failure", attempt: this.attempts, errorCount: names.length, errorFields: names });
    });
    this.listen(form, "blocked", (_reason, code) => this.emit({ type: "submit_blocked", reason: code ?? "blocked" }));
    this.listen(form, "idle", () => this.emit({ type: "form_idle" }));
    this.offs.push(ui.onInteraction(() => this.markStarted()));
    if (opts.trackAbandon !== false) {
      window.addEventListener("pagehide", this.onHide);
      document.addEventListener("visibilitychange", this.onHide);
    }
    this.observeView();
  }
  ui;
  opts;
  formSessionId = uuid();
  formId;
  t0 = performance.now();
  enabled;
  fields = /* @__PURE__ */ new Map();
  offs = [];
  startedAt = 0;
  succeeded = false;
  abandonSent = false;
  attempts = 0;
  lastField;
  viewed = false;
  observer = null;
  destroyed = false;
  /** Sends a custom event through the same pipeline (consent, sampling, allow-list). */
  track(type, data = {}) {
    this.emit({ ...data, type });
  }
  destroy() {
    if (this.destroyed) return;
    if (this.enabled) this.sendAbandon();
    this.destroyed = true;
    this.offs.forEach((off) => off());
    this.observer?.disconnect();
    window.removeEventListener("pagehide", this.onHide);
    document.removeEventListener("visibilitychange", this.onHide);
  }
  // ---------------------------------------------------------------- internals
  emit(partial) {
    if (!this.enabled || this.destroyed || !this.opts.onEvent) return;
    if (this.opts.events && !this.opts.events.includes(partial.type)) return;
    try {
      if (this.opts.consent && !this.opts.consent()) return;
    } catch {
      return;
    }
    const e = { ...partial, formId: this.formId, formSessionId: this.formSessionId, t: Math.round(performance.now() - this.t0) };
    for (const k of Object.keys(e)) if (e[k] === void 0) delete e[k];
    try {
      this.opts.onEvent(Object.freeze(e));
    } catch (err) {
      console.warn("[pixiform] analytics handler failed", err);
    }
  }
  watchField(c) {
    if (this.fields.has(c) || c.ariaRole() === "button") return;
    const st = { focusedAt: 0, changes: 0, completed: false, lastErrorCode: null };
    this.fields.set(c, st);
    const excluded = this.opts.excludeFields?.includes(c.fieldName) ?? false;
    const meta = () => excluded ? null : { field: c.fieldName, fieldType: fieldType(c), group: groupOf(c) };
    this.listen(c, "focus", () => {
      st.focusedAt = performance.now();
      st.changes = 0;
      this.lastField = excluded ? void 0 : c.fieldName;
      const m = meta();
      if (m) this.emit({ type: "field_focus", ...m });
    });
    this.listen(c, "change", () => {
      if (this.isActive(c)) st.changes++;
    });
    this.listen(c, "blur", () => {
      if (!st.changes) return;
      st.completed = true;
      const m = meta();
      if (m) this.emit({ type: "field_complete", ...m, durationMs: Math.round(performance.now() - st.focusedAt), changes: st.changes });
      st.changes = 0;
    });
    this.listen(c, "validate", (error) => {
      const code = error ? c.errorCode ?? "invalid" : null;
      if (code === st.lastErrorCode) return;
      st.lastErrorCode = code;
      const m = meta();
      if (code && m) this.emit({ type: "field_error", ...m, errorCode: code });
    });
  }
  groups = /* @__PURE__ */ new Set();
  watchGroup(g) {
    if (this.groups.has(g)) return;
    this.groups.add(g);
    this.listen(g, "toggle", (expanded) => this.emit({ type: "group_toggle", group: g.fieldName, expanded }));
  }
  watchGroups(node) {
    for (const child of node.children) {
      if (child instanceof FieldGroup) this.watchGroup(child);
      this.watchGroups(child instanceof FieldGroup ? child.content : child);
    }
  }
  listen(target, event, fn) {
    target.on(event, fn);
    this.offs.push(() => target.off(event, fn));
  }
  /** True while keyboard focus is on the control or one of its parts (composites like PhoneInput). */
  isActive(c) {
    const cur = this.ui.focus.current;
    if (!cur) return false;
    for (let n = cur.view; n; n = n.parent) if (n === c) return true;
    return false;
  }
  markStarted() {
    if (this.startedAt) return;
    this.startedAt = performance.now();
    this.emit({ type: "form_start" });
  }
  sinceStart() {
    return this.startedAt ? Math.round(performance.now() - this.startedAt) : void 0;
  }
  visibleNames(names) {
    const ex = this.opts.excludeFields ?? [];
    return names.filter((n) => !ex.includes(n)).slice(0, 25);
  }
  observeView() {
    const canvas = this.ui.app.canvas;
    if (typeof IntersectionObserver === "undefined") {
      this.sendView();
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.sendView();
          this.observer?.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    this.observer.observe(canvas);
  }
  sendView() {
    if (this.viewed) return;
    this.viewed = true;
    this.emit({ type: "form_view", totalFields: this.fields.size });
  }
  onHide = () => {
    if (document.visibilityState === "hidden") this.sendAbandon();
  };
  sendAbandon() {
    if (this.opts.trackAbandon === false || !this.startedAt || this.succeeded || this.abandonSent) return;
    this.abandonSent = true;
    const completed = [...this.fields.values()].filter((s) => s.completed).length;
    this.emit({
      type: "form_abandon",
      lastField: this.lastField,
      completedFields: completed,
      totalFields: this.fields.size,
      durationMs: this.sinceStart()
    });
  }
}
function fieldType(c) {
  if (c.secure) return "password";
  if (c.sensitive) return "otp";
  const role = c.ariaRole();
  if (role === "textbox") return c.inputMode === "text" || c.inputMode === "none" ? "text" : c.inputMode;
  return role;
}
function groupOf(c) {
  for (let n = c.parent; n; n = n.parent) if (n instanceof FieldGroup) return n.fieldName;
  return void 0;
}
const PIXIFORM_EVENTS = [
  "loadstart",
  "load",
  "resize",
  "themechange",
  "a11ychange",
  "error",
  "destroy",
  "change",
  "dirty",
  "focus",
  "blur",
  "validate",
  "grouptoggle",
  "beforesubmit",
  "submitting",
  "success",
  "failure",
  "invalid",
  "blocked",
  "reset",
  "idle"
];
class FormEvents {
  map = /* @__PURE__ */ new Map();
  on(type, fn) {
    let set = this.map.get(type);
    if (!set) this.map.set(type, set = /* @__PURE__ */ new Set());
    set.add(fn);
    return () => this.off(type, fn);
  }
  once(type, fn) {
    const off = this.on(type, (d) => {
      off();
      fn(d);
    });
    return off;
  }
  off(type, fn) {
    this.map.get(type)?.delete(fn);
  }
  /** Adds every listener in an `{ load() {…}, change() {…} }` object. */
  addAll(listeners) {
    if (!listeners) return;
    for (const [type, fn] of Object.entries(listeners)) {
      if (typeof fn === "function" && PIXIFORM_EVENTS.includes(type)) this.on(type, fn);
    }
  }
  emit(type, detail) {
    for (const fn of [...this.map.get(type) ?? []]) {
      try {
        fn(detail);
      } catch (err) {
        if (type === "error") console.error("[pixiform] error listener failed", err);
        else this.emit("error", { error: err instanceof Error ? err : new Error(String(err)), phase: "listener" });
      }
    }
  }
  clear() {
    this.map.clear();
  }
}
function resolveTheme(input, mode) {
  if (!input) return mode === "dark" ? darkTheme : lightTheme;
  if (typeof input === "string") {
    if (!(input in accentPalettes)) throw new Error(`Unknown accent preset "${input}"`);
    return presetTheme(input, mode);
  }
  if ("colors" in input && "fontSize" in input) return input;
  const palette = input;
  return createFormTheme({ ...palette, mode: palette.mode ?? mode });
}
async function mountPixiForm(host, config) {
  if (!(host instanceof HTMLElement)) throw new Error("mountPixiForm: host must be an HTMLElement");
  const events = new FormEvents();
  events.addAll(config.on);
  const setState = (s) => {
    host.dataset.pixiformState = s;
    if (s === "loading" || s === "waiting") host.setAttribute("aria-busy", "true");
    else host.removeAttribute("aria-busy");
  };
  const strategy = config.load ?? "eager";
  try {
    if (!Array.isArray(config.fields) || config.fields.length === 0) throw new Error("mountPixiForm: fields are required");
    if (!config.onSubmit && !config.action) throw new Error("mountPixiForm: provide onSubmit or action");
    if (strategy !== "eager") {
      setState("waiting");
      await waitToLoad(strategy, host, config.loadMargin ?? "200px");
    }
    setState("loading");
    events.emit("loadstart", { reason: strategy });
    return await mountInner(host, config, events, setState, performance.now());
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    setState("error");
    events.emit("error", { error, phase: "load" });
    throw error;
  }
}
function waitToLoad(strategy, host, margin) {
  return new Promise((resolve) => {
    if (strategy === "idle") {
      const ric = window.requestIdleCallback;
      if (ric) ric(() => resolve(), { timeout: 2e3 });
      else setTimeout(resolve, 200);
      return;
    }
    if (typeof IntersectionObserver === "undefined") return resolve();
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          resolve();
        }
      },
      { rootMargin: margin }
    );
    io.observe(host);
  });
}
async function mountInner(host, config, events, setState, t0) {
  let state = "loading";
  const layoutMode = config.layout ?? "auto";
  const autoHeight = layoutMode === "auto";
  let destroyed = false;
  const mq2 = matchMedia("(prefers-color-scheme: dark)");
  let modeSetting = config.mode ?? "auto";
  let themeInput = config.theme;
  const currentMode = () => modeSetting === "auto" ? mq2.matches ? "dark" : "light" : modeSetting;
  let theme = resolveTheme(themeInput, currentMode());
  const transparent = config.transparent ?? autoHeight;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  const app = new Application();
  await app.init({
    width: Math.max(280, host.clientWidth || 360),
    height: autoHeight ? 200 : Math.max(200, host.clientHeight || 600),
    ...autoHeight ? {} : { resizeTo: host },
    // Premultiplied alpha: a transparent clear colour must be black, or it tints the page.
    background: transparent ? 0 : theme.colors.background,
    backgroundAlpha: transparent ? 0 : 1,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2)
  });
  app.renderer.background.alpha = transparent ? 0 : 1;
  const canvas = app.canvas;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  if (!autoHeight) canvas.style.height = "100%";
  canvas.style.touchAction = autoHeight ? "pan-y" : "none";
  canvas.style.userSelect = "none";
  canvas.style.setProperty("-webkit-tap-highlight-color", "transparent");
  canvas.style.setProperty("-webkit-touch-callout", "none");
  host.appendChild(canvas);
  const ui = new FormUI(app, {
    theme,
    host,
    fitVisualViewport: !autoHeight,
    a11y: { label: config.title, ...config.a11y ?? {} }
  });
  app.stage.addChild(ui);
  const controls = {};
  const groups = {};
  let groupSeq = 0;
  const build = (fields, depth) => {
    if (depth > 4) throw new Error("mountPixiForm: groups can be nested at most 4 levels deep");
    const entries = [];
    const rows = /* @__PURE__ */ new Map();
    const place = (row, item) => {
      if (!row) return void entries.push(item);
      let group = rows.get(row);
      if (!group) {
        group = [];
        rows.set(row, group);
        entries.push({ row });
      }
      group.push(item);
    };
    for (const f of fields) {
      const { type, row, ...opts } = f;
      let c = null;
      switch (type) {
        case "group": {
          const { fields: inner, ...gopts } = opts;
          if (!Array.isArray(inner) || inner.length === 0) throw new Error("mountPixiForm: a group needs fields");
          const g = new FieldGroup(ui, { ...gopts, name: gopts.name ?? `group${++groupSeq}` });
          if (groups[g.fieldName] || controls[g.fieldName]) throw new Error(`mountPixiForm: duplicate name "${g.fieldName}"`);
          groups[g.fieldName] = g;
          g.add(...build(inner, depth + 1));
          place(row, g);
          continue;
        }
        case "heading":
        case "paragraph":
          place(row, new Label(ui, String(f.text), type === "heading" ? "title" : "body"));
          continue;
        case "text":
          c = new TextInput(ui, opts);
          break;
        case "email":
          c = new TextInput(ui, { inputMode: "email", formatters: [Formatters.lowerCase()], maxLength: 254, ...opts });
          break;
        case "tel":
          c = new TextInput(ui, { inputMode: "tel", allow: /[0-9+\-() ]/, maxLength: 20, ...opts });
          break;
        case "url":
          c = new TextInput(ui, { inputMode: "url", maxLength: 2048, ...opts });
          break;
        case "number":
          c = new TextInput(ui, { inputMode: "decimal", allow: /[0-9.\-]/, maxLength: 32, ...opts });
          break;
        case "textarea":
          c = new TextArea(ui, opts);
          break;
        case "password": {
          const { strengthMeter, ...rest } = opts;
          const pw = new PasswordInput(ui, rest);
          c = pw;
          if (strengthMeter) {
            if (controls[pw.fieldName]) throw new Error(`mountPixiForm: duplicate field name "${pw.fieldName}"`);
            const meter = new StrengthMeter(ui);
            pw.on("change", (sec) => meter.update(sec));
            place(row, pw);
            place(void 0, meter);
            controls[pw.fieldName] = pw;
            continue;
          }
          break;
        }
        case "otp":
          c = new OtpInput(ui, opts);
          break;
        case "checkbox":
          c = new Checkbox(ui, opts);
          break;
        case "switch":
          c = new Switch(ui, opts);
          break;
        case "radio":
          c = new RadioGroup(ui, opts);
          break;
        case "select":
          c = new Select(ui, opts);
          break;
        case "slider":
          c = new Slider(ui, opts);
          break;
        case "date":
          c = new DatePicker(ui, opts);
          break;
        case "phone":
          c = new PhoneInput(ui, opts);
          break;
        default:
          throw new Error(`mountPixiForm: unknown field type "${String(type)}"`);
      }
      if (controls[c.fieldName] || groups[c.fieldName]) throw new Error(`mountPixiForm: duplicate field name "${c.fieldName}"`);
      controls[c.fieldName] = c;
      place(row, c);
    }
    return entries.map((e) => "row" in e && !(e instanceof Container) ? new Row(rows.get(e.row), 16, 520) : e);
  };
  const items = [];
  if (config.title) items.push(new Label(ui, config.title, "title"));
  if (config.subtitle) items.push(new Label(ui, config.subtitle, "subtitle"));
  items.push(...build(config.fields, 0));
  const submitBtn = new Button(ui, { name: "pixiformSubmit", text: config.submitText ?? "Submit" });
  const resetBtn = config.resetText ? new Button(ui, { name: "pixiformReset", text: config.resetText, variant: "outline" }) : null;
  items.push(resetBtn ? new Row([resetBtn, submitBtn], 12, 0) : submitBtn);
  const form = new Form(ui, { ...config.form ?? {}, onSubmit: config.onSubmit ?? actionSubmitter(config) });
  form.add(...Object.values(controls)).bindSubmit(submitBtn);
  const toast = new Toast(ui);
  const showToasts = config.toasts ?? true;
  if (showToasts) {
    form.on("success", (r) => r.message && toast.show(r.message, "success"));
    form.on("failure", (r) => toast.show(r.message ?? "Something went wrong.", "error"));
    form.on("blocked", (reason) => toast.show(reason, "error"));
  }
  if (resetBtn) resetBtn.onPress = () => form.reset();
  const analytics = config.analytics ? new FormAnalytics(ui, form, { formId: config.id, ...config.analytics }) : null;
  const column = new Column(items, 20);
  const surface = new Surface(ui, column, config.card ?? true, config.maxWidth ?? 640);
  let scroll = null;
  if (autoHeight) ui.content.addChild(surface);
  else {
    scroll = new ScrollView(ui, surface);
    ui.content.addChild(scroll);
  }
  const privacy = config.privacyScreen === false ? null : new PrivacyScreen(ui);
  let frame = 0;
  const relayout = () => {
    frame = 0;
    if (destroyed) return;
    const width = Math.max(280, host.clientWidth);
    if (autoHeight) {
      surface.layout(width);
      const height = Math.ceil(surface.layoutHeight);
      if (app.screen.width !== width || app.screen.height !== height) app.renderer.resize(width, height);
    } else {
      scroll.setViewport(app.screen.width, app.screen.height);
    }
    const cur = ui.focus.current;
    if (cur) ui.repositionProxy(cur);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(relayout);
  };
  const ro = new ResizeObserver(schedule);
  ro.observe(host);
  surface.on("resize", schedule);
  app.renderer.on("resize", () => !autoHeight && schedule());
  let dirty = false;
  const inside = (c) => {
    for (let n = ui.focus.current?.view ?? null; n; n = n.parent) if (n === c) return true;
    return false;
  };
  form.on("beforesubmit", (d) => events.emit("beforesubmit", d));
  form.on("submitting", () => events.emit("submitting", {}));
  form.on("success", (result) => events.emit("success", { result }));
  form.on("failure", (result) => events.emit("failure", { result }));
  form.on("invalid", (errors) => events.emit("invalid", { errors }));
  form.on("blocked", (reason, code) => events.emit("blocked", { reason, code }));
  form.on("idle", () => events.emit("idle", {}));
  form.on("error", (error) => events.emit("error", { error, phase: "submit" }));
  form.on("reset", () => {
    dirty = false;
    events.emit("reset", {});
  });
  for (const c of Object.values(controls)) {
    const name = c.fieldName;
    c.on("change", (value) => {
      events.emit("change", { name, value });
      if (!dirty && inside(c)) {
        dirty = true;
        events.emit("dirty", { name });
      }
    });
    c.on("focus", () => events.emit("focus", { name }));
    c.on("blur", () => events.emit("blur", { name }));
    c.on("validate", (error) => events.emit("validate", { name, error, code: c.errorCode }));
  }
  for (const g of Object.values(groups)) g.on("toggle", (expanded) => events.emit("grouptoggle", { group: g.fieldName, expanded }));
  ui.on("themechange", (t) => events.emit("themechange", { theme: t, mode: currentMode() }));
  ui.on("a11ychange", () => events.emit("a11ychange", { prefs: ui.activePrefs }));
  app.renderer.on("resize", (width, height) => events.emit("resize", { width, height }));
  let resolveLoaded;
  const loaded = new Promise((r) => resolveLoaded = r);
  const onFirstPaint = () => {
    app.renderer.off("postrender", onFirstPaint);
    if (destroyed) return;
    state = "ready";
    setState("ready");
    const detail = { ms: Math.round(performance.now() - t0), fields: Object.keys(controls).length, width: app.screen.width, height: app.screen.height };
    resolveLoaded(detail);
    events.emit("load", detail);
  };
  app.renderer.on("postrender", onFirstPaint);
  relayout();
  const sentinel = document.createElement("div");
  Object.assign(sentinel.style, { position: "absolute", left: "0", width: "1px", pointerEvents: "none", visibility: "hidden" });
  host.appendChild(sentinel);
  const reveal = (c) => {
    const b = c.view.getBounds();
    sentinel.style.top = `${Math.max(0, b.y - 24)}px`;
    sentinel.style.height = `${b.height + 48}px`;
    sentinel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const onFocusChange = (c, viaKeyboard) => {
    if (autoHeight && c && (viaKeyboard || ui.isTouch)) reveal(c);
  };
  ui.on("focuschange", onFocusChange);
  const onViewport = () => {
    const cur = ui.focus.current;
    if (autoHeight && cur) reveal(cur);
  };
  window.visualViewport?.addEventListener("resize", onViewport);
  const onScroll = () => {
    const cur = ui.focus.current;
    if (cur) ui.repositionProxy(cur);
  };
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  const applyTheme = () => {
    theme = resolveTheme(themeInput, currentMode());
    ui.setTheme(theme);
    app.renderer.background.color = transparent ? 0 : theme.colors.background;
    app.renderer.background.alpha = transparent ? 0 : 1;
  };
  const onScheme = () => modeSetting === "auto" && !(themeInput && typeof themeInput === "object" && "fontSize" in themeInput) && applyTheme();
  mq2.addEventListener("change", onScheme);
  const handle = {
    app,
    ui,
    form,
    controls,
    analytics,
    groups,
    get: (name) => controls[name],
    values: () => form.values(),
    submit: () => form.submit(),
    reset: () => form.reset(),
    setTheme(input, mode) {
      themeInput = input;
      if (mode) modeSetting = mode;
      applyTheme();
    },
    toast: (message, kind = "info") => toast.show(message, kind),
    on: (type, fn) => events.on(type, fn),
    once: (type, fn) => events.once(type, fn),
    events,
    get state() {
      return state;
    },
    loaded,
    isDirty: () => dirty,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      mq2.removeEventListener("change", onScheme);
      window.visualViewport?.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onScroll, { capture: true });
      ui.off("focuschange", onFocusChange);
      analytics?.destroy();
      privacy?.destroy();
      form.destroy();
      ui.destroy({ children: true });
      sentinel.remove();
      app.destroy(true, { children: true });
      state = "destroyed";
      setState("destroyed");
      events.emit("destroy", {});
      events.clear();
    }
  };
  return handle;
}
class Surface extends Container {
  constructor(ui, child, card, maxWidth) {
    super();
    this.ui = ui;
    this.child = child;
    this.card = card;
    this.maxWidth = maxWidth;
    this.addChild(this.bg, child);
    child.on("resize", () => {
      if (this.laying || !this.width_) return;
      this.paint();
      this.emit("resize", this);
    });
    ui.on("themechange", () => this.width_ && this.layout(this.width_));
  }
  ui;
  child;
  card;
  maxWidth;
  bg = new Graphics();
  height_ = 0;
  width_ = 0;
  laying = false;
  get layoutHeight() {
    return this.height_;
  }
  layout(width) {
    this.width_ = width;
    this.laying = true;
    const outer = width < 480 ? 8 : 16;
    const w2 = Math.min(this.maxWidth, width - outer * 2);
    const pad2 = this.card ? w2 < 440 ? 18 : 28 : 0;
    this.child.layout(w2 - pad2 * 2);
    this.child.position.set(Math.round((width - w2) / 2) + pad2, outer + pad2);
    this.laying = false;
    this.paint();
  }
  paint() {
    const outer = this.width_ < 480 ? 8 : 16;
    const w2 = Math.min(this.maxWidth, this.width_ - outer * 2);
    const pad2 = this.card ? w2 < 440 ? 18 : 28 : 0;
    const h = this.child.layoutHeight + pad2 * 2;
    this.height_ = h + outer * 2 + 8;
    const x = Math.round((this.width_ - w2) / 2);
    const c = this.ui.theme.colors;
    this.bg.clear();
    if (this.card) {
      this.bg.roundRect(x, outer + 4, w2, h, 16).fill({ color: c.shadow, alpha: 0.06 }).roundRect(x, outer, w2, h, 16).fill(c.surface).stroke({ width: 1, color: c.border, alpha: 0.6, alignment: 1 });
    }
  }
}
function actionSubmitter(config) {
  const action = config.action;
  let session = null;
  const loadSession = async () => {
    const res = await fetch(config.session, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`session request failed (${res.status})`);
    session = await res.json();
  };
  return async (_values, form) => {
    try {
      if (config.session && !session) await loadSession();
      const send = async () => {
        const key22 = session?.encryption ?? config.encryptionKey;
        const body = await form.serialize({ encryptionKey: key22 });
        return secureSubmit(action, body, { ...config.submitOptions ?? {}, csrfToken: session?.csrfToken ?? config.csrfToken });
      };
      let res = await send();
      if (res.status === 403 && config.session) {
        await loadSession();
        res = await send();
      }
      const reply = await res.json().catch(() => ({}));
      const key2 = session?.encryption ?? config.encryptionKey;
      if (reply.challenge && key2) {
        const next = { ...key2, challenge: reply.challenge };
        if (session?.encryption) session.encryption = next;
        else config.encryptionKey = next;
      }
      return {
        ok: res.ok && reply.ok !== false,
        message: reply.message ?? (res.ok ? void 0 : `The request failed (${res.status}).`),
        fieldErrors: reply.fieldErrors
      };
    } catch (err) {
      console.error("[pixiform] submit failed:", err.message);
      return { ok: false, message: "Could not send the form. Please try again." };
    }
  };
}
class PixiFormElement extends HTMLElement {
  #config = null;
  #handle = null;
  #generation = 0;
  get config() {
    return this.#config;
  }
  /** Setting a new config re-mounts the form. */
  set config(value) {
    this.#config = value;
    if (this.isConnected) void this.#mount();
  }
  /** The live handle (null until `pixiform-ready`). */
  get handle() {
    return this.#handle;
  }
  connectedCallback() {
    if (!this.style.display) this.style.display = "block";
    if (this.#config && !this.#handle) void this.#mount();
  }
  disconnectedCallback() {
    this.#generation++;
    this.#handle?.destroy();
    this.#handle = null;
  }
  async #mount() {
    const gen = ++this.#generation;
    this.#handle?.destroy();
    this.#handle = null;
    const fire = (type, detail, cancelable = false) => this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable }));
    if (!this.#config) return;
    const before = { config: { ...this.#config } };
    if (!fire("pixiform-beforeload", before, true)) return;
    const cfg = before.config;
    const dispatchSubmit = (values) => new Promise((resolve) => {
      let answered = false;
      const detail = {
        values,
        respondWith: (r) => {
          answered = true;
          Promise.resolve(r).then(resolve, () => resolve({ ok: false, message: "Submission failed." }));
        }
      };
      fire("pixiform-submit", detail);
      if (!answered) resolve({ ok: true });
    });
    const onSubmit = cfg.onSubmit ?? (cfg.action ? void 0 : dispatchSubmit);
    const analytics = cfg.analytics ? {
      ...cfg.analytics,
      onEvent: (e) => {
        cfg.analytics?.onEvent?.(e);
        fire("pixiform-analytics", e);
      }
    } : void 0;
    const on = {};
    for (const type of PIXIFORM_EVENTS) {
      const own = cfg.on?.[type];
      on[type] = (detail) => {
        if (gen !== this.#generation && type !== "destroy") return;
        try {
          own?.(detail);
        } finally {
          if (type === "beforesubmit") {
            const d = detail;
            if (!fire("pixiform-beforesubmit", d, true)) d.preventDefault();
          } else fire(`pixiform-${type}`, detail);
        }
      };
    }
    let handle;
    try {
      handle = await mountPixiForm(this, { ...cfg, onSubmit, analytics, on });
    } catch (err) {
      console.error("[pixiform] could not mount the form:", err.message);
      return;
    }
    if (gen !== this.#generation) {
      handle.destroy();
      return;
    }
    this.#handle = handle;
    fire("pixiform-ready", { handle });
  }
}
function definePixiFormElement(tag = "pixi-form") {
  if (!customElements.get(tag)) customElements.define(tag, class extends PixiFormElement {
  });
}
function flattenEvent(e, omit = []) {
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (v === void 0 || omit.includes(k)) continue;
    out[k] = Array.isArray(v) ? v.join(",").slice(0, 100) : typeof v === "string" ? v.slice(0, 100) : v;
  }
  return out;
}
const w = () => window;
const analyticsAdapters = {
  /** Google Analytics 4 via gtag.js: gtag('event', 'pixiform_field_error', { form_id, field, error_code, … }). */
  ga4(opts = {}) {
    const prefix = opts.prefix ?? "pixiform_";
    return (e) => {
      const gtag = opts.gtag ?? w().gtag;
      if (typeof gtag !== "function") return;
      const params = {};
      for (const [k, v] of Object.entries(flattenEvent(e, ["type"]))) params[snake(k)] = v;
      if (e.type === "form_abandon" || e.type === "submit_success") params.transport_type = "beacon";
      gtag("event", `${prefix}${e.type}`, params);
    };
  },
  /** Google Tag Manager: dataLayer.push({ event: 'pixiform_submit_success', pixiform: { … } }). */
  dataLayer(opts = {}) {
    const name = opts.name ?? "dataLayer";
    const prefix = opts.prefix ?? "pixiform_";
    return (e) => {
      const layer = w()[name] ??= [];
      layer.push({ event: `${prefix}${e.type}`, pixiform: { ...e } });
    };
  },
  /** Segment / RudderStack / any analytics.js-compatible client: analytics.track('PixiForm Field Error', props). */
  segment(client) {
    return (e) => {
      const c = client ?? w().analytics;
      c?.track?.(title(e.type), { ...e });
    };
  },
  /** PostHog: posthog.capture('pixiform_field_error', props). */
  posthog(client, prefix = "pixiform_") {
    return (e) => {
      const c = client ?? w().posthog;
      c?.capture?.(`${prefix}${e.type}`, { ...e });
    };
  },
  /** Plausible custom events: plausible('pixiform_submit_success', { props }). */
  plausible(fn, prefix = "pixiform_") {
    return (e) => {
      const p = fn ?? w().plausible;
      if (typeof p === "function") p(`${prefix}${e.type}`, { props: flattenEvent(e, ["type"]) });
    };
  },
  /**
   * Your own endpoint. Batches events and sends them with navigator.sendBeacon
   * (survives page unload). Remember to allow the URL in your CSP `connect-src`.
   */
  beacon(url, opts = {}) {
    const queue = [];
    let timer = 0;
    const flush = () => {
      window.clearTimeout(timer);
      timer = 0;
      if (!queue.length) return;
      const body = JSON.stringify({ events: queue.splice(0) });
      const blob = new Blob([body], { type: "application/json" });
      if (!navigator.sendBeacon?.(url, blob)) void fetch(url, { method: "POST", body, keepalive: true, credentials: "same-origin", headers: { "Content-Type": "application/json" } }).catch(() => {
      });
    };
    addEventListener("pagehide", flush);
    return (e) => {
      queue.push(e);
      if (queue.length >= (opts.maxBatch ?? 20) || e.type === "form_abandon" || e.type === "submit_success") flush();
      else if (!timer) timer = window.setTimeout(flush, opts.flushMs ?? 3e3);
    };
  },
  /** Sends each event to several handlers. */
  combine(...handlers) {
    return (e) => {
      for (const h of handlers) {
        try {
          h(e);
        } catch (err) {
          console.warn("[pixiform] analytics handler failed", err);
        }
      }
    };
  }
};
const snake = (k) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const title = (t) => `PixiForm ${t.split("_").map((w2) => w2[0].toUpperCase() + w2.slice(1)).join(" ")}`;
export {
  A11yTree,
  Application,
  BotGuard,
  Button,
  Checkbox,
  Circle,
  Column,
  Container,
  Control,
  DatePicker,
  EventEmitter,
  FederatedPointerEvent,
  FederatedWheelEvent,
  FieldGroup,
  Form,
  FormAnalytics,
  FormEvents,
  FormUI,
  Formatters,
  Graphics,
  Icons,
  Label,
  OtpInput,
  COUNTRIES as PHONE_COUNTRIES,
  PIXIFORM_EVENTS,
  PasswordInput,
  PhoneInput,
  PixiFormElement,
  PrivacyScreen,
  RadioGroup,
  RateLimiter,
  Rectangle,
  Row,
  ScrollView,
  Secret,
  SecureBuffer,
  Select,
  Slider,
  StrengthMeter,
  Switch,
  Text,
  TextArea,
  TextField,
  TextInput,
  Ticker,
  Toast,
  Tooltip,
  accentPalettes,
  actionSubmitter,
  adaptTheme,
  analyticsAdapters,
  b64uDecode,
  b64uEncode,
  checkContrast,
  contrastRatio,
  createFormTheme,
  createTheme,
  cssFont,
  darkTheme,
  definePixiFormElement,
  estimateStrength,
  flagEmoji,
  flattenEvent,
  formatNational,
  fromRule,
  increaseContrast,
  insets,
  lightTheme,
  luminance,
  mix,
  mountPixiForm,
  presetTheme,
  publicRules,
  readCsrfToken,
  readableOn,
  ruleValidator,
  rulesToJsonSchema,
  sanitizeInput,
  scaleTheme,
  sealBytes,
  sealSecret,
  secureSubmit,
  systemColorTheme,
  themeFromSeed
};
//# sourceMappingURL=pixiformui.js.map
