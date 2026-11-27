/**
 * pixiformui/translate: show a form in the visitor's language.
 *
 *   import { translateConfig } from 'pixiformui/translate';
 *   mountPixiForm(host, await translateConfig(config, { url: 'https://cloud.pixiformui.lets.gen.in/f/<id>/translate' }));
 *
 * Collects every text a visitor reads in the config (title, labels, placeholders, help, tooltips, options,
 * headings, paragraphs, buttons and "required" messages), asks a translation endpoint (or your own
 * `translate` function) for the browser's language, and returns a translated copy of the config. Only the
 * form's own texts are sent, never anything a visitor types. If translation fails or is slow, the original
 * config comes back unchanged, so the form always shows.
 *
 * Endpoint contract: POST { source, target, strings: string[] } → { translations: string[] } (same order).
 * No runtime imports: works in browsers, servers (SSR) and tests.
 */

export interface TranslateOptions {
  /** Translation endpoint (PixiForm Cloud: `<cloud>/f/<formId>/translate`). */
  url?: string;
  /** Or translate yourself (DeepL, Google, your own table…): same order in, same order out. */
  translate?: (strings: string[], target: string, source: string) => Promise<string[]>;
  /** The visitor's language (BCP 47, e.g. 'hi', 'pt-BR'). Default: the browser's first preference. */
  target?: string;
  /** The language the config is written in. Default 'en'. */
  source?: string;
  /** Give up and keep the original after this long. Default 4000 ms. */
  timeoutMs?: number;
}

type Obj = Record<string, unknown>;
const TEXT_KEYS = ['label', 'placeholder', 'helperText', 'info', 'requiredMessage', 'text', 'title', 'description'] as const;
const TOP_KEYS = ['title', 'subtitle', 'submitText', 'resetText', 'nextText', 'backText', 'stepLabel'] as const;
const REQUIRED = '{label} is required.';
const TAG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i;

/** The browser's preferred language, or 'en'. */
export function visitorLanguage(): string {
  const n = typeof navigator === 'undefined' ? undefined : navigator;
  return (n?.languages?.[0] ?? n?.language ?? 'en').trim();
}

const primary = (tag: string) => tag.toLowerCase().split('-')[0];

/** Every distinct text in a config, in a stable order (exported for tests and custom pipelines). */
export function configStrings(config: Obj): string[] {
  const out = new Set<string>();
  const add = (v: unknown) => typeof v === 'string' && v.trim() && out.add(v);
  for (const k of TOP_KEYS) add(config[k]);
  let needsRequired = false;
  const walk = (fields: unknown) => {
    if (!Array.isArray(fields)) return;
    for (const f of fields as Obj[]) {
      if (!f || typeof f !== 'object') continue;
      for (const k of TEXT_KEYS) add(f[k]);
      if (Array.isArray(f.options)) for (const o of f.options as Obj[]) add(o?.label);
      if (f.required && !f.requiredMessage && f.label) needsRequired = true;
      walk(f.fields);
    }
  };
  walk(config.fields);
  // Multi-step forms: step titles and descriptions, then their fields.
  if (Array.isArray(config.steps)) for (const s of config.steps as Obj[]) {
    add(s?.title);
    add(s?.description);
    walk(s?.fields);
  }
  if (Array.isArray(config.steps)) {
    if (config.nextText === undefined) out.add('Next');
    if (config.backText === undefined) out.add('Back');
    if (config.stepLabel === undefined) out.add('Step {n} of {total}');
  }
  if (needsRequired) out.add(REQUIRED);
  return [...out];
}

/** A copy of the config with texts replaced through `map` (unknown texts stay as they are). */
export function applyStrings<T extends Obj>(config: T, map: Map<string, string>): T {
  const tr = (v: unknown) => (typeof v === 'string' ? (map.get(v) ?? v) : v);
  const field = (f: Obj): Obj => {
    if (!f || typeof f !== 'object') return f;
    const c: Obj = { ...f };
    for (const k of TEXT_KEYS) if (typeof f[k] === 'string') c[k] = tr(f[k]);
    if (Array.isArray(f.options)) c.options = (f.options as Obj[]).map((o) => (o && typeof o === 'object' ? { ...o, label: tr(o.label) } : o));
    // The library's default "<label> is required." in the visitor's language, with the translated label.
    if (f.required && !f.requiredMessage && typeof c.label === 'string' && map.has(REQUIRED)) c.requiredMessage = map.get(REQUIRED)!.replace('{label}', c.label as string);
    if (Array.isArray(f.fields)) c.fields = (f.fields as Obj[]).map(field);
    return c;
  };
  const out: Obj = { ...config };
  for (const k of TOP_KEYS) if (typeof config[k] === 'string') out[k] = tr(config[k]);
  if (Array.isArray(config.fields)) out.fields = (config.fields as Obj[]).map(field);
  if (Array.isArray(config.steps)) {
    out.steps = (config.steps as Obj[]).map((s) => (s && typeof s === 'object' ? { ...s, title: tr(s.title), description: tr(s.description), fields: Array.isArray(s.fields) ? (s.fields as Obj[]).map(field) : s.fields } : s));
    // The library's defaults, translated (only when the config didn't set its own).
    for (const [k, d] of [['nextText', 'Next'], ['backText', 'Back'], ['stepLabel', 'Step {n} of {total}']] as const) if (config[k] === undefined && map.has(d)) out[k] = map.get(d);
  }
  return out as T;
}

async function fetchTranslations(url: string, strings: string[], target: string, source: string, signal: AbortSignal): Promise<string[]> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ source, target, strings }),
    credentials: 'omit',
    cache: 'default',
    redirect: 'error',
    referrerPolicy: 'strict-origin',
    signal,
  });
  if (!res.ok) throw new Error(`translate: ${res.status}`);
  const body = (await res.json()) as { translations?: unknown };
  if (!Array.isArray(body.translations)) throw new Error('translate: bad reply');
  return body.translations as string[];
}

/** Returns the config translated into the visitor's language, or the original config if that isn't possible. */
export async function translateConfig<T extends Obj>(config: T, opts: TranslateOptions = {}): Promise<T> {
  const source = (opts.source ?? 'en').trim();
  const target = (opts.target ?? visitorLanguage()).trim();
  if (!TAG.test(source) || !TAG.test(target) || primary(source) === primary(target)) return config;
  const strings = configStrings(config);
  if (!strings.length || (!opts.url && !opts.translate)) return config;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 4000);
  try {
    const work = opts.translate ? opts.translate(strings, target, source) : fetchTranslations(opts.url!, strings, target, source, controller.signal);
    const timeout = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('translate: timed out')), { once: true }));
    const translated = await Promise.race([work, timeout]);
    const map = new Map<string, string>();
    strings.forEach((s, i) => {
      const t = translated[i];
      // Keep the original when a translation is missing, empty, or drops the {label} placeholder.
      const keepsTokens = (s.match(/\{[a-z]+\}/g) ?? []).every((tok) => t?.includes(tok));
      if (typeof t === 'string' && t.trim() && t.length <= s.length * 6 + 40 && keepsTokens) map.set(s, t);
    });
    return applyStrings(config, map);
  } catch (err) {
    console.warn('[pixiform] translation unavailable, showing the original text:', (err as Error).message);
    return config;
  } finally {
    clearTimeout(timer);
  }
}
