/**
 * PixiFormUI website Worker. Static files are served by Workers Static Assets; this code
 * runs only for /v/* (see "run_worker_first" in wrangler.jsonc) to count downloads of the
 * self-hosted bundles in Workers Analytics Engine.
 *
 * Recorded per request (no IP address, no cookies, no personal data):
 *   blob1 version · blob2 file · blob3 country · blob4 embedding site (Referer host) · blob5 client type
 *   double1 = 1 (count) · index1 = version
 */
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DOWNLOADS?: { writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void };
}

const OWN_HOST = 'pixiformui.lets.gen.in';

function clientType(ua: string): string {
  if (!ua) return 'unknown';
  if (/bot|crawler|spider|preview|scan|monitor|curl|wget|python|go-http|java\//i.test(ua)) return 'bot/tool';
  if (/node|npm|undici|axios|deno|bun/i.test(ua)) return 'server';
  return 'browser';
}

function embeddingSite(referer: string | null): string {
  if (!referer) return '(none)';
  try {
    const host = new URL(referer).hostname.toLowerCase();
    return host === OWN_HOST ? '(this site)' : host.slice(0, 100);
  } catch {
    return '(invalid)';
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/v\/([^/]+)\/([^/]+)$/);
    if (m && response.ok && (request.method === 'GET' || request.method === 'HEAD')) {
      try {
        const cf = (request as Request & { cf?: { country?: string } }).cf;
        env.DOWNLOADS?.writeDataPoint({
          blobs: [m[1], m[2], cf?.country ?? 'XX', embeddingSite(request.headers.get('referer')), clientType(request.headers.get('user-agent') ?? '')],
          doubles: [1],
          indexes: [m[1]],
        });
      } catch {
        // Analytics must never break a download.
      }
    }
    return response;
  },
};
