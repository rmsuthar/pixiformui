// Runs after the standalone bundle registered <pixi-form>.
await customElements.whenDefined('pixi-form');

const form = document.getElementById('contact');
const status = document.getElementById('status');

form.config = {
  title: 'Contact details',
  subtitle: 'We use these to reach you about your account.',
  theme: 'teal',                       // preset accent; light/dark follows the OS ('mode: auto')
  maxWidth: 480,
  fields: [
    // Groups are fieldsets: a title, optional description, optionally collapsible.
    // Values still submit flat: { firstName, lastName, email, phone, contactTime, paperless, confirm }.
    { type: 'group', title: 'Name', fields: [
      { type: 'text', name: 'firstName', label: 'First name', required: true, maxLength: 40, row: 'name' },
      { type: 'text', name: 'lastName', label: 'Last name', required: true, maxLength: 40, row: 'name' },
    ] },
    { type: 'group', title: 'How to reach you', description: 'Email is required; mobile is optional.', fields: [
      { type: 'email', name: 'email', label: 'Email', required: true, placeholder: 'you@example.com',
        info: 'Statements and security alerts are sent here.' },
      { type: 'tel', name: 'phone', label: 'Mobile', placeholder: '+91 98765 43210',
        info: 'Used for one-time codes when you sign in from a new device.' },
    ] },
    { type: 'group', name: 'prefs', title: 'Preferences', collapsible: true, collapsed: true, fields: [
      { type: 'select', name: 'contactTime', label: 'Best time to call', placeholder: 'Any time',
        options: [{ value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }, { value: 'evening', label: 'Evening' }] },
      { type: 'switch', name: 'paperless', label: 'Paperless statements', value: true },
    ] },
    { type: 'checkbox', name: 'confirm', label: 'I confirm these details are correct', required: true,
      requiredMessage: 'Please confirm your details.' },
  ],
  // Accessibility: system settings (high contrast, reduced motion, zoom) are followed automatically.
  a11y: { label: 'Contact details' },
  // Analytics: metadata-only events. With no onEvent, they arrive as 'pixiform-analytics' DOM events (below).
  analytics: { formId: 'contact-details' },
  submitText: 'Save details',
  resetText: 'Reset',
  // No onSubmit here: the element dispatches 'pixiform-submit' instead (see below).
};

// Answer submissions with your own API call.
form.addEventListener('pixiform-submit', (e) => {
  e.detail.respondWith(
    (async () => {
      // await fetch('/api/contact', { method: 'POST', ... })  // your endpoint
      await new Promise((r) => setTimeout(r, 600));
      return { ok: true, message: 'Contact details saved.' };
    })(),
  );
});

form.addEventListener('pixiform-change', (e) => {
  status.textContent = `Last edited: ${e.detail.name}`;   // field names only, never values
});
form.addEventListener('pixiform-success', () => (status.textContent = 'Saved ✓'));
form.addEventListener('pixiform-invalid', (e) => (status.textContent = `${Object.keys(e.detail.errors).length} field(s) need attention`));

// Forward analytics to Google Tag Manager (or any tool). Events never contain values.
form.addEventListener('pixiform-analytics', (e) => {
  (window.dataLayer ??= []).push({ event: `pixiform_${e.detail.type}`, pixiform: e.detail });
});
