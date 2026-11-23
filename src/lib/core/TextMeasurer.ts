/** Fast text width measurement on a private 2D canvas context. */
export class TextMeasurer {
  private readonly ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private font = '';

  constructor() {
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  width(text: string, font: string): number {
    if (!text) return 0;
    if (font !== this.font) {
      this.ctx.font = font;
      this.font = font;
    }
    return this.ctx.measureText(text).width;
  }

  /** Cumulative widths: result[i] = width of the first i code points. */
  prefixWidths(codePoints: readonly string[], font: string): number[] {
    const out = new Array<number>(codePoints.length + 1);
    out[0] = 0;
    let acc = '';
    for (let i = 0; i < codePoints.length; i++) {
      acc += codePoints[i];
      out[i + 1] = this.width(acc, font);
    }
    return out;
  }
}
