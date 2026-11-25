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
  title: 'Get early access to paid plans',
  subtitle: 'Tell us what you need: it decides what we build first. Only email is required.',
  theme: 'indigo',
  mode: mode(),
  maxWidth: 520,
  privacyScreen: false,
  submitText: 'Get early access',
  fields: [
    { type: 'hidden', name: 'source', value: (params.get('utm_source') ?? params.get('ref') ?? 'pro-page').slice(0, 64) },
    { type: 'email', name: 'email', label: 'Work email', required: true, placeholder: 'you@company.com', autocomplete: 'email' },
    { type: 'text', name: 'name', label: 'Name', maxLength: 80, row: 'who', autocomplete: 'name' },
    { type: 'text', name: 'company', label: 'Company', maxLength: 120, row: 'who', autocomplete: 'organization' },
    { type: 'url', name: 'website', label: 'Website', maxLength: 200, placeholder: 'example.com', autocomplete: 'url' },
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
      type: 'select',
      name: 'useCase',
      label: 'What kind of form?',
      placeholder: 'Choose',
      row: 'need',
      options: ['Contact or lead form', 'Sign-up or login', 'Payments or checkout', 'Health, legal or financial data', 'Something else'].map((v) => ({ value: v, label: v })),
    },
    {
      type: 'select',
      name: 'volume',
      label: 'Submissions a month',
      placeholder: 'Choose',
      row: 'need',
      options: ['Under 100', '100–1,000', '1,000–10,000', 'Over 10,000'].map((v) => ({ value: v, label: v })),
    },
    {
      type: 'select',
      name: 'current',
      label: 'What do you use today?',
      placeholder: 'Choose',
      row: 'now',
      options: ['My own backend', 'A form service (Formspree, Typeform, Google Forms…)', 'Nothing yet', 'Something else'].map((v) => ({ value: v, label: v })),
    },
    {
      type: 'select',
      name: 'timeline',
      label: 'When do you need it?',
      placeholder: 'Choose',
      row: 'now',
      options: ['Right away', 'Within a month', 'Within 3 months', 'Just exploring'].map((v) => ({ value: v, label: v })),
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
