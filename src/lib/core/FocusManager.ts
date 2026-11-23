import type { Container } from '../render/canvas';
import type { KeyboardProxy } from './KeyboardProxy';
import type { Focusable } from './types';

/**
 * Owns logical focus for all PixiForm controls, Tab/Shift+Tab ordering, and
 * routing of keyboard input through the shared KeyboardProxy.
 */
export class FocusManager {
  private readonly items: Focusable[] = [];
  private focused: Focusable | null = null;
  private seq = 0;
  private readonly order = new WeakMap<Focusable, number>();
  /** Set by controls during pointerdown so the background click doesn't blur them. */
  claimed = false;
  /** True while a control owns a drag (e.g. slider), so scroll views must not pan. */
  pointerCaptured = false;
  /** Set by scroll views once a touch gesture becomes a scroll; taps are then ignored. */
  gestureMoved = false;
  /** Modal handler (e.g. an open dropdown) that sees keys before the focused control. */
  keyInterceptor: ((e: KeyboardEvent) => boolean) | null = null;
  /** Called when Tab/Shift+Tab leaves the form, just before the browser moves focus on. */
  onExit: ((reverse: boolean) => void) | null = null;

  constructor(
    private readonly proxy: () => KeyboardProxy,
    private readonly onChange: (current: Focusable | null, viaKeyboard: boolean) => void,
  ) {}

  get current(): Focusable | null {
    return this.focused;
  }

  register(item: Focusable): void {
    if (this.items.includes(item)) return;
    this.order.set(item, this.seq++);
    this.items.push(item);
  }

  isRegistered(item: Focusable): boolean {
    return this.items.includes(item);
  }

  unregister(item: Focusable): void {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    if (this.focused === item) this.blur();
  }

  focus(item: Focusable, viaKeyboard = false): void {
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

  blur(): void {
    const prev = this.focused;
    if (!prev) return;
    this.focused = null;
    this.keyInterceptor = null;
    this.proxy().detach();
    prev.setFocused(false, false);
    this.onChange(null, false);
  }

  next(reverse = false): boolean {
    const list = this.sorted().filter((i) => i.isFocusable());
    if (list.length === 0) return false;
    const idx = this.focused ? list.indexOf(this.focused) : -1;
    const nextIdx = idx < 0 ? (reverse ? list.length - 1 : 0) : idx + (reverse ? -1 : 1);
    if (nextIdx < 0 || nextIdx >= list.length) {
      // Let focus leave the canvas naturally at the ends of the order.
      this.onExit?.(reverse);
      this.blur();
      return false;
    }
    this.focus(list[nextIdx], true);
    return true;
  }

  /** Global key handling that runs before the focused control. */
  handleKeyDown(e: KeyboardEvent): boolean {
    if (this.keyInterceptor && this.keyInterceptor(e)) return true;
    if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      return this.next(e.shiftKey);
    }
    return false;
  }

  /** Refreshes the proxy's ARIA attributes after a control state change. */
  sync(item: Focusable): void {
    if (this.focused === item) this.proxy().syncAria();
  }

  private attachProxy(item: Focusable): void {
    const b = item.view.getBounds();
    this.proxy().attach(item, { x: b.x, y: b.y, width: b.width, height: b.height });
  }

  /**
   * Tab order: positive `focusOrder` (tabIndex) first, then scene-tree order
   * (depth-first, like DOM order), so the order matches what's on screen no
   * matter when each control was created.
   */
  private sorted(): Focusable[] {
    const roots = new Set<Container>();
    for (const it of this.items) {
      let n: Container = it.view;
      while (n.parent) n = n.parent;
      roots.add(n);
    }
    const pos = new Map<Container, number>();
    let i = 0;
    const walk = (n: Container) => {
      pos.set(n, i++);
      for (const c of n.children) walk(c);
    };
    for (const r of roots) walk(r);
    return [...this.items].sort((a, b) => {
      const ta = a.focusOrder > 0 ? a.focusOrder : Number.MAX_SAFE_INTEGER;
      const tb = b.focusOrder > 0 ? b.focusOrder : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return pos.get(a.view)! - pos.get(b.view)! || this.order.get(a)! - this.order.get(b)!;
    });
  }
}
