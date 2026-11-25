# {{name}}

A secure sign-up form built with [PixiFormUI](https://pixiformui.lets.gen.in), created with `create-pixiformui` ({{template}} template).

```sh
npm install
npm run dev                 # http://localhost:5173 (app + API, hot reload)
npm run build && npm start  # production: http://localhost:3000
```

## What's in the demo

- **Conditional fields:** the phone field appears for "Contact me by: Phone", and the whole Company group for
  business sign-ups (its VAT field once a company name is filled in). Hidden fields aren't validated or sent.
- **A hidden field** (`source`), set from `?utm_campaign=` in the URL.
- **Encrypted passwords:** encrypted in the browser for this server only; no plaintext ever exists in the page.
- **Bot protection:** an invisible proof-of-work solved while the person types, a minimum fill time, and a
  slide-to-the-mark human check.
- **Duplicate protection:** a retried submission (double click, lost response) is processed once.

## Files

| File | What it is |
| --- | --- |
| `shared/fields.js` | The fields, used by the browser **and** the server (same rules on both sides) |
| `src/form.ts` | The form config: title, browser-only checks, where it submits |
| `server/server.mjs` | The app server and the `/api/session` and `/api/signup` endpoints |
| `server/validate.mjs` | Server-side validation from `shared/fields.js`, including `showIf` rules |
| `server/security.mjs` | Sessions, CSRF, proof-of-work, rate limit, idempotency |
| `server/lib/` | Generated from PixiFormUI (password decryption, proof-of-work, conditions) |

## Before production

- Serve over HTTPS and set `HTTPS=1` (secure cookie, HSTS).
- The password-encryption key is created in `.keys/` on first run. Keep it out of git; in production load it from
  your secrets manager and point `PFE_KEY_FILE` at it.
- Replace the in-memory users, sessions and rate limits with your database or Redis.
- Optional settings: `POW_DIFFICULTY` (default 18, 0 turns the proof-of-work off), `MIN_FILL_MS` (default 2000),
  `PORT`.

Docs: https://pixiformui.lets.gen.in/docs/
