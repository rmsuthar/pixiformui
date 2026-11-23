export interface BotGuardOptions {
  /** Submissions faster than this after the form appeared are rejected. */
  minFillMs?: number;
  /** Minimum number of trusted (user-generated) input events required. */
  minInteractions?: number;
}

/**
 * Lightweight heuristics against scripted submissions. Only trusted events
 * (`event.isTrusted`) are counted, so synthetic `dispatchEvent` calls don't help.
 * Pair this with server-side verification (e.g. a CAPTCHA/Turnstile token).
 */
export class BotGuard {
  private readonly start = performance.now();
  private interactions = 0;
  private readonly opts: Required<BotGuardOptions>;

  constructor(opts: BotGuardOptions = {}) {
    this.opts = { minFillMs: 2000, minInteractions: 3, ...opts };
  }

  recordInteraction(e: Event): void {
    if (e.isTrusted) this.interactions++;
  }

  check(now = performance.now()): { ok: boolean; reason?: string } {
    if (now - this.start < this.opts.minFillMs) return { ok: false, reason: 'Submitted too quickly. Please try again.' };
    if (this.interactions < this.opts.minInteractions) return { ok: false, reason: 'Please complete the form manually.' };
    return { ok: true };
  }
}
