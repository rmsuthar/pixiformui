/**
 * Mutable code-point storage backed by a typed array that can be zeroed.
 *
 * JavaScript strings are immutable and cannot be wiped, so PixiForm keeps all
 * field contents here instead. Whenever the buffer grows, the old backing
 * array is zero-filled before being released. `wipe()` zeroes everything.
 *
 * Note: this reduces — it cannot eliminate — the lifetime of secrets in memory.
 * Any call to `toString()` creates an immutable string copy.
 */
export class SecureBuffer {
  private data: Uint32Array;
  private len = 0;

  constructor(capacity = 32) {
    this.data = new Uint32Array(Math.max(8, capacity));
  }

  get length(): number {
    return this.len;
  }

  at(index: number): number {
    return index >= 0 && index < this.len ? this.data[index] : 0;
  }

  /** Inserts code points at `index`. */
  insert(index: number, codePoints: ArrayLike<number>): void {
    const n = codePoints.length;
    if (n === 0) return;
    index = clamp(index, 0, this.len);
    this.ensure(this.len + n);
    this.data.copyWithin(index + n, index, this.len);
    for (let i = 0; i < n; i++) this.data[index + i] = codePoints[i];
    this.len += n;
  }

  /** Removes the half-open range [start, end). */
  delete(start: number, end: number): void {
    start = clamp(start, 0, this.len);
    end = clamp(end, start, this.len);
    if (end === start) return;
    this.data.copyWithin(start, end, this.len);
    const newLen = this.len - (end - start);
    this.data.fill(0, newLen, this.len);
    this.len = newLen;
  }

  /** Replaces the whole content. */
  set(codePoints: ArrayLike<number>): void {
    this.wipe();
    this.insert(0, codePoints);
  }

  /** Builds a string for [start, end). Avoid on secret buffers except for explicit reveal. */
  toString(start = 0, end = this.len): string {
    start = clamp(start, 0, this.len);
    end = clamp(end, start, this.len);
    let out = '';
    const CHUNK = 4096;
    for (let i = start; i < end; i += CHUNK) {
      out += String.fromCodePoint(...this.data.subarray(i, Math.min(end, i + CHUNK)));
    }
    return out;
  }

  /** Constant-time (w.r.t. content) equality check. */
  equals(other: SecureBuffer): boolean {
    const max = Math.max(this.len, other.len);
    let diff = this.len ^ other.len;
    for (let i = 0; i < max; i++) diff |= this.at(i) ^ other.at(i);
    return diff === 0;
  }

  /** Visits code points without allocating a string. */
  forEach(fn: (cp: number, index: number) => void): void {
    for (let i = 0; i < this.len; i++) fn(this.data[i], i);
  }

  /**
   * UTF-8 encodes the content into a new byte array without creating a JS
   * string. The caller owns the result and should `fill(0)` it after use.
   */
  toUtf8(): Uint8Array<ArrayBuffer> {
    let size = 0;
    for (let i = 0; i < this.len; i++) {
      const cp = this.data[i];
      size += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    }
    const out = new Uint8Array(size);
    let o = 0;
    for (let i = 0; i < this.len; i++) {
      const cp = this.data[i];
      if (cp < 0x80) out[o++] = cp;
      else if (cp < 0x800) {
        out[o++] = 0xc0 | (cp >> 6);
        out[o++] = 0x80 | (cp & 0x3f);
      } else if (cp < 0x10000) {
        out[o++] = 0xe0 | (cp >> 12);
        out[o++] = 0x80 | ((cp >> 6) & 0x3f);
        out[o++] = 0x80 | (cp & 0x3f);
      } else {
        out[o++] = 0xf0 | (cp >> 18);
        out[o++] = 0x80 | ((cp >> 12) & 0x3f);
        out[o++] = 0x80 | ((cp >> 6) & 0x3f);
        out[o++] = 0x80 | (cp & 0x3f);
      }
    }
    return out;
  }

  wipe(): void {
    this.data.fill(0);
    this.len = 0;
  }

  private ensure(capacity: number): void {
    if (capacity <= this.data.length) return;
    let next = this.data.length;
    while (next < capacity) next *= 2;
    const grown = new Uint32Array(next);
    grown.set(this.data.subarray(0, this.len));
    this.data.fill(0); // scrub the old backing store before release
    this.data = grown;
  }
}

export function toCodePoints(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) out.push(ch.codePointAt(0)!);
  return out;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
