// The form's fields, shared by the browser (src/form.ts) and the server (server/validate.mjs),
// so both apply the same rules: required fields, lengths, choices and showIf conditions.
// Plain data: no functions here (the server reads it too).

/** @type {import('pixiformui').FieldConfig[]} */
export const fields = [
  // Sent with the form, never shown (e.g. where the visitor came from).
  { type: 'hidden', name: 'source', value: 'starter' },
  {
    type: 'group',
    name: 'account',
    title: 'Account',
    description: 'How you sign in.',
    fields: [
      { type: 'text', name: 'fullName', label: 'Full name', required: true, maxLength: 80, placeholder: 'Ada Lovelace' },
      { type: 'email', name: 'email', label: 'Email', required: true, placeholder: 'you@example.com', autocomplete: 'email' },
      { type: 'password', name: 'password', label: 'Password', required: true, strengthMeter: true, row: 'pw', autocomplete: 'new-password' },
      { type: 'password', name: 'confirmPassword', label: 'Confirm password', required: true, row: 'pw', autocomplete: 'new-password' },
    ],
  },
  {
    type: 'radio',
    name: 'contact',
    label: 'Contact me by',
    value: 'email',
    direction: 'horizontal',
    options: [
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Phone' },
    ],
  },
  // Shown (and required) only when "Phone" is picked.
  { type: 'phone', name: 'phone', label: 'Mobile', required: true, defaultCountry: 'IN', showIf: { field: 'contact', equals: 'phone' } },
  { type: 'switch', name: 'business', label: 'Signing up for a business' },
  // A whole group can be conditional: its fields are hidden, unvalidated and unsent with it.
  {
    type: 'group',
    name: 'company',
    title: 'Company',
    showIf: { field: 'business', equals: true },
    fields: [
      { type: 'text', name: 'companyName', label: 'Company name', required: true, maxLength: 120, row: 'co' },
      {
        type: 'select',
        name: 'teamSize',
        label: 'Team size',
        placeholder: 'Choose',
        row: 'co',
        options: [
          { value: '1-10', label: '1–10' },
          { value: '11-50', label: '11–50' },
          { value: '51+', label: '51 or more' },
        ],
      },
      // Conditions chain: shown once a company name is filled in.
      { type: 'text', name: 'vat', label: 'VAT / GST number', maxLength: 30, showIf: { field: 'companyName', filled: true } },
    ],
  },
  { type: 'checkbox', name: 'terms', label: 'I agree to the terms', required: true, requiredMessage: 'Please accept the terms.' },
  // Slide-to-the-mark check (browser only; the server relies on the proof-of-work).
  { type: 'humancheck', name: 'human', label: 'Quick check' },
];

/** Minimum password length, checked in the browser and again on the server after decryption. */
export const MIN_PASSWORD = 12;
