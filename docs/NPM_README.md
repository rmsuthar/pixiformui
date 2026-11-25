# PixiFormUI

**Secure JavaScript forms rendered on canvas.** Every field is drawn on a `<canvas>`, so what people type lives in
wipeable memory, not in the page DOM. Browser extensions, session-replay scripts and injected code can't read it with
`querySelector`. Passwords leave the browser encrypted.

- 🔐 End-to-end encrypted password fields (ECDH P-256 + AES-256-GCM), with server decryptors for Node, Python, Go, C#, Ruby, PHP and Java
- ⚖️ One set of validation rules for browser, server and AI agents (with JSON Schema)
- ♿ Screen-reader outline, keyboard support, high contrast, forced colors, reduced motion, zoom
- 🎨 Palette theming with presets, light and dark
- 📊 Privacy-safe analytics (GA4, Tag Manager, Segment, PostHog…) and typed lifecycle/form events
- 📱 Mobile keyboards, SMS code autofill, touch scrolling
- 🧩 `<pixi-form>` web component, React and Angular wrappers, or `mountPixiForm()` anywhere
- 📦 ≈__PIXIFORM_SIZE_KB__ KB gzipped, **zero dependencies**, runs under a strict CSP (no `unsafe-eval`, no workers)

**Docs and live demo:** https://pixiformui.lets.gen.in · **Source:** https://github.com/rmsuthar/pixiformui

> **☁️ No server? Use [PixiForm Cloud](https://cloud.pixiformui.lets.gen.in/).** Point a form at your Cloud endpoint and
> skip the backend: submissions are end-to-end encrypted to a key only you hold, with bot protection, webhooks and
> email alerts built in. **Free plan: 100 submissions a month, no card needed.**
> [Start free](https://cloud.pixiformui.lets.gen.in/) · [Pro & Enterprise](https://pixiformui.lets.gen.in/pro/)

## Install

```bash
npm install pixiformui
```

## Quick start

```ts
import { mountPixiForm } from 'pixiformui';

const form = await mountPixiForm(document.getElementById('signup')!, {
  title: 'Create account',
  theme: 'indigo',
  fields: [
    { type: 'text', name: 'name', label: 'Name', required: true },
    { type: 'email', name: 'email', label: 'Email', required: true },
    { type: 'password', name: 'password', label: 'Password', required: true, strengthMeter: true },
    { type: 'checkbox', name: 'terms', label: 'I accept the terms', required: true },
  ],
  action: '/api/register',   // POSTs JSON; password fields are encrypted
  session: '/api/session',   // returns { csrfToken, encryption }
});

form.on('success', (e) => console.log(e.result.message));
```

### Plain HTML

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/pixiformui@0.1.1/pixiformui.standalone.js"></script>
<pixi-form id="contact"></pixi-form>
<script type="module">
  document.getElementById('contact').config = {
    fields: [{ type: 'email', name: 'email', label: 'Email', required: true }],
    onSubmit: async (values) => ({ ok: true, message: 'Thanks!' }),
  };
</script>
```

For production, download the bundle and serve it from your own origin (see the
[install page](https://pixiformui.lets.gen.in/docs/install/) for versioned files and integrity hashes).

## Documentation

- [Developer guide](https://pixiformui.lets.gen.in/docs/guide/): setup, controls, theming, validation, server, accessibility, events
- [Encryption spec (PFE1)](https://pixiformui.lets.gen.in/docs/encryption/)
- [Using it in React, Angular and HTML](https://pixiformui.lets.gen.in/docs/guide/using-pixiform-in-existing-apps-html-react-angular/)

## PixiForm Cloud

The hosted backend for PixiFormUI forms: no server to run, end-to-end encrypted submissions you decrypt in your
browser, signed webhooks, email alerts, CSV export and an embed snippet for any site, WordPress or React/Next.js.

- **Start free:** https://cloud.pixiformui.lets.gen.in (100 submissions a month, no card)
- **Paid plans, secure card field, Pro controls, Enterprise:** https://pixiformui.lets.gen.in/pro/

## Support and contact

- **Questions, integration help, enterprise and compliance:** ravindra.suthar@me.com
- **LinkedIn:** https://www.linkedin.com/in/ravindrasuthar/
- **Bugs and feature requests:** https://github.com/rmsuthar/pixiformui/issues
- **Privacy policy:** https://pixiformui.lets.gen.in/privacy/ · **Terms:** https://pixiformui.lets.gen.in/terms/

## License

MIT
