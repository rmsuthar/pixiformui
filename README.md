# PixiFormUI

Secure, fully themeable form controls drawn on **Canvas 2D** with no runtime dependencies. Like a Flutter web app, every control is
painted on a `<canvas>`, so **field values never exist in the page DOM**. Browser extensions, DOM scrapers
and injected scripts can't read them with `querySelector`.

```bash
npm install pixiformui
```

Docs, live demo and downloads: **https://pixiformui.lets.gen.in** · Source: **https://github.com/rmsuthar/pixiformui** · MIT licence

- Controls: `TextInput`, `TextArea`, `PasswordInput`, `OtpInput`, `DatePicker` (calendar, optional time), `PhoneInput` (country code, E.164), `Checkbox`, `Switch`, `RadioGroup`, `Select`, `Slider`, `Button`, each with an optional ⓘ `info` tooltip
- Palette theming: `createFormTheme({ theme, text, accent })` derives every token; six presets; WCAG contrast checks
- Widgets: `Label`, `StrengthMeter`, `Toast`, `PrivacyScreen`; layout: `Column`, `Row`, `ScrollView`, `FieldGroup` (titled, collapsible sections)
- `Form`: validation, autovalidate modes, bot heuristics, rate limiting, idle wipe of secrets
- Accessibility: hidden DOM outline for screen readers (groups, roles, states, linked errors; never values), Windows High Contrast with system colours, more-contrast and reduced-motion support, sharp at any zoom, `textScale`
- Analytics: `FormAnalytics` emits metadata-only events (views, starts, field time, error codes, outcomes, abandonment) with consent gating and adapters for GA4, Tag Manager, Segment, PostHog, Plausible or your own endpoint
- Data: `form.serialize({ encryptionKey })` (JSON, passwords encrypted), `form.setValues(record)` (never secrets), no-code AJAX with `action` + `session`, `rulesToJsonSchema()` from the shared rules
- MCP: `npm run mcp` starts an MCP server whose tools let an AI assistant validate and prefill a registration; the person finishes it (password, terms) in the secure form via a single-use link
- Events: typed lifecycle and form events (`load`, `change`, `dirty`, `beforesubmit` (cancelable), `success`…) via `config.on`, `handle.on()` or `pixiform-*` DOM events; `load: 'visible' | 'idle'` lazy mounting with a `data-pixiform-state` attribute for placeholders
- Shared rules (`shared/rules.ts`) used by **both** the browser and the bundled Node server

> 📘 **Full documentation:** [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) covers setup, every control, theming, extending, rules, server, encryption, mobile, testing and deployment. The encryption protocol spec is in [docs/ENCRYPTION.md](docs/ENCRYPTION.md).

---

## 1. Run it

Requires **Node ≥ 22.6**. The server runs TypeScript directly with type stripping.

```bash
npm install
npm run dev      # Vite dev server + API with hot reload -> http://localhost:8787
npm run serve    # production build + hardened static server + API
npm run typecheck
npm test         # unit tests for the security core
npm run test:pfe # cross-language encryption conformance (Node, Python, Go, C#, Ruby, PHP, Java)
```

| Env var          | Default     | Purpose                                                      |
| ---------------- | ----------- | ------------------------------------------------------------ |
| `PORT`           | `8787`      | Port                                                         |
| `HOST`           | `127.0.0.1` | Bind address (localhost only by default)                     |
| `SESSION_SECRET` | random      | HMAC key for CSRF tokens. Set it in production.              |
| `HTTPS`          | unset       | `1` adds `Secure` to the session cookie (behind a TLS proxy) |
| `PFE_KEY_FILE`   | `.keys/pfe-current.pem` | P-256 private key for encrypted password fields (auto-generated in dev) |
| `PFE_RETIRED_KEY_FILES` | unset | Comma-separated old keys still accepted during rotation |
| `PFE_REQUIRE_KEY` | unset | `1` refuses to start without `PFE_KEY_FILE` |
| `PASSWORD_PEPPER` | `.keys/pepper` | Base64 HMAC key mixed into every password before hashing |

## Use it in your app (HTML, React, Angular, …)

```bash
npm run build:lib    # dist-lib/: pixiformui.js (ESM), pixiformui.standalone.js (minified, ≈50 KB gzip), types
```

```html
<!-- Plain HTML: no build tools -->
<script type="module" src="/vendor/pixiformui.standalone.js"></script>
<pixi-form id="signup"></pixi-form>
<script type="module" src="/js/signup.js"></script>   <!-- el.config = { fields: [...], onSubmit } -->
```

```tsx
// React: copy examples/react/src/PixiForm.tsx
<PixiForm config={config} theme="teal" onReady={(h) => (handle.current = h)} />
```

```html
<!-- Angular: copy examples/angular/src/app/pixi-form.component.ts -->
<pixi-form [config]="config" [theme]="accent()" (success)="saved($event)"></pixi-form>
```

Forms are described as data (`fields: [{ type: 'email', name: 'email', label: 'Email', required: true }, …]`).
They size themselves to their content, so the host page scrolls normally, including on phones. Full details are in
[Developer Guide §23](docs/DEVELOPER_GUIDE.md#23-using-pixiform-in-existing-apps-html-react-angular-).

## 2. Project layout

```
shared/rules.ts          Declarative field rules + validators (browser AND server)
server/server.ts         Zero-dependency Node server: API, CSRF, rate limits, CSP, static files
src/lib/                 The library (import from 'src/lib')
  theme.ts               Design tokens, light/dark themes, createTheme, themeFromSeed
  core/                  FormUI runtime, focus manager, keyboard proxy, base Control
  controls/              All controls
  security/              SecureBuffer, Secret, sanitize, formatters, rate limiter, bot guard, secureSubmit
  Form.ts layout.ts widgets.ts rules.ts
src/demo/main.ts         The sample registration form
src/examples/StarRating.ts  How to write your own control
src/examples/SearchInput.ts How to customise a built-in control
examples/html/           Embed in an existing HTML page (<pixi-form>)
examples/react/          React app + PixiForm.tsx wrapper
examples/angular/        Angular PixiFormComponent + usage
tests/                   Unit tests (npm test)
docs/                    Developer guide + encryption spec
```

## 3. Minimal usage

```ts
import { Application, FormUI, Form, Column, ScrollView, TextInput, PasswordInput, Button, lightTheme, secureSubmit, sealSecret, type Secret } from './lib';

const session = await (await fetch('/api/session')).json();   // { csrfToken, encryption }

const app = new Application();
await app.init({ resizeTo: host, antialias: true, autoDensity: true, resolution: Math.min(devicePixelRatio, 2) });
host.appendChild(app.canvas);

const ui = new FormUI(app, { theme: lightTheme, host });
app.stage.addChild(ui);

const email = new TextInput(ui, { name: 'email', label: 'Email', required: true, inputMode: 'email' });
const pass  = new PasswordInput(ui, { name: 'password', label: 'Password', required: true });
const login = new Button(ui, { name: 'login', text: 'Sign in' });

const form = new Form(ui, {
  onSubmit: async (v) => {
    // Secrets are opaque `Secret` handles. sealSecret() encrypts straight from wipeable
    // memory with the server's public key; no plaintext string is ever created.
    const password = await sealSecret(v.password as Secret, session.encryption, 'password');
    const res = await secureSubmit('/api/login', { email: v.email, password }, { csrfToken: session.csrfToken });
    return { ok: res.ok, ...(await res.json()) };   // { ok, message?, fieldErrors? }
  },
});
form.add(email, pass).bindSubmit(login);

const view = new ScrollView(ui, new Column([email, pass, login], 20));
ui.content.addChild(view);
const fit = () => view.setViewport(app.screen.width, app.screen.height);
app.renderer.on('resize', fit); fit();
```

Every control emits `change`, `focus`, `blur` and `validate`. Text fields also emit `input` and `submit` (Enter).

## 4. Styling

Styling is done with **theme tokens**, not CSS. There are four levels, from global to local:

**a) Pick or derive a theme.** The palette API is usually all you need:

```ts
import { createFormTheme, presetTheme } from './lib';

new FormUI(app, { theme: createFormTheme({
  theme:  { background: 0xf5f7fb, surface: 0xffffff, border: 0xd0d7e2 },   // theme colours
  text:   { primary: 0x0f172a, secondary: 0x475569 },                     // text colours
  accent: { base: 0x0f766e },                                             // accent colours
}) });
new FormUI(app, { theme: presetTheme('rose', 'dark') });                  // indigo | teal | rose | amber | violet | slate
```

Or start from the built-ins:

```ts
import { lightTheme, darkTheme, themeFromSeed, createTheme } from './lib';

new FormUI(app, { theme: themeFromSeed(0x0f766e) });            // brand colour -> full palette
new FormUI(app, { theme: darkTheme, themeOverrides: { radius: 4 } });
```

**b) Override any token globally**

```ts
const brand = createTheme(lightTheme, {
  fontFamily: ['Inter', 'system-ui', 'sans-serif'],
  fontSize: 16,
  radius: 14,             // field / card corners
  controlHeight: 52,      // text field / select height
  buttonRadius: 26,       // pill buttons
  borderWidth: 2,
  colors: { primary: 0xe11d48, borderFocus: 0xe11d48, focusRing: 0xfda4af, caret: 0xe11d48 },
});
```

Tokens include `fontFamily`, `fontSize`, `labelFontSize`, `helperFontSize`, `lineHeight`, `radius`, `borderWidth`,
`controlHeight`, `paddingX/Y`, `labelGap`, `helperGap`, `focusRingWidth`, `buttonHeight`, `buttonRadius`,
`checkboxSize`, `toggleWidth/Height`, `sliderTrackHeight`, `sliderThumbSize`, `caretWidth`, `caretBlinkMs`,
`dropdownItemHeight`, `dropdownMaxVisible`, `animationSpeed`, plus ~30 `colors` (see `src/lib/theme.ts`).

**c) Switch at runtime** (dark mode, user preference). All controls redraw:

```ts
ui.setTheme(darkTheme);
app.renderer.background.color = darkTheme.colors.background;
```

**d) Per-control overrides**

```ts
new Button(ui, { name: 'delete', text: 'Delete', variant: 'danger', theme: { buttonRadius: 4 } });
new TextInput(ui, { name: 'code', label: 'Code', theme: { fontFamily: ['ui-monospace', 'monospace'], fontSize: 20 } });
control.setThemeOverride({ colors: { border: 0x00aa00 } });   // later
```

Button variants: `primary | secondary | outline | ghost | danger`.

**Custom fonts:** load them with `@font-face` from your own origin (the CSP allows `font-src 'self'`) and wait for
`document.fonts.ready` before creating the UI, so text is measured with the right font.

**Changing how a built-in control draws:** subclass it and override the protected hooks:

| Hook                                | Use it to                                                   |
| ----------------------------------- | ----------------------------------------------------------- |
| `drawBody()`                        | Repaint the control body (call `super.drawBody()` to extend) |
| `drawTrailing(w, h)` (text fields)  | Draw icons on the right edge (set `trailingWidth`)           |
| `handleTrailingClick(e)`            | React to clicks on that icon                                 |
| `footerMessage()` / `footerColor()` | Customise the helper line                                    |
| `drawFocus(x, y, w, h, r)`          | Reuse the standard focus ring                                |

## 5. Rules: one definition, enforced twice

Add or change a field in `shared/rules.ts`:

```ts
export const registrationRules = {
  company: { label: 'Company', type: 'text', maxLength: 100, charset: /[\p{L}\p{N} &.,'-]/u },
  // ...
} satisfies RuleSet;
```

Client: `new TextInput(ui, { ...fromRule(registrationRules, 'company') })` sets the label, required flag, max length,
allowed characters (enforced while typing), keyboard type and validator.
Server: `validatePayload(registrationRules, body)` applies the same checks and **rejects unknown fields**.

Rule options: `type` (`text | secret | boolean | number | choice`), `required`, `minLength`, `maxLength`, `charset`,
`pattern`, `min`/`max`/`step`, `options`, `mustBeTrue`, `matches`, `password` (length, character classes,
no `aaa`, must not contain name/email, common-password list), `inputMode`.

## 6. Validators and formatters

```ts
import { Formatters } from './lib';

new TextInput(ui, {
  name: 'promo', label: 'Promo code',
  formatters: [Formatters.upperCase(), Formatters.allow(/[A-Z0-9]/)],      // like Flutter's inputFormatters
  validators: [
    (v) => (v.length === 8 ? null : 'Codes are 8 characters.'),
    async (v) => ((await checkPromo(v)) ? null : 'Unknown code.'),          // async is fine; stale results are dropped
  ],
  validateOn: 'blur',            // 'blur' | 'change' | 'submit'
});
```

A formatter is `(inserted, { before, after }) => string`. For secret fields `before`/`after` are always empty.
Sanitisation (control/bidi/zero-width characters, NFC/NFKC, length cap) always runs **after** your formatters.

Validators get a context with `getField(name)` for cross-field checks. For secrets, compare with
`secret.equals(other)` (constant time, no strings created).

## 7. Writing your own control

See **`src/examples/StarRating.ts`**. Extend `Control<V>` and implement:

```ts
getValue(): V; setValue(v: V, emit?: boolean): void; reset(): void; isEmpty(): boolean;
protected bodyHeight(): number; protected drawBody(): void;
```

Optional: `ariaRole()`, `ariaState()`, `handleKeyDown(e)` (return `true` if handled), and `acceptsText = true` with
`handleText` / `handleDelete` / `handlePaste` for text input. Use `this.bindTap(target, fn)` for presses (it handles
scroll versus tap on touch), `this.commitChange()` after value changes, and read colours and sizes from
`this.theme` so global and per-instance styling apply. It then works with `Form`, Tab order, screen readers and themes.

## 8. Mobile

- **Tap, not press.** Controls act on tap. A swipe that starts on a field scrolls the page instead of focusing it,
  so the keyboard doesn't pop up while scrolling.
- **Keyboard-safe viewport.** `FormUI` sizes the canvas to `visualViewport`, and `ScrollView` keeps the focused field
  above the on-screen keyboard. Disable with `fitVisualViewport: false`.
- **Right keyboard.** `inputMode: 'email' | 'tel' | 'numeric' | 'decimal' | 'url'` and `enterKeyHint`.
  Password fields switch the hidden input to `type=password`, so keyboards don't learn or suggest the secret.
- **Obscured typing.** On touch devices `PasswordInput` briefly shows the last typed character
  (`revealLastChar: 'auto' | true | false`, `revealLastCharMs`), like Flutter's `obscureText`.
- IME and composition (CJK, swipe keyboards), Android backspace, momentum scrolling, touch scrolling in dropdown
  menus, 16px proxy font (no iOS zoom), no long-press callout, and render resolution capped at 2× for performance.
- Use `Row([...], gap, breakpoint)` for side-by-side fields. It stacks into one column below `breakpoint` px.

## 9. Security model

| Layer     | What it does                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rendering | Values are drawn on canvas only. A single hidden input relays keystrokes and is reset to a zero-width placeholder after every event. Synthetic (`!isTrusted`) events are ignored. Autofill, autocorrect, spellcheck and password-manager heuristics are disabled. |
| Memory    | Field contents live in `SecureBuffer` (a `Uint32Array`, zeroed on growth, `wipe()`, submit, reset, idle timeout and destroy). Secrets are only exposed as `Secret`, and `JSON.stringify` / `console.log` print `[Secret]`. |
| Passwords | No copy/cut, no undo history, re-obscured on blur, tab hide and after 10s, Caps Lock warning, NFKC normalisation.                                              |
| Input     | Formatters → sanitiser (control, bidi-override and zero-width characters removed, Unicode normalised, max 20k raw characters) → per-rule charset → max length.      |
| Page      | Strict CSP (no inline scripts, no `eval`), `frame-ancestors 'none'`, `PrivacyScreen` covers the UI when the window loses focus.                                |
| Form      | Bot heuristics (minimum fill time, trusted-interaction count), client rate limit with exponential lockout, double-submit lock.                                    |
| Encryption | Password fields are sent as **PFE1 envelopes** (ECDH P-256 + HKDF-SHA256 + AES-256-GCM, bound to a single-use challenge and the field name). The server refuses plaintext. Decryptors for Node, Python, Go, C#, Ruby, PHP and Java. See [docs/ENCRYPTION.md](docs/ENCRYPTION.md). |
| Hashing   | Pepper (HMAC key outside the DB) + scrypt N=2¹⁷ r=8 p=1 + random salt; constant-time `verifyPassword()`; plaintext bytes zeroed. |
| Network   | `secureSubmit`: same-origin only (or an explicit HTTPS allow-list), CSRF header, `redirect: 'error'`, `no-store`, `no-referrer`, timeout.                        |
| Server    | Host allow-list, Origin and `Sec-Fetch-Site` checks, HttpOnly + SameSite=Strict session, HMAC CSRF token, 16 KB JSON-only bodies, strict schema, per-IP rate limits, scrypt hashing, no secrets in logs or responses. |

**Known limits:**

- JavaScript strings are immutable. The submit path (`sealSecret`) never creates a password string, but
  `Secret.use()` or the visibility toggle does create a copy that the garbage collector frees later.
- Client-side checks are speed bumps. The server is the authority, which is why it re-runs the same rules.
- Disabling browser autofill also hides fields from password managers. Pasting stays allowed (`allowPaste`), so
  managers still work through copy and paste.
- The demo server keeps users in memory. Before production, use a real database, put it behind HTTPS, set
  `SESSION_SECRET`, and add a CAPTCHA (for example Turnstile) to the registration route.
