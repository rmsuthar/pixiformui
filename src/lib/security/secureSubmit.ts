export interface SecureSubmitOptions {
  /** Defaults to the content of <meta name="csrf-token">. */
  csrfToken?: string | null;
  csrfHeader?: string;
  timeoutMs?: number;
  /** Cross-origin targets are refused unless explicitly listed here. */
  allowedOrigins?: string[];
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /**
   * Sent as the `Idempotency-Key` header so the server processes a retried request only once
   * (e.g. after a lost response). Use `form.idempotencyKey` inside onSubmit.
   */
  idempotencyKey?: string;
  /** Proof-of-work token from FormProof.token(), sent as `X-Form-Proof`. */
  proof?: string;
  /** CAPTCHA token (Turnstile, hCaptcha…), sent as `X-Captcha-Token` for server-side verification. */
  captchaToken?: string;
}

export function readCsrfToken(): string | null {
  const el = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  return el?.content || null;
}

/**
 * POSTs JSON with hardened fetch defaults:
 * same-origin enforcement, HTTPS-only for allowed cross-origin targets,
 * CSRF header, no caching, no referrer, no redirects, and a timeout.
 */
function checkTarget(url: string, allowedOrigins?: string[]): { target: URL; sameOrigin: boolean } {
  const target = new URL(url, window.location.href);
  const sameOrigin = target.origin === window.location.origin;
  if (!sameOrigin) {
    if (!allowedOrigins?.includes(target.origin)) throw new Error(`Refusing to submit to untrusted origin ${target.origin}`);
    if (target.protocol !== 'https:') throw new Error('Cross-origin submissions require HTTPS');
  }
  if (target.username || target.password) throw new Error('Credentials in URLs are not allowed');
  return { target, sameOrigin };
}

export async function secureSubmit(url: string, body: unknown, opts: SecureSubmitOptions = {}): Promise<Response> {
  const { target, sameOrigin } = checkTarget(url, opts.allowedOrigins);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...opts.headers,
  };
  if (opts.idempotencyKey) {
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(opts.idempotencyKey)) throw new Error('Invalid idempotency key');
    headers['Idempotency-Key'] = opts.idempotencyKey;
  }
  if (opts.proof) headers['X-Form-Proof'] = opts.proof.slice(0, 200);
  if (opts.captchaToken) headers['X-Captcha-Token'] = opts.captchaToken.slice(0, 4096);
  const token = opts.csrfToken === undefined ? readCsrfToken() : opts.csrfToken;
  if (token) headers[opts.csrfHeader ?? 'X-CSRF-Token'] = token;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), opts.timeoutMs ?? 15_000);
  opts.signal?.addEventListener('abort', () => controller.abort(opts.signal!.reason), { once: true });

  try {
    return await fetch(target.href, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: sameOrigin ? 'same-origin' : 'omit',
      mode: sameOrigin ? 'same-origin' : 'cors',
      cache: 'no-store',
      redirect: 'error',
      // Not 'no-referrer': with it, Safari and Firefox send `Origin: null` on same-origin POSTs
      // (per the Fetch spec), which servers rightly reject. 'strict-origin' sends the real Origin
      // and a Referer of the origin only (never the page path).
      referrerPolicy: 'strict-origin',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Uploads one encrypted file (bytes from pixiformui/file) with the same rules as secureSubmit:
 * same origin (or an allowed HTTPS origin), CSRF header, no caching or redirects, a timeout.
 * The server answers `{ id }`, which the form then submits with the file's sealed key.
 */
export async function secureUpload(url: string, bytes: Uint8Array, field: string, opts: SecureSubmitOptions = {}): Promise<string> {
  const { target, sameOrigin } = checkTarget(url, opts.allowedOrigins);
  const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-Upload-Field': field, ...opts.headers };
  const token = opts.csrfToken === undefined ? readCsrfToken() : opts.csrfToken;
  if (token) headers[opts.csrfHeader ?? 'X-CSRF-Token'] = token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Upload timed out', 'TimeoutError')), opts.timeoutMs ?? 120_000);
  try {
    const res = await fetch(target.href, {
      method: 'POST',
      headers,
      body: bytes as BufferSource,
      credentials: sameOrigin ? 'same-origin' : 'omit',
      mode: sameOrigin ? 'same-origin' : 'cors',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'strict-origin',
      signal: controller.signal,
    });
    const reply = (await res.json().catch(() => ({}))) as { id?: unknown; message?: string };
    if (!res.ok || typeof reply.id !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(reply.id)) throw new Error(reply.message ?? `Upload failed (${res.status})`);
    return reply.id;
  } finally {
    clearTimeout(timer);
  }
}
