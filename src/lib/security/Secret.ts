import type { SecureBuffer } from './SecureBuffer';

/**
 * Opaque handle to a secret field value (e.g. a password).
 *
 * The plain text is only materialised inside an explicit `use()` callback so
 * secrets cannot leak through `JSON.stringify`, `console.log`, or template
 * strings by accident.
 */
export class Secret {
  readonly #buffer: SecureBuffer;

  constructor(buffer: SecureBuffer) {
    this.#buffer = buffer;
  }

  get length(): number {
    return this.#buffer.length;
  }

  get isEmpty(): boolean {
    return this.#buffer.length === 0;
  }

  /** Exposes the plain text to `fn` only. Do not store or log it. */
  use<T>(fn: (plain: string) => T): T {
    return fn(this.#buffer.toString());
  }

  /** UTF-8 bytes without creating a string. Zero the result with `fill(0)` after use. */
  toUtf8(): Uint8Array<ArrayBuffer> {
    return this.#buffer.toUtf8();
  }

  /** Constant-time comparison that never creates strings. */
  equals(other: Secret): boolean {
    return this.#buffer.equals(other.#buffer);
  }

  /** Counts code points matching a predicate without creating strings. */
  count(predicate: (codePoint: number) => boolean): number {
    let n = 0;
    this.#buffer.forEach((cp) => {
      if (predicate(cp)) n++;
    });
    return n;
  }

  toString(): string {
    return '[Secret]';
  }

  toJSON(): string {
    return '[Secret]';
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return '[Secret]';
  }
}
