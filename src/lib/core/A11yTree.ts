import type { Container } from '../render/canvas';
import type { FormUI } from './FormUI';
import type { Focusable } from './types';

/** Implemented by containers that should appear as a labelled group (e.g. FieldGroup). */
export interface A11yGroupSource {
  a11yGroup(): {
    title: string;
    description?: string;
    expanded: boolean;
    content: Container;
    /** A focusable header (collapsible groups), drawn over `headerView`. */
    header: Focusable | null;
    headerView?: Container;
  };
}
/** Implemented by static text widgets (e.g. Label). */
export interface A11yTextSource {
  a11yText(): { text: string; heading: boolean } | null;
}

interface Entry {
  el: HTMLElement;
  help?: HTMLElement;
  err?: HTMLElement;
  legend?: HTMLElement;
  body?: HTMLElement;
  seen: boolean;
}

let seq = 0;

/**
 * A hidden DOM outline of the form for assistive technology: headings, groups
 * (role=group + label), and one element per control with its role, name,
 * states and linked help/error text. Screen-reader users can browse it like a
 * normal page; activating an item focuses (and activates) the real control.
 *
 * Security: the outline carries labels, states and validation messages only,
 * never field values. Each element sits over its control so touch exploration
 * (VoiceOver/TalkBack) finds it where the user sees it.
 */
export class A11yTree {
  readonly root: HTMLElement;
  private readonly descs: HTMLElement;
  private readonly entries = new Map<object, Entry>();
  private timer = 0;
  private destroyed = false;
  private painted = false;
  private readonly id = `pf${++seq}`;
  private n = 0;

  constructor(
    private readonly ui: FormUI,
    host: HTMLElement,
    private readonly label: () => string,
  ) {
    const root = document.createElement('div');
    root.setAttribute('role', 'form');
    root.className = 'pixiform-a11y';
    Object.assign(root.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '0',
      height: '0',
      overflow: 'visible',
      pointerEvents: 'none',
      opacity: '0',
      color: 'transparent',
      margin: '0',
      padding: '0',
      zIndex: '0',
    } satisfies Partial<CSSStyleDeclaration>);
    this.descs = document.createElement('div');
    this.descs.hidden = true; // still usable as aria-describedby targets
    root.appendChild(this.descs);
    this.root = root;
    host.insertBefore(root, host.firstChild);
    ui.app.renderer.on('postrender', this.onRender);
    ui.on('focuschange', this.schedule);
    this.schedule();
  }

  /** The first painted frame is mirrored at once (so it's ready by the 'load' event); later ones are batched. */
  private onRender = (): void => {
    if (this.painted) return this.schedule();
    this.painted = true;
    this.sync();
  };

  /** Coalesces frequent renders into one DOM update. */
  schedule = (): void => {
    if (this.destroyed || this.timer) return;
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      this.sync();
    }, 80);
  };

  /** Rebuilds the outline now, reusing elements so a screen reader's position is kept. */
  sync(): void {
    if (this.destroyed) return;
    const canvas = this.ui.app.canvas;
    this.root.style.left = `${canvas.offsetLeft}px`;
    this.root.style.top = `${canvas.offsetTop}px`;
    setAttr(this.root, 'aria-label', this.label());
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
  private build(node: Container): HTMLElement[] {
    const out: HTMLElement[] = [];
    for (const child of node.children) {
      if (!child.visible || child.renderable === false || child === this.ui.overlay) continue;
      const g = (child as Partial<A11yGroupSource>).a11yGroup;
      const t = (child as Partial<A11yTextSource>).a11yText;
      if (g) out.push(this.group(child, g.call(child)));
      else if (this.ui.focus.isRegistered(child as unknown as Focusable)) out.push(...this.control(child as unknown as Focusable & Container));
      else if (t) {
        const info = t.call(child);
        if (info?.text) out.push(this.text(child, info));
      } else out.push(...this.build(child));
    }
    return out;
  }

  private group(node: Container, info: ReturnType<A11yGroupSource['a11yGroup']>): HTMLElement {
    const e = this.entry(node, 'div');
    if (!e.legend) {
      e.legend = document.createElement('span');
      e.legend.id = this.nextId();
      e.body = document.createElement('div');
      e.el.setAttribute('role', 'group');
      e.el.setAttribute('aria-labelledby', e.legend.id);
    }
    e.legend.textContent = info.title;
    const desc = info.description ? this.describe(e, 'help', info.description) : null;
    setAttr(e.el, 'aria-describedby', desc);
    const parts: HTMLElement[] = [];
    if (info.header) parts.push(...this.control(info.header as Focusable & Container, true, info.content, info.headerView));
    else parts.push(e.legend);
    if (info.header) parts.push(e.legend);
    if (info.expanded) parts.push(...this.build(info.content));
    reconcile(e.el, parts);
    return e.el;
  }

  private text(node: Container, info: { text: string; heading: boolean }): HTMLElement {
    const e = this.entry(node, info.heading ? 'h2' : 'p');
    if (e.el.textContent !== info.text) e.el.textContent = info.text;
    this.place(e.el, node);
    return e.el;
  }

  /** A control. Composite controls (with focusable parts) become a group of their parts. */
  private control(c: Focusable & Container, headerOnly = false, key: object = c, view: Container = c.view): HTMLElement[] {
    const parts = headerOnly ? [] : this.build(c);
    if (parts.length) {
      const e = this.entry(c, 'div');
      e.el.setAttribute('role', 'group');
      setAttr(e.el, 'aria-label', c.ariaLabel());
      this.applyDescription(e, c);
      reconcile(e.el, parts);
      return [e.el];
    }
    const e = this.entry(key, 'div');
    const el = e.el;
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      el.tabIndex = -1;
      el.style.pointerEvents = 'none';
      el.addEventListener('focus', (ev) => ev.isTrusted && this.ui.focus.focus(c, true));
      el.addEventListener('click', (ev) => {
        if (!ev.isTrusted || !c.isFocusable()) return;
        this.ui.focus.focus(c, true);
        c.activate?.();
      });
    }
    setAttr(el, 'role', c.ariaRole());
    setAttr(el, 'aria-label', c.ariaLabel());
    for (const [k, v] of Object.entries(c.ariaState())) setAttr(el, k, v);
    setAttr(el, 'aria-disabled', c.isFocusable() ? null : 'true');
    this.applyDescription(e, c);
    this.place(el, view);
    return [el];
  }

  private applyDescription(e: Entry, c: Focusable): void {
    const d = c.ariaDescription?.() ?? {};
    const ids = [d.error ? this.describe(e, 'err', d.error) : null, d.help ? this.describe(e, 'help', d.help) : null].filter(Boolean);
    setAttr(e.el, 'aria-describedby', ids.length ? ids.join(' ') : null);
    setAttr(e.el, 'aria-errormessage', d.error ? e.err!.id : null);
  }

  private describe(e: Entry, kind: 'help' | 'err', text: string): string {
    let span = e[kind];
    if (!span) {
      span = document.createElement('span');
      span.id = this.nextId();
      this.descs.appendChild(span);
      e[kind] = span;
    }
    if (span.textContent !== text) span.textContent = text;
    return span.id;
  }

  private place(el: HTMLElement, view: Container): void {
    const b = view.getBounds();
    const s = el.style;
    const v = (n: number) => `${Math.round(n)}px`;
    if (s.position !== 'absolute') {
      s.position = 'absolute';
      s.margin = '0';
      s.overflow = 'hidden';
      s.whiteSpace = 'nowrap';
      s.fontSize = '1px';
    }
    if (s.left !== v(b.x)) s.left = v(b.x);
    if (s.top !== v(b.y)) s.top = v(b.y);
    if (s.width !== v(b.width)) s.width = v(b.width);
    if (s.height !== v(b.height)) s.height = v(b.height);
  }

  private entry(node: object, tag: string): Entry {
    let e = this.entries.get(node);
    if (!e || e.el.tagName.toLowerCase() !== tag) {
      if (e) e.el.remove();
      e = { el: document.createElement(tag), seen: true };
      this.entries.set(node, e);
    }
    e.seen = true;
    return e;
  }

  private nextId(): string {
    return `${this.id}-${++this.n}`;
  }

  destroy(): void {
    this.destroyed = true;
    window.clearTimeout(this.timer);
    this.ui.app.renderer.off('postrender', this.onRender);
    this.ui.off('focuschange', this.schedule);
    this.root.remove();
    this.entries.clear();
  }
}

function setAttr(el: HTMLElement, name: string, value: string | null): void {
  if (value === null) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/** Puts `kids` in order under `parent`, touching the DOM only when the order changed. */
function reconcile(parent: HTMLElement, kids: HTMLElement[]): void {
  const cur = parent.children;
  let same = cur.length === kids.length;
  for (let i = 0; same && i < kids.length; i++) same = cur[i] === kids[i];
  if (!same) parent.replaceChildren(...kids);
}
