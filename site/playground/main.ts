/**
 * PixiFormUI playground: edit a JSON config, see the canvas form rebuild live,
 * inspect the encrypted payload and events, copy code, share a link.
 *
 * Only JSON is accepted (no JavaScript): the site's CSP forbids eval, and it keeps
 * shared links safe to open. Callbacks (onSubmit, events) are supplied by the page.
 */
import {
  b64uDecode,
  b64uEncode,
  mountPixiForm,
  type EncryptionKey,
  type PixiFormConfig,
  type PixiFormEventType,
  type PixiFormHandle,
  type PixiFormListeners,
} from '../../src/lib';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const editor = $<HTMLTextAreaElement>('#editor');
const status = $('#editor-status');
const preview = $('#preview');
const meta = $('#preview-meta');
const version = ($('#main').dataset.version ?? '').replace('__PIXIFORM_VERSION__', '') || 'latest';
const MAX_CONFIG = 50_000;

// ------------------------------------------------------------------ presets
const PRESETS: Record<string, { label: string; config: Record<string, unknown> }> = {
  signup: {
    label: 'Sign-up with groups',
    config: {
      title: 'Create your account',
      subtitle: 'Rendered on canvas. Values never enter the page.',
      theme: 'indigo',
      submitText: 'Create account',
      fields: [
        {
          type: 'group',
          title: 'Account',
          fields: [
            { type: 'text', name: 'fullName', label: 'Full name', required: true, row: 'n' },
            { type: 'text', name: 'username', label: 'Username', required: true, row: 'n', info: 'Lowercase letters, digits and _.' },
            { type: 'email', name: 'email', label: 'Email', required: true, placeholder: 'you@example.com' },
            { type: 'password', name: 'password', label: 'Password', required: true, strengthMeter: true },
          ],
        },
        {
          type: 'group',
          title: 'Preferences',
          collapsible: true,
          collapsed: true,
          fields: [
            { type: 'radio', name: 'plan', label: 'Plan', value: 'free', direction: 'horizontal', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'team', label: 'Team' }] },
            { type: 'switch', name: 'newsletter', label: 'Product updates' },
          ],
        },
        { type: 'checkbox', name: 'terms', label: 'I accept the terms', required: true },
        { type: 'humancheck', name: 'human', label: 'Quick check' },
      ],
    },
  },
  login: {
    label: 'Sign-in',
    config: {
      title: 'Welcome back',
      theme: 'teal',
      maxWidth: 420,
      submitText: 'Sign in',
      fields: [
        { type: 'email', name: 'email', label: 'Email', required: true, placeholder: 'you@example.com' },
        { type: 'password', name: 'password', label: 'Password', required: true },
        { type: 'switch', name: 'remember', label: 'Keep me signed in' },
      ],
    },
  },
  contact: {
    label: 'Contact form',
    config: {
      title: 'Contact us',
      theme: 'violet',
      submitText: 'Send message',
      resetText: 'Clear',
      fields: [
        { type: 'text', name: 'name', label: 'Name', required: true, row: 'a' },
        { type: 'email', name: 'email', label: 'Email', required: true, row: 'a' },
        { type: 'phone', name: 'mobile', label: 'Mobile', defaultCountry: 'IN' },
        { type: 'select', name: 'topic', label: 'Topic', placeholder: 'Choose a topic', options: [{ value: 'sales', label: 'Sales' }, { value: 'support', label: 'Support' }, { value: 'other', label: 'Something else' }] },
        { type: 'textarea', name: 'message', label: 'Message', required: true, rows: 4, maxLength: 1000 },
      ],
    },
  },
  booking: {
    label: 'Booking (date & time)',
    config: {
      title: 'Book a call',
      theme: 'amber',
      submitText: 'Book',
      fields: [
        { type: 'date', name: 'when', label: 'Date and time', required: true, min: 'today', time: { step: 30, defaultTime: '10:00' } },
        { type: 'slider', name: 'duration', label: 'Duration (minutes)', min: 15, max: 90, step: 15, value: 30 },
        { type: 'radio', name: 'channel', label: 'Channel', value: 'video', direction: 'horizontal', options: [{ value: 'video', label: 'Video' }, { value: 'phone', label: 'Phone' }] },
      ],
    },
  },
  humancheck: {
    label: 'Human check (bot protection)',
    config: {
      title: 'Join the waitlist',
      subtitle: 'Slide the handle onto the mark. It moves after a miss.',
      theme: 'slate',
      maxWidth: 480,
      submitText: 'Join',
      fields: [
        { type: 'email', name: 'email', label: 'Email', required: true, placeholder: 'you@example.com' },
        { type: 'humancheck', name: 'human', label: 'Quick check', prompt: 'Slide to the mark', maxAttempts: 3, cooldownMs: 15000 },
      ],
    },
  },
  otp: {
    label: 'One-time code',
    config: {
      title: 'Verify it’s you',
      subtitle: 'Enter the 6-digit code we sent you.',
      theme: 'rose',
      maxWidth: 440,
      submitText: 'Verify',
      fields: [{ type: 'otp', name: 'code', label: 'Verification code', length: 6, groupSize: 3, required: true }],
    },
  },
};

const presetSelect = $<HTMLSelectElement>('#preset');
for (const [key, p] of Object.entries(PRESETS)) presetSelect.append(new Option(p.label, key));
presetSelect.append(new Option('Custom (edited)', 'custom'));

// ------------------------------------------------------------------ demo encryption key
let key: EncryptionKey | null = null;
async function demoKey(): Promise<EncryptionKey> {
  if (key) return key;
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const kid = b64uEncode(new Uint8Array(await crypto.subtle.digest('SHA-256', spki))).slice(0, 16);
  key = { alg: 'PFE1', kid, spki: b64uEncode(spki), challenge: b64uEncode(crypto.getRandomValues(new Uint8Array(16))) };
  return key;
}

// ------------------------------------------------------------------ live preview
let handle: PixiFormHandle | null = null;
let generation = 0;
let lastText = '';
let current: Record<string, unknown> = {};

function setStatus(message: string, kind: 'ok' | 'error'): void {
  status.textContent = message;
  status.dataset.kind = kind;
}

function parseConfig(text: string): Record<string, unknown> {
  if (text.length > MAX_CONFIG) throw new Error(`Config is too large (${text.length} characters, limit ${MAX_CONFIG}).`);
  const value = JSON.parse(text) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The config must be a JSON object: { "fields": [ … ] }');
  const cfg = value as Record<string, unknown>;
  if (!Array.isArray(cfg.fields) || cfg.fields.length === 0) throw new Error('Add at least one entry to "fields".');
  // Callbacks are supplied by the playground; JSON can't carry them anyway.
  for (const k of ['onSubmit', 'on', 'action', 'session', 'analytics']) delete cfg[k];
  return cfg;
}

async function rebuild(): Promise<void> {
  const text = editor.value;
  if (text === lastText) return;
  lastText = text;
  let cfg: Record<string, unknown>;
  try {
    cfg = parseConfig(text);
  } catch (e) {
    setStatus(`⚠ ${(e as Error).message}`, 'error');
    return;
  }
  current = cfg;
  renderCode();
  const gen = ++generation;
  const k = await demoKey();
  handle?.destroy();
  handle = null;
  preview.replaceChildren();
  try {
    const started = performance.now();
    const h = await mountPixiForm(preview, {
      ...(cfg as unknown as PixiFormConfig),
      layout: 'auto',
      privacyScreen: false,
      on: eventLog(),
      onSubmit: async (_values, form) => {
        const body = await form.serialize({ encryptionKey: k });
        k.challenge = b64uEncode(crypto.getRandomValues(new Uint8Array(16)));
        $('#payload').textContent = JSON.stringify(body, (_k, v) => (typeof v === 'string' && v.startsWith('pfe1.') ? `${v.slice(0, 44)}…(${v.length} chars)` : v), 2);
        $<HTMLButtonElement>('#tab-payload').click();
        return { ok: true, message: 'Submitted (nothing left this page).' };
      },
    });
    if (gen !== generation) return h.destroy();
    handle = h;
    const fields = Object.keys(h.controls).length;
    meta.textContent = `${fields} field${fields === 1 ? '' : 's'} · built in ${Math.round(performance.now() - started)} ms`;
    setStatus('✓ Valid config', 'ok');
  } catch (e) {
    if (gen !== generation) return;
    setStatus(`⚠ ${(e as Error).message.replace(/^mountPixiForm: /, '')}`, 'error');
  }
}

let timer = 0;
editor.addEventListener('input', () => {
  presetSelect.value = 'custom';
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void rebuild(), 450);
});
// Tab inserts two spaces (Escape, then Tab, still moves focus out of the editor).
let escaped = false;
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') escaped = true;
  else if (e.key === 'Tab' && !escaped && !e.shiftKey) {
    e.preventDefault();
    const { selectionStart: s, selectionEnd: end } = editor;
    editor.setRangeText('  ', s, end, 'end');
    editor.dispatchEvent(new Event('input'));
  } else if (e.key !== 'Tab') escaped = false;
});

function load(cfg: Record<string, unknown>): void {
  editor.value = JSON.stringify(cfg, null, 2);
  lastText = '';
  void rebuild();
}

presetSelect.addEventListener('change', () => {
  const p = PRESETS[presetSelect.value];
  if (p) load(structuredClone(p.config));
});
$('#format').addEventListener('click', () => {
  try {
    editor.value = JSON.stringify(JSON.parse(editor.value), null, 2);
  } catch (e) {
    setStatus(`⚠ ${(e as Error).message}`, 'error');
  }
});

// ------------------------------------------------------------------ events panel
function eventLog(): PixiFormListeners {
  const list = $('#events');
  list.replaceChildren();
  const types: PixiFormEventType[] = ['load', 'focus', 'blur', 'change', 'dirty', 'validate', 'grouptoggle', 'beforesubmit', 'submitting', 'success', 'invalid', 'blocked', 'reset', 'error'];
  const out: Record<string, (d: any) => void> = {};
  let lastChange = '';
  for (const t of types) {
    out[t] = (d) => {
      if (t === 'change') {
        if (d.name === lastChange && list.firstElementChild) return;
        lastChange = d.name;
      } else if (t !== 'validate') lastChange = '';
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = t;
      const span = document.createElement('span');
      span.textContent =
        t === 'load' ? `${d.ms} ms · ${d.fields} fields`
        : t === 'validate' ? `${d.name} · ${d.error ? `error (${d.code})` : 'ok'}`
        : t === 'invalid' ? Object.keys(d.errors).join(', ')
        : t === 'grouptoggle' ? `${d.group} · ${d.expanded ? 'opened' : 'folded'}`
        : t === 'error' ? `${d.phase}: ${d.error.message}`
        : t === 'blocked' ? `${d.code}: ${d.reason}`
        : (d?.name ?? '');
      li.append(b, span);
      list.prepend(li);
      while (list.children.length > 60) list.lastElementChild!.remove();
    };
  }
  return out as PixiFormListeners;
}

// ------------------------------------------------------------------ code panel
let codeFormat: 'html' | 'js' = 'html';
function indent(text: string, by: string): string {
  return text.split('\n').map((l, i) => (i ? by + l : l)).join('\n');
}
function renderCode(): void {
  const json = JSON.stringify(current, null, 2);
  const cfg = indent(json.replace(/\n}$/, ',\n  onSubmit: async (values) => ({ ok: true, message: "Thanks!" }),\n}'), '  ');
  const code =
    codeFormat === 'html'
      ? `<script type="module" src="https://cdn.jsdelivr.net/npm/pixiformui@${version}/pixiformui.standalone.js"></script>\n\n<pixi-form id="my-form"></pixi-form>\n\n<script type="module">\n  document.getElementById('my-form').config = ${indent(cfg, '  ')};\n</script>`
      : `// npm install pixiformui\nimport { mountPixiForm } from 'pixiformui';\n\nconst form = await mountPixiForm(document.getElementById('my-form'), ${cfg});`;
  $('#code').textContent = code;
}
document.querySelectorAll<HTMLButtonElement>('[data-code]').forEach((b) =>
  b.addEventListener('click', () => {
    codeFormat = b.dataset.code as 'html' | 'js';
    document.querySelectorAll('[data-code]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderCode();
  }),
);
async function copy(text: string, button: HTMLElement, done: string): Promise<void> {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = done;
  } catch {
    button.textContent = 'Copy failed';
  }
  setTimeout(() => (button.textContent = original), 1600);
}
$('#copy-code').addEventListener('click', (e) => void copy($('#code').textContent ?? '', e.currentTarget as HTMLElement, 'Copied ✓'));

// ------------------------------------------------------------------ share links (#c=…)
async function pack(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'undefined') return 'j' + b64uEncode(bytes);
  const compressed = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
  return 'z' + b64uEncode(new Uint8Array(compressed));
}
async function unpack(s: string): Promise<string> {
  const bytes = b64uDecode(s.slice(1));
  if (s[0] === 'j') return new TextDecoder().decode(bytes);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}
$('#share').addEventListener('click', async (e) => {
  const button = e.currentTarget as HTMLElement;
  try {
    const cfg = parseConfig(editor.value);
    const url = `${location.origin}${location.pathname}#c=${await pack(JSON.stringify(cfg))}`;
    history.replaceState(null, '', url);
    await copy(url, button, 'Link copied ✓');
  } catch (err) {
    setStatus(`⚠ ${(err as Error).message}`, 'error');
  }
});

// ------------------------------------------------------------------ tabs (same pattern as the home page)
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
      if (!d) return;
      e.preventDefault();
      activate(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });
}
setupTabs($('.pg-panels'));

// ------------------------------------------------------------------ start
(async () => {
  const shared = /^#c=([jz][A-Za-z0-9_-]+)$/.exec(location.hash)?.[1];
  if (shared && shared.length < MAX_CONFIG * 2) {
    try {
      const text = await unpack(shared);
      presetSelect.value = 'custom';
      load(parseConfig(text));
      setStatus('✓ Loaded the shared config', 'ok');
      return;
    } catch {
      setStatus('⚠ The shared link is invalid; showing a preset instead.', 'error');
    }
  }
  presetSelect.value = 'signup';
  load(structuredClone(PRESETS.signup.config));
})();
