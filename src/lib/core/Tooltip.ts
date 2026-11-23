import { Container, Graphics, Text } from '../render/canvas';
import type { FormUI } from './FormUI';

/**
 * Single shared tooltip bubble rendered in `ui.overlay`. Positions itself
 * above its anchor (or below when there's no room) and stays on screen.
 * Content is plain text, never HTML.
 */
export class Tooltip extends Container {
  private readonly bg = new Graphics();
  private readonly txt: Text;
  private anchorRef: Container | null = null;
  private owner: unknown = null;

  constructor(private readonly ui: FormUI) {
    super();
    this.txt = new Text({ text: '' });
    this.addChild(this.bg, this.txt);
    this.visible = false;
    this.eventMode = 'none';
  }

  get isOpen(): boolean {
    return this.visible;
  }

  /** `owner` identifies who opened it, so only they close it on pointer-out. */
  show(anchor: Container, text: string, owner: unknown = anchor): void {
    if (!text) return;
    const t = this.ui.theme;
    const c = t.colors;
    const screen = this.ui.app.screen;
    const maxW = Math.min(280, screen.width - 24);
    this.txt.style = {
      fontFamily: t.fontFamily.join(','),
      fontSize: t.helperFontSize + 1,
      fill: c.inverseText,
      lineHeight: Math.ceil((t.helperFontSize + 1) * t.lineHeight),
      wordWrap: true,
      wordWrapWidth: maxW - 24,
    };
    this.txt.text = text.slice(0, 500);
    const w = Math.min(maxW, Math.ceil(this.txt.width) + 24);
    const h = Math.ceil(this.txt.height) + 16;

    const b = anchor.getBounds();
    const above = b.y - h - 10 >= 8;
    const ax = b.x + b.width / 2;
    const x = Math.round(Math.max(8, Math.min(screen.width - w - 8, ax - w / 2)));
    const y = Math.round(above ? b.y - h - 8 : b.y + b.height + 8);
    const arrowX = Math.max(12, Math.min(w - 12, ax - x));

    this.bg
      .clear()
      .roundRect(0, 2, w, h, 8)
      .fill({ color: c.shadow, alpha: 0.18 })
      .roundRect(0, 0, w, h, 8)
      .fill(c.inverseSurface);
    if (above) this.bg.poly([arrowX - 6, h, arrowX + 6, h, arrowX, h + 6]).fill(c.inverseSurface);
    else this.bg.poly([arrowX - 6, 0, arrowX + 6, 0, arrowX, -6]).fill(c.inverseSurface);
    this.txt.position.set(12, 8);

    const local = this.ui.overlay.toLocal({ x, y });
    this.position.set(local.x, local.y);
    this.ui.overlay.addChild(this); // bring to front
    this.anchorRef = anchor;
    this.owner = owner;
    this.visible = true;
  }

  hide(owner?: unknown): void {
    if (owner !== undefined && owner !== this.owner) return;
    this.visible = false;
    this.anchorRef = null;
    this.owner = null;
  }

  toggle(anchor: Container, text: string, owner: unknown = anchor): void {
    if (this.visible && this.owner === owner) this.hide();
    else this.show(anchor, text, owner);
  }

  get anchor(): Container | null {
    return this.anchorRef;
  }
}
