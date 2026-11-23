import type { AnalyticsEvent } from './analytics';

type Handler = (e: AnalyticsEvent) => void;
type Flat = Record<string, string | number | boolean>;

/** Flattens an event for tools that only accept scalar parameters (arrays become comma lists, max 100 chars). */
export function flattenEvent(e: AnalyticsEvent, omit: (keyof AnalyticsEvent)[] = []): Flat {
  const out: Flat = {};
  for (const [k, v] of Object.entries(e)) {
    if (v === undefined || omit.includes(k as keyof AnalyticsEvent)) continue;
    out[k] = Array.isArray(v) ? v.join(',').slice(0, 100) : typeof v === 'string' ? v.slice(0, 100) : (v as number | boolean);
  }
  return out;
}

const w = () => window as unknown as Record<string, any>;

/**
 * Ready-made handlers for `analytics.onEvent`. Event names are prefixed
 * (default 'pixiform_') so they don't collide with a tool's built-in names
 * (GA4's enhanced measurement already uses `form_start`/`form_submit`).
 */
export const analyticsAdapters = {
  /** Google Analytics 4 via gtag.js: gtag('event', 'pixiform_field_error', { form_id, field, error_code, … }). */
  ga4(opts: { prefix?: string; gtag?: (...args: unknown[]) => void } = {}): Handler {
    const prefix = opts.prefix ?? 'pixiform_';
    return (e) => {
      const gtag = opts.gtag ?? w().gtag;
      if (typeof gtag !== 'function') return;
      const params: Flat = {};
      for (const [k, v] of Object.entries(flattenEvent(e, ['type']))) params[snake(k)] = v;
      if (e.type === 'form_abandon' || e.type === 'submit_success') params.transport_type = 'beacon';
      gtag('event', `${prefix}${e.type}`, params);
    };
  },

  /** Google Tag Manager: dataLayer.push({ event: 'pixiform_submit_success', pixiform: { … } }). */
  dataLayer(opts: { name?: string; prefix?: string } = {}): Handler {
    const name = opts.name ?? 'dataLayer';
    const prefix = opts.prefix ?? 'pixiform_';
    return (e) => {
      const layer = (w()[name] ??= []) as unknown[];
      layer.push({ event: `${prefix}${e.type}`, pixiform: { ...e } });
    };
  },

  /** Segment / RudderStack / any analytics.js-compatible client: analytics.track('PixiForm Field Error', props). */
  segment(client?: { track(event: string, props?: object): void }): Handler {
    return (e) => {
      const c = client ?? w().analytics;
      c?.track?.(title(e.type), { ...e });
    };
  },

  /** PostHog: posthog.capture('pixiform_field_error', props). */
  posthog(client?: { capture(event: string, props?: object): void }, prefix = 'pixiform_'): Handler {
    return (e) => {
      const c = client ?? w().posthog;
      c?.capture?.(`${prefix}${e.type}`, { ...e });
    };
  },

  /** Plausible custom events: plausible('pixiform_submit_success', { props }). */
  plausible(fn?: (event: string, opts?: { props?: Flat }) => void, prefix = 'pixiform_'): Handler {
    return (e) => {
      const p = fn ?? w().plausible;
      if (typeof p === 'function') p(`${prefix}${e.type}`, { props: flattenEvent(e, ['type']) });
    };
  },

  /**
   * Your own endpoint. Batches events and sends them with navigator.sendBeacon
   * (survives page unload). Remember to allow the URL in your CSP `connect-src`.
   */
  beacon(url: string, opts: { flushMs?: number; maxBatch?: number } = {}): Handler {
    const queue: AnalyticsEvent[] = [];
    let timer = 0;
    const flush = () => {
      window.clearTimeout(timer);
      timer = 0;
      if (!queue.length) return;
      const body = JSON.stringify({ events: queue.splice(0) });
      const blob = new Blob([body], { type: 'application/json' });
      if (!navigator.sendBeacon?.(url, blob)) void fetch(url, { method: 'POST', body, keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    };
    addEventListener('pagehide', flush);
    return (e) => {
      queue.push(e);
      if (queue.length >= (opts.maxBatch ?? 20) || e.type === 'form_abandon' || e.type === 'submit_success') flush();
      else if (!timer) timer = window.setTimeout(flush, opts.flushMs ?? 3000);
    };
  },

  /** Sends each event to several handlers. */
  combine(...handlers: Handler[]): Handler {
    return (e) => {
      for (const h of handlers) {
        try {
          h(e);
        } catch (err) {
          console.warn('[pixiform] analytics handler failed', err);
        }
      }
    };
  },
};

const snake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const title = (t: string) => `PixiForm ${t.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}`;
