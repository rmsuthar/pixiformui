/**
 * Screen-reader live region. Only labels and messages are announced — never
 * field values.
 */
export class Announcer {
  private readonly el: HTMLDivElement;
  private timer = 0;

  constructor(host: HTMLElement) {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    const s = el.style;
    s.position = 'absolute';
    s.width = '1px';
    s.height = '1px';
    s.overflow = 'hidden';
    s.clipPath = 'inset(50%)';
    s.whiteSpace = 'nowrap';
    host.appendChild(el);
    this.el = el;
  }

  announce(message: string, assertive = false): void {
    this.el.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
    this.el.textContent = '';
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => (this.el.textContent = message), 50);
  }

  destroy(): void {
    window.clearTimeout(this.timer);
    this.el.remove();
  }
}
