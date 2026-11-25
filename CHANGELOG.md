# Changelog

## Unreleased

- **Conditional fields:** `showIf` on any field, group, heading or paragraph (`{ field, equals | notEquals | in |
  notIn | gt | gte | lt | lte | empty | filled }`, `all` / `any` / `not`, or a function). Hidden fields aren't
  validated or submitted, leave the screen-reader outline and Tab order, give their space to neighbours (including in
  rows), and keep their value. `handle.setVisible(name, true | false | null)`, `handle.isVisible(name)` (also on
  `<pixi-form>`), and a `fieldvisibility` event. `evaluateCondition()` is exported for servers.
- **Hidden fields:** `{ type: 'hidden', name, value }` (`HiddenField`) submits a value that is never drawn and isn't
  in the page's markup.
- The human-check slider keeps its prompt text clear of the mark.

## 0.1.6

- **Duplicate submissions:** `form.idempotencyKey` (stable across retries of the same values, including re-typed
  passwords) is sent as an `Idempotency-Key` header by the `action` option and by `secureSubmit({ idempotencyKey })`.
  The reference server replays the stored response for a repeated key (rejects reused keys with different data, 422,
  and concurrent duplicates, 409), so a retry after a lost response is processed once.
- New form options `once` (lock after success; `form.unlock()`) and `cooldownMs` (blocked event, code `'cooldown'`).
- **Bot protection:** an invisible proof-of-work "form proof" (`FormProof`, `X-Form-Proof` header) that the browser
  solves while the person types and the server checks with one hash; the `action` option handles it automatically.
  The reference server also refuses registrations sent too soon after the session starts (`MIN_FILL_MS`), and
  supports Cloudflare Turnstile or hCaptcha (`TURNSTILE_SECRET` / `HCAPTCHA_SECRET`, `captcha` option,
  `secureSubmit({ captchaToken })`).
- **Human check slider:** new `humancheck` field (`HumanCheck`): drag the handle onto a randomly placed mark. It accepts
  only trusted events and person-like drags, moves the mark after a miss, pauses after repeated misses, and works with
  the keyboard and screen readers. It runs in the browser only and isn't sent with the form; see the guide's chapter
  29 for what it can and can't stop.
- `Control.submits`: UI-only fields can opt out of `form.values()` and `serialize()`.

## 0.1.5

- **Autofill and password managers (opt-in):** fields accept a standard `autocomplete` token (`email`, `name`,
  `tel`, `current-password`, `new-password`, `username webauthn`…); the phone input takes `autocomplete: true`.
  Suggestions replace the value through the usual sanitising and are cleared from the relay input at once. Fields
  without a token are unchanged.
- **Passkeys (WebAuthn):** `createPasskey()`, `getPasskey()` (including passkey suggestions in a username field via
  conditional mediation), `passkeysSupported()`, `passkeyAutofillAvailable()` and `passkeyErrorMessage()`. The
  reference server verifies registrations and sign-ins with Node's crypto (`server/webauthn.ts`), and the demo has a
  Passkeys card.

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
