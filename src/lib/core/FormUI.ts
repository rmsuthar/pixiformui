import { Container, type Application, type FederatedPointerEvent, type Ticker } from '../render/canvas';
import { createTheme, lightTheme, type DeepPartial, type Theme } from '../theme';
import { A11yTree } from './A11yTree';
import { adaptTheme, readPrefs, watchPrefs, type A11yOptions, type ActivePrefs } from './a11yPrefs';
import { Announcer } from './Announcer';
import { FocusManager } from './FocusManager';
import { KeyboardProxy } from './KeyboardProxy';
import { TextMeasurer } from './TextMeasurer';
import { Tooltip } from './Tooltip';
import type { Focusable } from './types';

export interface FormUIOptions {
  theme?: Theme;
  themeOverrides?: DeepPartial<Theme>;
  /** DOM element hosting the canvas. Defaults to the canvas' parent. */
  host?: HTMLElement;
  /**
   * Resize the host to the visual viewport so the on-screen keyboard on
   * mobile never covers the focused field. Default true.
   */
  fitVisualViewport?: boolean;
  /** Accessibility preferences (system settings are followed by default). */
  a11y?: A11yOptions;
}

/**
 * Shared runtime for a set of controls: theme, focus, keyboard proxy,
 * overlay layer (dropdowns), and screen-reader announcements.
 */
export class FormUI extends Container {
  readonly app: Application;
  readonly focus: FocusManager;
  readonly announcer: Announcer;
  readonly measurer = new TextMeasurer();
  /** Top-most layer for popups. Always rendered above `content`. */
  readonly overlay = new Container();
  readonly content = new Container();
  /** Shared tooltip used by info icons. */
  readonly tooltip: Tooltip;
  private readonly proxy: KeyboardProxy;
  private readonly host: HTMLElement;
  private _theme: Theme;
  private baseTheme: Theme;
  private a11yOpts: A11yOptions;
  private prefs: ActivePrefs;
  private readonly unwatchPrefs: () => void;
  private dprQuery: MediaQueryList | null = null;
  private readonly startGuard: HTMLElement;
  private readonly endGuard: HTMLElement;
  /** Hidden DOM outline for screen readers (null when `a11y.outline` is false). */
  readonly outline: A11yTree | null;
  /** Popup areas (open menus, calendars) whose touch gestures must not scroll the page. */
  private readonly touchOwners = new Set<Container>();
  private readonly interactionListeners = new Set<(e: Event) => void>();

  constructor(app: Application, opts: FormUIOptions = {}) {
    super();
    this.app = app;
    this.a11yOpts = { ...(opts.a11y ?? {}) };
    this.prefs = readPrefs(this.a11yOpts);
    this.baseTheme = createTheme(opts.theme ?? lightTheme, opts.themeOverrides);
    this._theme = adaptTheme(this.baseTheme, this.prefs);
    this.host = opts.host ?? app.canvas.parentElement ?? document.body;
    this.addChild(this.content, this.overlay);
    this.overlay.label = 'pixiform-overlay';
    this.tooltip = new Tooltip(this);
    this.overlay.addChild(this.tooltip);
    this.on('focuschange', () => this.tooltip.hide());
    this.on('scroll', () => this.tooltip.hide());

    this.focus = new FocusManager(
      () => this.proxy,
      (current, viaKeyboard) => this.emit('focuschange', current, viaKeyboard),
    );
    this.proxy = new KeyboardProxy(this.host, {
      onBlur: () => this.focus.blur(),
      onKeyDown: (e) => this.handleGlobalKey(e) || this.focus.handleKeyDown(e),
      onTrustedInteraction: (e) => this.notifyInteraction(e),
    }, () => app.canvas.getBoundingClientRect());
    this.announcer = new Announcer(this.host);

    // Keep the proxy focused when the canvas is clicked.
    app.canvas.addEventListener('mousedown', this.preventFocusSteal);
    app.canvas.addEventListener('pointerdown', this.onNativePointer, { capture: true });
    app.canvas.addEventListener('contextmenu', this.preventContextMenu);
    // The browser cancels pointers when it takes over a touch for native scrolling.
    // The scene graph has no pointercancel event, so broadcast it to reset pressed/dragging states.
    app.canvas.addEventListener('pointercancel', this.onPointerCancel);
    // In 'auto' layout the canvas lets the browser pan the page vertically (touch-action: pan-y).
    // A swipe that starts on an open popup belongs to the popup (scroll a list, swipe months).
    app.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });

    // The pixels are decorative for assistive technology: the accessibility
    // outline and the keyboard proxy carry the semantics.
    app.canvas.tabIndex = -1;
    app.canvas.setAttribute('aria-hidden', 'true');
    app.canvas.addEventListener('focus', this.onCanvasFocus);

    // Tab entry points: Tab from before the form lands on the first control,
    // Shift+Tab from after it on the last one.
    this.startGuard = this.makeGuard(false);
    this.endGuard = this.makeGuard(true);
    this.host.insertBefore(this.startGuard, this.host.firstChild);
    this.host.appendChild(this.endGuard);
    // Leaving the form: disable the guards for this keystroke so focus moves on.
    this.focus.onExit = () => {
      this.startGuard.tabIndex = this.endGuard.tabIndex = -1;
      setTimeout(() => (this.startGuard.tabIndex = this.endGuard.tabIndex = 0));
    };

    this.outline = this.a11yOpts.outline === false ? null : new A11yTree(this, this.host, () => this.formLabel());
    this.unwatchPrefs = watchPrefs(this.applyPrefs);
    this.watchZoom();

    // Clicking empty space blurs the focused control.
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', this.onStagePointerDown);

    if ((opts.fitVisualViewport ?? true) && window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.onVisualViewport);
    }
  }

  /** F1 toggles the focused control's info tooltip; Escape closes an open tooltip. */
  private handleGlobalKey(e: KeyboardEvent): boolean {
    const cur = this.focus.current as (Focusable & { infoText?: string; infoAnchor?: Container }) | null;
    if (e.key === 'F1' && cur?.infoText) {
      this.tooltip.toggle(cur.infoAnchor ?? cur.view, cur.infoText, cur);
      this.announcer.announce(cur.infoText);
      return true;
    }
    if (e.key === 'Escape' && this.tooltip.isOpen) {
      this.tooltip.hide();
      return true;
    }
    return false;
  }

  /** True on phones/tablets (coarse primary pointer). */
  get isTouch(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  }

  /** The theme in use: the base theme adapted to the user's accessibility settings. */
  get theme(): Theme {
    return this._theme;
  }

  /** Accessibility settings currently in effect (forced colors, contrast, motion, text scale). */
  get activePrefs(): Readonly<ActivePrefs> {
    return this.prefs;
  }

  /** True when animations should be skipped. */
  get reducedMotion(): boolean {
    return this.prefs.reducedMotion;
  }

  setTheme(theme: Theme, overrides?: DeepPartial<Theme>): void {
    this.baseTheme = createTheme(theme, overrides);
    this._theme = adaptTheme(this.baseTheme, this.prefs);
    this.emit('themechange', this._theme);
  }

  /** Changes accessibility options at runtime (e.g. a "larger text" toggle). */
  setA11y(opts: Partial<A11yOptions>): void {
    this.a11yOpts = { ...this.a11yOpts, ...opts };
    this.applyPrefs();
    this.outline?.schedule();
  }

  private applyPrefs = (): void => {
    this.prefs = readPrefs(this.a11yOpts);
    this._theme = adaptTheme(this.baseTheme, this.prefs);
    this.emit('themechange', this._theme);
    this.emit('a11ychange', this.prefs);
  };

  private formLabel(): string {
    if (this.a11yOpts.label) return this.a11yOpts.label;
    const find = (n: Container): string | null => {
      const t = (n as { a11yText?: () => { text: string; heading: boolean } | null }).a11yText?.();
      if (t?.heading && t.text) return t.text;
      for (const c of n.children) {
        const r = find(c);
        if (r) return r;
      }
      return null;
    };
    return find(this.content) ?? 'Form';
  }

  private makeGuard(end: boolean): HTMLElement {
    const g = document.createElement('span');
    g.tabIndex = 0;
    g.className = 'pixiform-focus-guard';
    g.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    g.addEventListener('focus', () => {
      if (!this.focus.next(end)) g.blur();
    });
    return g;
  }

  /** Keeps the canvas sharp when the browser zoom (device pixel ratio) changes. */
  private watchZoom(): void {
    if (this.a11yOpts.followZoom === false || typeof matchMedia !== 'function') return;
    // Zoom also fires 'resize'; checking there too covers browsers that skip the media event.
    window.removeEventListener('resize', this.onZoom);
    window.addEventListener('resize', this.onZoom);
    this.dprQuery?.removeEventListener('change', this.onZoom);
    this.dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.dprQuery.addEventListener('change', this.onZoom);
  }

  private onZoom = (): void => {
    const r = Math.min(window.devicePixelRatio || 1, 3);
    if (r === this.app.resolution) return;
    this.app.setResolution(r);
    this.watchZoom();
    this.emit('viewportchange');
  };

  get ticker(): Ticker {
    return this.app.ticker;
  }

  /**
   * Claims touch gestures that start inside `area` while it's shown (e.g. an open dropdown),
   * so swiping scrolls the popup instead of the page. Returns a function that releases it.
   */
  ownTouch(area: Container): () => void {
    this.touchOwners.add(area);
    return () => this.touchOwners.delete(area);
  }

  private onTouchStart = (e: TouchEvent): void => {
    if (!e.isTrusted || !this.touchOwners.size || e.touches.length !== 1) return;
    const r = this.app.canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - r.left;
    const y = e.touches[0].clientY - r.top;
    for (const area of this.touchOwners) {
      let shown = !area.destroyed;
      for (let n: Container | null = area; n && shown; n = n.parent) if (!n.visible) shown = false;
      let root: Container = area;
      while (root.parent) root = root.parent;
      if (!shown || root !== this.app.stage) continue;
      const b = area.getBounds();
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        e.preventDefault(); // keeps the page still; pointer events still reach the popup
        return;
      }
    }
  };

  /** Subscribe to trusted user interactions (used by BotGuard / idle timers). */
  onInteraction(fn: (e: Event) => void): () => void {
    this.interactionListeners.add(fn);
    return () => this.interactionListeners.delete(fn);
  }

  notifyInteraction(e: Event): void {
    if (!e.isTrusted) return;
    for (const fn of this.interactionListeners) fn(e);
  }

  /**
   * The part of the canvas currently visible in the browser window, in canvas coordinates.
   * Overlays (toasts) use it so they appear on screen even when the canvas is taller than the window.
   */
  visibleRect(): { x: number; y: number; width: number; height: number } {
    const { width, height } = this.app.screen;
    if (typeof window === 'undefined') return { x: 0, y: 0, width, height };
    const r = this.app.canvas.getBoundingClientRect();
    const top = Math.max(0, -r.top);
    const bottom = Math.min(height, window.innerHeight - r.top);
    return bottom > top ? { x: 0, y: top, width, height: bottom - top } : { x: 0, y: 0, width, height };
  }

  /** Re-anchors the hidden proxy at a control (e.g. after scrolling). */
  repositionProxy(item: Focusable): void {
    if (this.focus.current !== item) return;
    const b = item.view.getBounds();
    this.proxy.position({ x: b.x, y: b.y, width: b.width, height: b.height });
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.focus.blur();
    this.app.canvas.removeEventListener('mousedown', this.preventFocusSteal);
    this.app.canvas.removeEventListener('pointerdown', this.onNativePointer, { capture: true });
    this.app.canvas.removeEventListener('contextmenu', this.preventContextMenu);
    this.app.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.app.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.touchOwners.clear();
    this.app.canvas.removeEventListener('focus', this.onCanvasFocus);
    this.app.stage.off('pointerdown', this.onStagePointerDown);
    window.visualViewport?.removeEventListener('resize', this.onVisualViewport);
    this.unwatchPrefs();
    this.dprQuery?.removeEventListener('change', this.onZoom);
    window.removeEventListener('resize', this.onZoom);
    this.outline?.destroy();
    this.startGuard.remove();
    this.endGuard.remove();
    this.focus.onExit = null;
    this.proxy.destroy();
    this.announcer.destroy();
    this.interactionListeners.clear();
    super.destroy(options);
  }

  private onVisualViewport = (): void => {
    const vv = window.visualViewport;
    if (!vv) return;
    // Shrinks with the on-screen keyboard (iOS doesn't resize the layout viewport).
    this.host.style.height = `${Math.round(vv.height)}px`;
    this.app.resize();
    this.emit('viewportchange');
  };

  private onPointerCancel = (): void => {
    this.focus.gestureMoved = true;
    this.focus.pointerCaptured = false;
    this.emit('gesturecancel');
  };

  private preventFocusSteal = (e: MouseEvent): void => e.preventDefault();
  private preventContextMenu = (e: MouseEvent): void => e.preventDefault();

  private onNativePointer = (e: PointerEvent): void => {
    this.notifyInteraction(e);
    this.focus.claimed = false;
    this.focus.gestureMoved = false;
  };

  private onCanvasFocus = (): void => {
    if (!this.focus.current) this.focus.next(false);
  };

  private onStagePointerDown = (_e: FederatedPointerEvent): void => {
    if (!this.focus.claimed) this.focus.blur();
    this.focus.claimed = false;
  };
}
