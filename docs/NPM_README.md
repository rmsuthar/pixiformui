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
- 📦 ≈57 KB gzipped, **zero dependencies**, runs under a strict CSP (no `unsafe-eval`, no workers)

**Docs and live demo:** https://pixiformui.lets.gen.in · **Source:** https://github.com/rmsuthar/pixiformui

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

## Contact

ravindra.suthar@me.com · [LinkedIn](https://www.linkedin.com/in/ravindrasuthar/)

## License

MIT
