/**
 * Invisible proof-of-work for form submissions ("form proof").
 *
 *   const proof = new FormProof(session.pow);   // { challenge, difficulty } from your server
 *   proof.start();                              // solves in the background while the person types
 *   await secureSubmit(url, body, { proof: await proof.token() });
 *   proof.update(reply.pow);                    // the server sends a fresh challenge after use
 *
 * Solving runs on the main thread in short slices (yielding between them), so it needs no
 * workers or WebAssembly and works under a strict CSP. See shared/pow.ts for the scheme.
 */
import { powToken, searchPow, type PowChallenge } from '../../../shared/pow';

export type { PowChallenge } from '../../../shared/pow';

const SLICE = 15_000; // hashes per slice (~5–15 ms)
const yieldToPage = () => new Promise<void>((r) => setTimeout(r, 0));

export class FormProof {
  private current: PowChallenge | null;
  private solved: { challenge: string; token: string } | null = null;
  private running: Promise<string> | null = null;
  private generation = 0;

  constructor(challenge?: PowChallenge | null) {
    this.current = challenge ?? null;
  }

  /** True when the server asked for a proof. */
  get required(): boolean {
    return !!this.current && this.current.difficulty > 0;
  }

  /** Starts solving in the background (no-op if already solving or solved). */
  start(): this {
    void this.token().catch(() => {});
    return this;
  }

  /** Replaces the challenge (e.g. the server sent a new one) and starts solving it. */
  update(challenge: PowChallenge | null | undefined): this {
    if (!challenge || challenge.challenge === this.current?.challenge) return this;
    this.current = challenge;
    this.solved = null;
    this.running = null;
    this.generation++;
    return this.start();
  }

  /** The header value for the current challenge, solving it first if needed ('' if none required). */
  token(): Promise<string> {
    const c = this.current;
    if (!c || c.difficulty <= 0) return Promise.resolve('');
    if (this.solved?.challenge === c.challenge) return Promise.resolve(this.solved.token);
    if (this.running) return this.running;
    const gen = this.generation;
    this.running = (async () => {
      for (let from = 0; from < Number.MAX_SAFE_INTEGER; from += SLICE) {
        if (gen !== this.generation) throw new Error('challenge replaced');
        const nonce = searchPow(c, from, SLICE);
        if (nonce !== null) {
          const token = powToken(c, nonce);
          if (gen === this.generation) {
            this.solved = { challenge: c.challenge, token };
            this.running = null;
          }
          return token;
        }
        await yieldToPage();
      }
      throw new Error('no solution');
    })();
    return this.running;
  }
}
