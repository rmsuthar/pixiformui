/**
 * PixiFormUI website: two live forms built with the library itself.
 * Nothing is sent to a server. The demo encrypts with a key generated in the
 * visitor's browser and shows what a real server would receive.
 */
import {
  accentPalettes,
  b64uEncode,
  mountPixiForm,
  type AccentName,
  type AnalyticsEvent,
  type EncryptionKey,
  type PixiFormEventMap,
  type PixiFormEventType,
  type PixiFormHandle,
  type PixiFormListeners,
} from '../src/lib';
import { mountDemoForm } from './demo-form';
import demoSource from './demo-form.ts?raw';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const mq = matchMedia('(prefers-color-scheme: dark)');

/** A throwaway PFE1 key pair: the private key never leaves this page and is discarded on reload. */
async function demoKey(): Promise<EncryptionKey> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const kid = b64uEncode(new Uint8Array(await crypto.subtle.digest('SHA-256', spki))).slice(0, 16);
  return { alg: 'PFE1', kid, spki: b64uEncode(spki), challenge: b64uEncode(crypto.getRandomValues(new Uint8Array(16))) };
}

// ------------------------------------------------------------------ hero
async function hero(): Promise<void> {
  const host = $('#hero-form');
  const handle = await mountPixiForm(host, {
    id: 'hero-sign-in',
    theme: 'indigo',
    card: false,
    privacyScreen: false,
    maxWidth: 420,
    a11y: { label: 'Example sign-in form' },
    fields: [
      { type: 'email', name: 'email', label: 'Email', placeholder: 'you@example.com', required: true },
      {
        type: 'password',
        name: 'password',
        label: 'Password',
        placeholder: 'Try typing here',
        required: true,
        info: 'Stored in wipeable memory and never written to the DOM.',
      },
      { type: 'switch', name: 'remember', label: 'Keep me signed in' },
    ],
    submitText: 'Sign in',
    onSubmit: async () => ({ ok: true, message: 'Demo only: nothing was sent.' }),
  });
  const proof = $('#hero-proof');
  handle.on('change', () => {
    const email = String(handle.values().email ?? '');
    if (email.length < 3) return;
    const found = pageContains(email);
    proof.textContent = found
      ? 'Found in the page? Yes (unexpected).'
      : `“${email.slice(0, 24)}${email.length > 24 ? '…' : ''}” is in the form, but not in the page's HTML or any input value.`;
  });
}

/** Is `text` anywhere in the document's markup or in any form control's value? */
function pageContains(text: string): boolean {
  if (!text) return false;
  // The payload panel shows submitted data on purpose; leave it out of the check.
  const shown = document.getElementById('payload')?.textContent ?? '';
  // Placeholder hints (developer text, exposed to screen readers) aren't user input either.
  const html = document.documentElement.outerHTML.replace(shown, '').replace(/aria-placeholder="[^"]*"/g, '');
  const inputs = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].map((i) => i.value).join('\n');
  return html.includes(text) || inputs.includes(text);
}

// ------------------------------------------------------------------ demo
async function demo(): Promise<void> {
  const key = await demoKey();
  const events = $('#events');
  let handle: PixiFormHandle;
  let accent: AccentName = 'indigo';
  let mode: 'light' | 'dark' | 'auto' = 'auto';

  handle = await mountDemoForm($('#demo-form'), {
    encryptionKey: key,
    theme: accent,
    mode,
    on: formEventLog($('#form-events')),
    onAnalytics: (e) => logEvent(events, e),
    onPayload: (body) => {
      // Each envelope is bound to a single-use challenge, like on a real server.
      key.challenge = b64uEncode(crypto.getRandomValues(new Uint8Array(16)));
      showPayload(body);
      selectTab('tab-payload');
    },
  });

  // ---- Source tab: the file above, exactly as it runs (read-only)
  $('#demo-source').textContent = demoSource.replace("from '../src/lib'", "from 'pixiformui'");

  // ---- appearance toolbar
  const swatches = $('#swatches');
  for (const name of Object.keys(accentPalettes) as AccentName[]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `swatch sw-${name}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(name === accent));
    b.setAttribute('aria-label', name);
    b.title = name;
    b.addEventListener('click', () => {
      accent = name;
      swatches.querySelectorAll('[role=radio]').forEach((s) => s.setAttribute('aria-checked', String(s === b)));
      handle.setTheme(accent, mode);
    });
    swatches.appendChild(b);
  }
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode as typeof mode;
      press(b);
      handle.setTheme(accent, mode);
      if (mode === 'auto') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = mode;
    }),
  );
  document.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((b) =>
    b.addEventListener('click', () => {
      press(b);
      handle.ui.setA11y({ textScale: Number(b.dataset.scale) });
    }),
  );

  // ---- DOM proof panel
  const facts = $('#dom-facts');
  const updateFacts = () => {
    const v = handle.values();
    const texts = Object.entries(v)
      .filter(([, x]) => typeof x === 'string' && (x as string).length >= 3)
      .map(([k, x]) => [k, x as string] as const);
    const leaked = texts.filter(([, x]) => pageContains(x)).map(([k]) => k);
    const proxy = document.querySelector<HTMLInputElement>('#demo-form input');
    const rows: [string, string][] = [
      ['Text values typed', String(texts.length)],
      ['Found in page HTML or inputs', leaked.length ? leaked.join(', ') : 'none'],
      ['Hidden input value', proxy ? `${JSON.stringify(proxy.value.replace(/​/g, '∅'))} (zero-width placeholder)` : 'n/a'],
      ['Password in memory as', 'Uint32Array (wiped after submit)'],
      ['Accessibility outline nodes', String(document.querySelectorAll('#demo-form .pixiform-a11y *').length)],
    ];
    facts.replaceChildren(
      ...rows.flatMap(([dt, dd]) => {
        const a = document.createElement('dt');
        a.textContent = dt;
        const b = document.createElement('dd');
        b.textContent = dd;
        return [a, b];
      }),
    );
  };
  let pending = 0;
  handle.on('change', () => {
    if (!pending) pending = window.setTimeout(() => ((pending = 0), updateFacts()), 250);
  });
  updateFacts();
  mq.addEventListener('change', () => mode === 'auto' && handle.setTheme(accent, 'auto'));
}

/** Listeners for every form event, rendered into the "Events" panel. */
function formEventLog(list: HTMLElement): PixiFormListeners {
  const describe = (type: PixiFormEventType, d: any): string => {
    switch (type) {
      case 'loadstart': return `reason: ${d.reason}`;
      case 'load': return `${d.ms} ms · ${d.fields} fields · ${d.width}×${d.height}`;
      case 'resize': return `${d.width}×${d.height}`;
      case 'themechange': return d.mode;
      case 'change': return `${d.name}${typeof d.value === 'object' && d.value ? ' · Secret handle' : ''}`;
      case 'validate': return `${d.name} · ${d.error ? `error (${d.code})` : 'ok'}`;
      case 'grouptoggle': return `${d.group} · ${d.expanded ? 'opened' : 'folded'}`;
      case 'invalid': return Object.keys(d.errors).join(', ');
      case 'success': case 'failure': return d.result.message ?? '';
      case 'blocked': return d.code;
      case 'error': return `${d.phase}: ${d.error.message}`;
      default: return d?.name ?? '';
    }
  };
  const listeners: Record<string, (d: unknown) => void> = {};
  const types: PixiFormEventType[] = ['loadstart', 'load', 'resize', 'themechange', 'a11ychange', 'focus', 'blur', 'change', 'dirty', 'validate', 'grouptoggle', 'beforesubmit', 'submitting', 'success', 'failure', 'invalid', 'reset', 'error'];
  let lastChange = '';
  for (const type of types) {
    listeners[type] = (d) => {
      // Collapse keystroke-by-keystroke changes of the same field into one line.
      if (type === 'change') {
        const name = (d as PixiFormEventMap['change']).name;
        if (name === lastChange && list.firstElementChild) return;
        lastChange = name;
      } else if (type !== 'validate') lastChange = '';
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = type;
      const span = document.createElement('span');
      span.textContent = describe(type, d);
      li.append(b, span);
      list.prepend(li);
      while (list.children.length > 50) list.lastElementChild!.remove();
    };
  }
  return listeners as PixiFormListeners;
}

function press(b: HTMLButtonElement): void {
  b.parentElement!.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
}

function showPayload(body: Record<string, unknown>): void {
  const pretty = JSON.stringify(
    body,
    (_k, v) => (typeof v === 'string' && v.startsWith('pfe1.') ? `${v.slice(0, 48)}…(${v.length} chars)` : v),
    2,
  );
  $('#payload').firstElementChild!.textContent = pretty;
}

function logEvent(list: HTMLElement, e: AnalyticsEvent): void {
  const li = document.createElement('li');
  const type = document.createElement('b');
  type.textContent = e.type;
  const detail = document.createElement('span');
  const bits = [
    e.field,
    e.errorCode && `error: ${e.errorCode}`,
    e.durationMs !== undefined && `${(e.durationMs / 1000).toFixed(1)}s`,
    e.changes && `${e.changes} edits`,
    e.group && e.expanded !== undefined && `${e.group} ${e.expanded ? 'opened' : 'folded'}`,
    e.errorFields?.length && `fields: ${e.errorFields.join(', ')}`,
  ].filter(Boolean);
  detail.textContent = bits.join(' · ');
  li.append(type, detail);
  list.prepend(li);
  while (list.children.length > 40) list.lastElementChild!.remove();
}

// ------------------------------------------------------------------ accessible tabs
function setupTabs(root: ParentNode): void {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>(':scope > [role=tablist] > [role=tab]')];
  const activate = (t: HTMLButtonElement, focus = false) => {
    for (const x of tabs) {
      const on = x === t;
      x.setAttribute('aria-selected', String(on));
      x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')!)!.hidden = !on;
    }
    if (focus) t.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => activate(t));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Home') activate(tabs[0], true);
      else if (e.key === 'End') activate(tabs[tabs.length - 1], true);
      else if (d) activate(tabs[(i + d + tabs.length) % tabs.length], true);
      else return;
      e.preventDefault();
    });
  });
}

function selectTab(id: string): void {
  document.getElementById(id)?.click();
}

setupTabs($('.panels'));
setupTabs($('.code-tabs'));
void hero();
void demo();
