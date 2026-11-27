import { Container, Graphics, Text, type Ticker } from './render/canvas';
import { approach } from './core/anim';
import type { FormUI } from './core/FormUI';
import { Icons } from './core/icons';
import type { Secret } from './security/Secret';
import type { Theme } from './theme';

const style = (t: Theme, size: number, fill: number, weight: string = t.fontWeight, wrap = 0) => ({
  fontFamily: t.fontFamily.join(','),
  fontSize: size,
  fontWeight: weight as Theme['fontWeight'],
  fill,
  lineHeight: Math.ceil(size * t.lineHeight),
  wordWrap: wrap > 0,
  wordWrapWidth: wrap,
});

/** Static text block (headings, paragraphs). Content is rendered as plain text, never HTML. */
export class Label extends Container {
  private readonly txt: Text;
  private width_ = 0;
  constructor(
    private readonly ui: FormUI,
    private value: string,
    private readonly variant: 'title' | 'subtitle' | 'body' | 'caption' = 'body',
  ) {
    super();
    this.txt = new Text({ text: value });
    this.addChild(this.txt);
    ui.on('themechange', () => this.layout(this.width_));
  }
  get text(): string {
    return this.value;
  }
  set text(v: string) {
    this.value = v;
    this.layout(this.width_);
  }
  /** Accessibility outline: titles become headings, everything else a paragraph. */
  a11yText(): { text: string; heading: boolean } {
    return { text: this.value, heading: this.variant === 'title' };
  }
  get layoutHeight(): number {
    return Math.ceil(this.txt.height);
  }
  layout(width: number): void {
    this.width_ = width;
    const t = this.ui.theme;
    const c = t.colors;
    const s =
      this.variant === 'title'
        ? style(t, t.titleFontSize, c.text, '700', width)
        : this.variant === 'subtitle'
          ? style(t, t.fontSize, c.textMuted, t.fontWeight, width)
          : this.variant === 'caption'
            ? style(t, t.helperFontSize, c.textMuted, t.fontWeight, width)
            : style(t, t.fontSize, c.text, t.fontWeight, width);
    this.txt.style = s;
    this.txt.text = this.value;
    this.emit('resize', this);
  }
}

/** Multi-step forms: "Step 2 of 4", the step's title and description, and a progress bar. */
export class StepProgress extends Container {
  private readonly caption = new Text({ text: '' });
  private readonly heading = new Text({ text: '' });
  private readonly desc = new Text({ text: '' });
  private readonly bar = new Graphics();
  private width_ = 0;
  private height_ = 0;
  private state = { index: 0, count: 1, title: '', description: '' };
  constructor(
    private readonly ui: FormUI,
    /** "Step {n} of {total}" (translatable). */
    private readonly template = 'Step {n} of {total}',
  ) {
    super();
    this.addChild(this.caption, this.heading, this.desc, this.bar);
    ui.on('themechange', () => this.layout(this.width_));
  }
  get stepLabel(): string {
    return this.template.replace('{n}', String(this.state.index + 1)).replace('{total}', String(this.state.count));
  }
  set(index: number, count: number, title: string, description = ''): void {
    this.state = { index, count, title, description };
    this.layout(this.width_);
  }
  a11yText(): { text: string; heading: boolean } {
    return { text: this.state.title ? `${this.stepLabel}: ${this.state.title}` : this.stepLabel, heading: true };
  }
  get layoutHeight(): number {
    return this.height_;
  }
  layout(width: number): void {
    this.width_ = width;
    const t = this.ui.theme;
    const c = t.colors;
    this.caption.style = style(t, t.helperFontSize, c.textMuted, '600', width);
    this.caption.text = this.stepLabel;
    this.heading.style = style(t, Math.round(t.fontSize * 1.2), c.text, '700', width);
    this.heading.text = this.state.title;
    this.desc.style = style(t, t.fontSize, c.textMuted, t.fontWeight, width);
    this.desc.text = this.state.description;
    let y = 0;
    this.bar.clear().roundRect(0, 0, width, 6, 3).fill(c.track);
    const frac = Math.min(1, (this.state.index + 1) / Math.max(1, this.state.count));
    if (frac > 0) this.bar.roundRect(0, 0, Math.max(6, width * frac), 6, 3).fill(c.primary);
    this.bar.position.set(0, y);
    y += 6 + 12;
    this.caption.position.set(0, y);
    y += Math.ceil(this.caption.height) + 4;
    this.heading.visible = !!this.state.title;
    if (this.heading.visible) {
      this.heading.position.set(0, y);
      y += Math.ceil(this.heading.height);
    }
    this.desc.visible = !!this.state.description;
    if (this.desc.visible) {
      this.desc.position.set(0, y + 4);
      y += 4 + Math.ceil(this.desc.height);
    }
    this.height_ = y;
    this.emit('resize', this);
  }
}

export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

/** Estimates password strength from character classes and length, without creating strings. */
export function estimateStrength(secret: Secret): StrengthResult {
  const len = secret.length;
  if (len === 0) return { score: 0, label: '' };
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
  const s = Math.min(4, score) as StrengthResult['score'];
  return { score: s, label: ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][s] };
}

/** Four-segment strength bar (reads a PasswordInput's Secret). */
export class StrengthMeter extends Container {
  private readonly bars = new Graphics();
  private readonly caption: Text;
  private width_ = 0;
  private result: StrengthResult = { score: 0, label: '' };
  private shown = 0;
  private animating = false;

  constructor(private readonly ui: FormUI) {
    super();
    this.caption = new Text({ text: '' });
    this.addChild(this.bars, this.caption);
    ui.on('themechange', () => this.draw());
  }

  update(secret: Secret): void {
    this.result = estimateStrength(secret);
    if (!this.animating) {
      this.animating = true;
      this.ui.ticker.add(this.tick, this);
    }
  }

  get layoutHeight(): number {
    return 12 + Math.ceil(this.caption.height);
  }

  layout(width: number): void {
    this.width_ = width;
    this.draw();
  }

  private tick(t: Ticker): void {
    const target = this.result.label ? this.result.score + 1 : 0;
    this.shown = approach(this.shown, target, 0.25, t.deltaMS);
    this.draw();
    if (this.shown === target) {
      this.ui.ticker.remove(this.tick, this);
      this.animating = false;
    }
  }

  private draw(): void {
    const t = this.ui.theme;
    const c = t.colors;
    const colors = [c.error, c.error, c.warning, c.success, c.success];
    const color = colors[this.result.score];
    const gap = 6;
    const w = (this.width_ - gap * 3) / 4;
    this.bars.clear();
    for (let i = 0; i < 4; i++) {
      this.bars.roundRect(i * (w + gap), 0, w, 6, 3).fill(c.track);
      // shown: 0 = empty, 1 = "too weak" (first segment), n = n segments filled.
      const segs = this.result.score === 0 ? Math.min(1, this.shown) : this.shown - 1;
      const f = Math.max(0, Math.min(1, segs - i));
      if (f > 0) this.bars.roundRect(i * (w + gap), 0, w * f, 6, 3).fill(color);
    }
    const before = this.layoutHeight;
    this.caption.style = style(t, t.helperFontSize, this.result.label ? color : c.textMuted, t.fontWeight, Math.max(40, this.width_));
    this.caption.text = this.result.label ? `Password strength: ${this.result.label}` : 'Use 12+ characters with a mix of letters, numbers & symbols';
    this.caption.y = 12;
    if (this.layoutHeight !== before) this.emit('resize', this);
  }
}

/** Transient message at the bottom of the screen (like a SnackBar). */
export class Toast extends Container {
  private readonly bg = new Graphics();
  private readonly txt: Text;
  private timer = 0;
  private alphaTarget = 0;

  constructor(private readonly ui: FormUI) {
    super();
    this.txt = new Text({ text: '' });
    this.addChild(this.bg, this.txt);
    this.alpha = 0;
    this.eventMode = 'none';
    ui.overlay.addChild(this);
    ui.ticker.add(this.tick, this);
  }

  show(message: string, kind: 'info' | 'success' | 'error' = 'info', ms = 4000): void {
    const t = this.ui.theme;
    const c = t.colors;
    const screen = this.ui.app.screen;
    const maxW = Math.min(520, screen.width - 32);
    this.txt.style = style(t, t.fontSize - 1, c.inverseText, '500', maxW - 56);
    this.txt.text = message;
    const w = Math.min(maxW, this.txt.width + 56);
    const h = Math.max(48, this.txt.height + 24);
    const accent = kind === 'success' ? c.success : kind === 'error' ? c.error : c.primary;
    this.bg.clear().roundRect(0, 4, w, h, 12).fill({ color: c.shadow, alpha: 0.2 }).roundRect(0, 0, w, h, 12).fill(c.inverseSurface);
    this.bg.circle(22, h / 2, 5).fill(accent);
    this.txt.position.set(40, (h - this.txt.height) / 2);
    const vis = this.ui.visibleRect();
    this.position.set(Math.round((screen.width - w) / 2), Math.round(vis.y + vis.height - h - 24));
    this.ui.overlay.addChild(this); // bring to front
    this.alphaTarget = 1;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => (this.alphaTarget = 0), ms);
    this.ui.announcer.announce(message, kind === 'error');
  }

  private tick(t: Ticker): void {
    this.alpha = approach(this.alpha, this.alphaTarget, 0.2, t.deltaMS);
    this.visible = this.alpha > 0.01;
  }
}

/**
 * Covers the app when the window loses focus or the tab is hidden, so app
 * switchers, screen sharing and shoulder-surfers don't see form contents
 * (similar to FLAG_SECURE / secure_application in Flutter). Also hides any
 * revealed passwords via the fields' own visibility handlers.
 */
export class PrivacyScreen extends Container {
  private readonly bg = new Graphics();
  private readonly icon = new Graphics();
  private readonly txt: Text;
  private enabled_ = true;

  constructor(private readonly ui: FormUI, private readonly message = 'Content hidden for your privacy') {
    super();
    this.txt = new Text({ text: '' });
    this.addChild(this.bg, this.icon, this.txt);
    this.visible = false;
    this.eventMode = 'static';
    this.on('pointerdown', (e) => {
      e.stopPropagation();
      this.hide();
    });
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  set enabled(v: boolean) {
    this.enabled_ = v;
    if (!v) this.hide();
  }

  show(): void {
    if (!this.enabled_) return;
    const t = this.ui.theme;
    const c = t.colors;
    const { width: w, height: h } = this.ui.app.screen;
    this.bg.clear().rect(0, 0, w, h).fill(c.background);
    this.icon.clear().circle(w / 2, h / 2 - 28, 30).fill({ color: c.primary, alpha: 0.12 });
    Icons.lock(this.icon, w / 2, h / 2 - 28, 30, c.primary);
    this.txt.style = style(t, t.fontSize, c.textMuted, '500');
    this.txt.text = this.message;
    this.txt.position.set(Math.round((w - this.txt.width) / 2), h / 2 + 16);
    this.ui.overlay.addChild(this);
    this.visible = true;
    // Render synchronously so the cover is in place before the OS snapshot.
    this.ui.app.render();
  }

  hide(): void {
    this.visible = false;
  }

  private onBlur = (): void => this.show();
  private onFocus = (): void => this.hide();
  private onVisibility = (): void => (document.hidden ? this.show() : undefined);

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);
    document.removeEventListener('visibilitychange', this.onVisibility);
    super.destroy(options);
  }
}

