/**
 * The sign-up form in the "Try it" demo: everything that builds it, in one file.
 * The home page runs this file and shows it, read-only, in the demo's Source tab.
 *
 * The page passes in `hooks` only to fill its side panels (events, analytics and the payload).
 */
import { mountPixiForm, type EncryptionKey, type FieldConfig, type PixiFormConfig, type PixiFormHandle, type SubmitResult } from '../src/lib';

/** Business rule, checked on submit (in a real app, ask your server): names nobody may take. */
const RESERVED_USERNAMES = new Set(['admin', 'root', 'support', 'help', 'pixiform']);

export const demoFields: FieldConfig[] = [
  {
    type: 'group',
    title: 'Account',
    description: 'How you sign in.',
    fields: [
      { type: 'text', name: 'fullName', label: 'Full name', placeholder: 'Ada Lovelace', required: true, maxLength: 80, row: 'n' },
      {
        type: 'text',
        name: 'username',
        label: 'Username',
        placeholder: 'ada_l',
        required: true,
        maxLength: 24,
        row: 'n',
        info: 'Lowercase letters, digits and _, no spaces. Try “ada l” or “admin” to see custom errors.',
        // Several checks on one value: they run in order and the first failing one shows its message.
        validators: [
          (v) => (/\s/.test(String(v)) ? 'Usernames can’t contain spaces. Try ada_l instead of ada l.' : null),
          (v) => (String(v).length >= 3 ? null : 'Use at least 3 characters.'),
          (v) => (/^[a-z]/.test(String(v)) ? null : 'Start with a lowercase letter.'),
          (v) => (/^[a-z0-9_]+$/.test(String(v)) ? null : 'Use only lowercase letters, digits and _.'),
        ],
      },
      { type: 'email', name: 'email', label: 'Email', placeholder: 'you@example.com', required: true },
      { type: 'password', name: 'password', label: 'Password', placeholder: 'At least 12 characters', required: true, strengthMeter: true, info: 'Encrypted in your browser before it would be sent.' },
    ],
  },
  {
    type: 'group',
    title: 'About you',
    fields: [
      { type: 'phone', name: 'phone', label: 'Mobile', defaultCountry: 'IN', preferredCountries: ['IN', 'US', 'GB', 'AE', 'SG'], row: 'p' },
      { type: 'date', name: 'dateOfBirth', label: 'Date of birth', max: 'today', placeholder: 'Pick a date', row: 'p' },
    ],
  },
  {
    type: 'group',
    name: 'preferences',
    title: 'Preferences',
    description: 'Optional. Folded to show collapsible groups.',
    collapsible: true,
    collapsed: true,
    fields: [
      {
        type: 'radio',
        name: 'plan',
        label: 'Plan',
        value: 'free',
        direction: 'horizontal',
        options: [
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro' },
          { value: 'team', label: 'Team' },
        ],
      },
      { type: 'slider', name: 'experience', label: 'Years of experience', min: 0, max: 40, value: 3 },
      { type: 'switch', name: 'newsletter', label: 'Product updates' },
    ],
  },
  { type: 'checkbox', name: 'terms', label: 'I accept the terms (demo)', required: true, requiredMessage: 'Please accept the terms.' },
  // Slide-to-the-mark human check: the mark is random and drawn only on the canvas; not sent with the form.
  { type: 'humancheck', name: 'human', label: 'Quick check', info: 'Drag the handle onto the mark. Keyboard: arrow keys, then Enter.' },
];

/** Rules that need the whole form (or a server): each message appears on its field, the first gets focus. */
export function businessRules(values: Record<string, unknown>): SubmitResult | null {
  const username = String(values.username ?? '');
  if (RESERVED_USERNAMES.has(username)) {
    return { ok: false, message: 'Please choose another username.', fieldErrors: { username: `“${username}” is reserved. Please choose another username.` } };
  }
  return null;
}

export interface DemoHooks {
  /** The server's public key: secret fields are encrypted to it in the browser. */
  encryptionKey: EncryptionKey;
  theme: PixiFormConfig['theme'];
  mode: PixiFormConfig['mode'];
  on: PixiFormConfig['on'];
  onAnalytics: NonNullable<PixiFormConfig['analytics']>['onEvent'];
  /** Receives the JSON body a real app would POST to its server. */
  onPayload: (body: Record<string, unknown>) => void;
}

export function mountDemoForm(host: HTMLElement, hooks: DemoHooks): Promise<PixiFormHandle> {
  return mountPixiForm(host, {
    id: 'demo-signup',
    load: 'visible', // built when scrolled near; the host shows a placeholder until then
    on: hooks.on,
    title: 'Create your account',
    subtitle: 'Rendered on canvas. Nothing leaves this page.',
    theme: hooks.theme,
    mode: hooks.mode,
    maxWidth: 640,
    privacyScreen: true,
    fields: demoFields,
    submitText: 'Create account',
    resetText: 'Reset',
    analytics: { formId: 'demo-signup', onEvent: hooks.onAnalytics },
    onSubmit: async (values, form) => {
      const refused = businessRules(values);
      if (refused) return refused;
      // Secret fields become pfe1.… envelopes that only the server's private key can open.
      const body = await form.serialize({ encryptionKey: hooks.encryptionKey });
      hooks.onPayload(body); // a real app: await fetch('/api/signup', { method: 'POST', body: JSON.stringify(body) })
      return { ok: true, message: 'Demo: nothing was sent. See what your server would receive.' };
    },
  });
}
