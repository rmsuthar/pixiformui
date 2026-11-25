/**
 * /pro/: the Pro & Cloud waitlist, built with PixiFormUI itself. Submits to the website's Worker
 * (site/worker.ts) with the no-code `action` option: it fetches a signed proof-of-work challenge,
 * solves it while the visitor types, and POSTs the form as JSON.
 */
import { mountPixiForm } from '../../src/lib';

const host = document.getElementById('waitlist')!;
const params = new URLSearchParams(location.search);

const mode = () => (document.documentElement.dataset.theme as 'light' | 'dark' | undefined) ?? 'auto';

void mountPixiForm(host, {
  id: 'pro-waitlist',
  load: 'visible',
  title: 'Join the waitlist',
  subtitle: 'Get early access and early-access pricing.',
  theme: 'indigo',
  mode: mode(),
  maxWidth: 520,
  privacyScreen: false,
  submitText: 'Join the waitlist',
  fields: [
    { type: 'hidden', name: 'source', value: (params.get('utm_source') ?? params.get('ref') ?? 'pro-page').slice(0, 64) },
    { type: 'email', name: 'email', label: 'Work email', required: true, placeholder: 'you@company.com', autocomplete: 'email' },
    { type: 'text', name: 'name', label: 'Name', maxLength: 80, row: 'who', autocomplete: 'name' },
    { type: 'text', name: 'company', label: 'Company', maxLength: 120, row: 'who', autocomplete: 'organization' },
    {
      type: 'select',
      name: 'teamSize',
      label: 'Team size',
      placeholder: 'Choose',
      options: [
        { value: '1', label: 'Just me' },
        { value: '2-10', label: '2–10' },
        { value: '11-50', label: '11–50' },
        { value: '51-200', label: '51–200' },
        { value: '201+', label: '201 or more' },
      ],
    },
    {
      type: 'group',
      title: 'What would you use?',
      description: 'Pick any.',
      variant: 'plain',
      fields: [
        { type: 'checkbox', name: 'interest_cloud', label: 'PixiForm Cloud (hosted, encrypted backend)' },
        { type: 'checkbox', name: 'interest_card', label: 'Secure card field' },
        { type: 'checkbox', name: 'interest_pro', label: 'Pro controls' },
        { type: 'checkbox', name: 'interest_enterprise', label: 'Enterprise support and compliance' },
      ],
    },
    { type: 'textarea', name: 'message', label: 'What would make this worth paying for?', rows: 3, maxLength: 1000 },
    { type: 'checkbox', name: 'consent', label: 'Email me about PixiFormUI Pro and Cloud', required: true, requiredMessage: 'Please agree so we can email you.' },
  ],
  // No submit code: fetch the signed challenge, solve it while the visitor types, POST JSON.
  session: '/api/waitlist/session',
  action: '/api/waitlist',
  form: { once: true },
});
