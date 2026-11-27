import { css as hex } from './render/canvas';

// Pop-out: moves the form's host (canvas and state included) into a dialog and back; nothing is rebuilt.
export interface PopoutOptions {
  label: string;
  maxWidth: number;
  fill: boolean;
  colors(): { background: number; surface: number; text: number; border: number };
  onChange(open: boolean): void;
}

export interface Popout {
  readonly button: HTMLButtonElement;
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  place(hostWidth: number): void;
  paint(): void;
  destroy(): void;
}

const SVG = 'http://www.w3.org/2000/svg';
const EXPAND = 'M4 9V4h5M15 4h5v5M4 15v5h5M20 15v5h-5';
const COLLAPSE = 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5';

export function createPopout(host: HTMLElement, o: PopoutOptions): Popout {
  const button = document.createElement('button');
  button.type = 'button';
  const icon = document.createElementNS(SVG, 'svg');
  const path = document.createElementNS(SVG, 'path');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: '18', height: '18', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) icon.setAttribute(k, v);
  icon.append(path);
  button.append(icon);
  Object.assign(button.style, { position: 'absolute', top: '10px', right: '10px', zIndex: '3', width: '34px', height: '34px', padding: '0', display: 'grid', placeItems: 'center', border: '1px solid', borderRadius: '9px', cursor: 'pointer' });

  let overlay: HTMLDivElement | null = null;
  let panel: HTMLDivElement | null = null;
  let placeholder: HTMLDivElement | null = null;
  let saved = { height: '', width: '', overflow: '' };
  let inert: [HTMLElement, boolean][] = [];

  const paint = () => {
    const c = o.colors();
    Object.assign(button.style, { background: hex(c.surface), color: hex(c.text), borderColor: hex(c.border) });
    if (panel) panel.style.background = hex(c.background);
    const label = overlay ? 'Back to the page' : 'Open in a larger view';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('aria-expanded', String(!!overlay));
    path.setAttribute('d', overlay ? COLLAPSE : EXPAND);
  };

  const onBackdrop = (e: MouseEvent) => e.target === overlay && api.close();
  const onKey = (e: KeyboardEvent) => {
    // An open list or calendar handles Escape first.
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault();
      api.close();
    }
  };

  const api: Popout = {
    button,
    get isOpen() {
      return !!overlay;
    },
    open() {
      if (overlay || !host.isConnected) return;
      placeholder = document.createElement('div');
      placeholder.style.height = `${host.offsetHeight}px`;
      overlay = document.createElement('div');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', o.label);
      Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '2147483000', overflowY: 'auto', overscrollBehavior: 'contain', boxSizing: 'border-box', padding: 'min(6vh, 48px) 12px', background: 'rgba(8, 10, 20, 0.6)' });
      panel = document.createElement('div');
      Object.assign(panel.style, { position: 'relative', margin: '0 auto', width: '100%', maxWidth: `${o.maxWidth + 32}px`, borderRadius: '16px', padding: '8px 0', boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35)' });
      saved = { height: host.style.height, width: host.style.width, overflow: document.documentElement.style.overflow };
      host.replaceWith(placeholder);
      host.style.width = '100%';
      if (o.fill) host.style.height = 'min(85vh, 900px)';
      panel.append(host);
      overlay.append(panel);
      // The rest of the page is inert while open.
      inert = [...document.body.children].map((el) => [el as HTMLElement, (el as HTMLElement).inert]);
      for (const [el] of inert) el.inert = true;
      document.body.append(overlay);
      document.documentElement.style.overflow = 'hidden';
      overlay.addEventListener('click', onBackdrop);
      overlay.addEventListener('keydown', onKey);
      paint();
      button.focus();
      o.onChange(true);
    },
    close() {
      if (!overlay) return;
      for (const [el, was] of inert) el.inert = was;
      inert = [];
      placeholder!.replaceWith(host);
      host.style.width = saved.width;
      if (o.fill) host.style.height = saved.height;
      document.documentElement.style.overflow = saved.overflow;
      overlay.remove();
      overlay = panel = placeholder = null;
      paint();
      button.focus();
      o.onChange(false);
    },
    place(hostWidth) {
      const outer = hostWidth < 480 ? 8 : 16;
      const formWidth = Math.min(o.maxWidth, hostWidth - outer * 2);
      button.style.top = `${outer + 8}px`;
      button.style.right = `${Math.round((hostWidth - formWidth) / 2) + 8}px`;
    },
    paint,
    destroy() {
      api.close();
      button.remove();
    },
  };
  button.addEventListener('click', () => (overlay ? api.close() : api.open()));
  paint();
  return api;
}
