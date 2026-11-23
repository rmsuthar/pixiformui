import type { Graphics } from '../render/canvas';

/** Vector icons drawn into a Graphics, centred at (cx, cy), sized `s` (24 = 1x). */
export const Icons = {
  check(g: Graphics, cx: number, cy: number, s: number, color: number, width = 2, progress = 1): Graphics {
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
    return g.stroke({ width: width * k * 1.2, color, cap: 'round', join: 'round' });
  },

  dash(g: Graphics, cx: number, cy: number, s: number, color: number): Graphics {
    const k = s / 24;
    return g.moveTo(cx - 6 * k, cy).lineTo(cx + 6 * k, cy).stroke({ width: 2.4 * k, color, cap: 'round' });
  },

  close(g: Graphics, cx: number, cy: number, s: number, color: number): Graphics {
    const k = s / 24;
    const a = 5.5 * k;
    return g
      .moveTo(cx - a, cy - a).lineTo(cx + a, cy + a)
      .moveTo(cx + a, cy - a).lineTo(cx - a, cy + a)
      .stroke({ width: 2 * k, color, cap: 'round' });
  },

  /** Eye / eye-off (password visibility). */
  eye(g: Graphics, cx: number, cy: number, s: number, color: number, off: boolean): Graphics {
    const k = s / 24;
    g.moveTo(cx - 10 * k, cy)
      .quadraticCurveTo(cx, cy - 10.5 * k, cx + 10 * k, cy)
      .quadraticCurveTo(cx, cy + 10.5 * k, cx - 10 * k, cy)
      .closePath()
      .stroke({ width: 1.8 * k, color, join: 'round' });
    g.circle(cx, cy, 3.2 * k).fill(color);
    if (off) {
      g.moveTo(cx - 9 * k, cy - 8 * k).lineTo(cx + 9 * k, cy + 8 * k).stroke({ width: 1.8 * k, color, cap: 'round' });
    }
    return g;
  },

  chevron(g: Graphics, cx: number, cy: number, s: number, color: number, up = false): Graphics {
    const k = s / 24;
    const dy = up ? -1 : 1;
    return g
      .moveTo(cx - 5 * k, cy - 2.5 * k * dy)
      .lineTo(cx, cy + 2.5 * k * dy)
      .lineTo(cx + 5 * k, cy - 2.5 * k * dy)
      .stroke({ width: 2 * k, color, cap: 'round', join: 'round' });
  },

  errorCircle(g: Graphics, cx: number, cy: number, s: number, color: number): Graphics {
    const k = s / 24;
    g.circle(cx, cy, 10 * k).fill(color);
    g.roundRect(cx - 1.1 * k, cy - 6 * k, 2.2 * k, 7.5 * k, 1 * k).fill(0xffffff);
    g.circle(cx, cy + 4.6 * k, 1.3 * k).fill(0xffffff);
    return g;
  },

  lock(g: Graphics, cx: number, cy: number, s: number, color: number): Graphics {
    const k = s / 24;
    g.roundRect(cx - 7 * k, cy - 2 * k, 14 * k, 11 * k, 2 * k).fill(color);
    g.moveTo(cx - 4.5 * k, cy - 2 * k)
      .lineTo(cx - 4.5 * k, cy - 5 * k)
      .arc(cx, cy - 5 * k, 4.5 * k, Math.PI, 0)
      .lineTo(cx + 4.5 * k, cy - 2 * k)
      .stroke({ width: 2 * k, color });
    return g;
  },

  calendar(g: Graphics, cx: number, cy: number, s: number, color: number): Graphics {
    const k = s / 24;
    g.roundRect(cx - 8 * k, cy - 6.5 * k, 16 * k, 15 * k, 2.5 * k).stroke({ width: 1.8 * k, color });
    g.moveTo(cx - 8 * k, cy - 2 * k).lineTo(cx + 8 * k, cy - 2 * k).stroke({ width: 1.8 * k, color });
    g.moveTo(cx - 4 * k, cy - 9 * k).lineTo(cx - 4 * k, cy - 5 * k).moveTo(cx + 4 * k, cy - 9 * k).lineTo(cx + 4 * k, cy - 5 * k)
      .stroke({ width: 1.8 * k, color, cap: 'round' });
    for (const [dx, dy] of [[-4, 2], [0, 2], [4, 2], [-4, 5.5], [0, 5.5]]) g.circle(cx + dx * k, cy + dy * k, 1.1 * k).fill(color);
    return g;
  },

  arrow(g: Graphics, cx: number, cy: number, s: number, color: number, dir: 'left' | 'right' | 'up' | 'down'): Graphics {
    const k = s / 24;
    const pts = { left: [3, -6, -3, 0, 3, 6], right: [-3, -6, 3, 0, -3, 6], up: [-6, 3, 0, -3, 6, 3], down: [-6, -3, 0, 3, 6, -3] }[dir];
    return g
      .moveTo(cx + pts[0] * k, cy + pts[1] * k)
      .lineTo(cx + pts[2] * k, cy + pts[3] * k)
      .lineTo(cx + pts[4] * k, cy + pts[5] * k)
      .stroke({ width: 2 * k, color, cap: 'round', join: 'round' });
  },

  sun(g: Graphics, cx: number, cy: number, s: number, color: number): Graphics {
    const k = s / 24;
    g.circle(cx, cy, 4.5 * k).fill(color);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.moveTo(cx + Math.cos(a) * 7.5 * k, cy + Math.sin(a) * 7.5 * k)
        .lineTo(cx + Math.cos(a) * 10 * k, cy + Math.sin(a) * 10 * k);
    }
    return g.stroke({ width: 2 * k, color, cap: 'round' });
  },

  moon(g: Graphics, cx: number, cy: number, s: number, color: number): Graphics {
    const k = s / 24;
    const a0 = -Math.PI * 0.35;
    return g
      .moveTo(cx + Math.cos(a0) * 8.5 * k, cy + Math.sin(a0) * 8.5 * k)
      .arc(cx, cy, 8.5 * k, a0, Math.PI * 1.35)
      .arc(cx + 4 * k, cy - 3.5 * k, 7 * k, Math.PI * 0.95, -Math.PI * 0.15, true)
      .closePath()
      .fill(color);
  },
};
