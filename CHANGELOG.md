# Changelog

## 0.1.4

- **Fix: submitting failed in Safari and Firefox (403).** `secureSubmit` used `referrerPolicy: 'no-referrer'`, which
  makes Safari and Firefox send `Origin: null` on same-origin POSTs (per the Fetch spec), so servers checking the origin
  rejected them. It now uses `'strict-origin'` (real Origin header; Referer is the origin only, never the path). The
  reference server also accepts a null origin when the browser marks the request `Sec-Fetch-Site: same-origin`.
- Browser tests now run in Chromium, WebKit (Safari) and Firefox; CI checks bundle size budgets.

## 0.1.3

- Mobile: dragging inside an open dropdown now scrolls the list instead of the page, and swiping left/right on the
  calendar moves to the next/previous month (or year page). Dragging elsewhere on the form still scrolls the page.

## 0.1.2

- Tall forms in `layout: 'auto'`: the canvas stays at most about two screens tall and follows the page scroll, so forms
  of any length stay within mobile canvas limits (iOS Safari) and memory stays flat. Off-screen controls are skipped
  when drawing.
- Toasts appear in the visible part of the form; the keyboard relay input is anchored to the canvas.
- `<pixi-form>` element methods: `values()`, `setValues()`, `get(name)`, `submit()` and `reset()`, so plain-HTML pages
  can read and fill the form without the handle. Secret fields are never set by `setValues()`.
- Project: browser test suite (Playwright) and CI on every push, `SECURITY.md` with private vulnerability reporting,
  and a release workflow that publishes to npm with provenance.

## 0.1.1

- Package metadata: GitHub repository and issue links, updated contact email. No code changes.

## 0.1.0 (first public release)

- Canvas 2D renderer with zero dependencies; values never enter the DOM.
- Controls: text, textarea, password (strength meter), OTP, date/time picker, phone with country code, checkbox, switch, radio, select, slider, button.
- FieldGroup sections (collapsible, error badges), Column/Row/ScrollView layout.
- PFE1 encrypted password fields with decryptors for Node, Python, Go, C#, Ruby, PHP and Java.
- Shared validation rules (browser, server, agents) and JSON Schema generation.
- Accessibility outline, linked errors, forced colors, high contrast, reduced motion, zoom, text scale.
- Palette theming and presets; privacy screen; bot guard and rate limiting.
- Privacy-safe analytics with adapters; typed lifecycle and form events; lazy loading.
- `mountPixiForm()`, `<pixi-form>` web component, React and Angular wrappers; `serialize()`, `setValues()`, no-code `action`.
- MCP server for AI-assisted registration with a secure handoff.
