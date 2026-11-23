export interface RateLimiterOptions {
  /** Attempts allowed inside `windowMs` before locking. */
  maxAttempts?: number;
  windowMs?: number;
  /** First lockout duration; doubles on every subsequent lockout. */
  lockoutMs?: number;
  maxLockoutMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryInMs: number;
}

/**
 * Client-side attempt limiter with exponential lockout.
 * This is a UX/abuse speed bump only — the server MUST enforce its own limits.
 */
export class RateLimiter {
  private attempts: number[] = [];
  private lockedUntil = 0;
  private lockouts = 0;
  private readonly opts: Required<RateLimiterOptions>;

  constructor(opts: RateLimiterOptions = {}) {
    this.opts = { maxAttempts: 5, windowMs: 60_000, lockoutMs: 15_000, maxLockoutMs: 15 * 60_000, ...opts };
  }

  attempt(now = performance.now()): RateLimitResult {
    if (now < this.lockedUntil) return { allowed: false, retryInMs: this.lockedUntil - now };
    this.attempts = this.attempts.filter((t) => now - t < this.opts.windowMs);
    if (this.attempts.length >= this.opts.maxAttempts) {
      const duration = Math.min(this.opts.lockoutMs * 2 ** this.lockouts, this.opts.maxLockoutMs);
      this.lockouts++;
      this.lockedUntil = now + duration;
      this.attempts = [];
      return { allowed: false, retryInMs: duration };
    }
    this.attempts.push(now);
    return { allowed: true, retryInMs: 0 };
  }

  /** Call after a successful submission. */
  reset(): void {
    this.attempts = [];
    this.lockedUntil = 0;
    this.lockouts = 0;
  }
}
