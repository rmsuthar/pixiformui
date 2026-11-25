# {{name}}

A secure sign-up form built with [PixiFormUI](https://pixiformui.lets.gen.in) and Next.js, created with
`create-pixiformui` (next template).

```sh
npm install
npm run dev                 # http://localhost:3000
npm run build && npm start  # production
```

## Server-side rendering

The page is rendered on the server. PixiFormUI draws the form on a canvas in the browser, so the server sends a
lightweight **placeholder** in its place (`pixiformSkeleton()`: the title, labels and button, sized like the real
form). The form replaces it on its first frame, so the page doesn't jump, and visitors without JavaScript and search
engines still see what the form asks for. `pixiformui` is safe to import in server code; `mountPixiForm()` runs in the
browser (the `PixiForm` component calls it in an effect).

## What's in the demo

- **Conditional fields:** the phone field appears for "Contact me by: Phone", and the whole Company group for
  business sign-ups (its VAT field once a company name is filled in). Hidden fields aren't validated or sent.
- **A hidden field** (`source`), set from `?utm_campaign=` in the URL.
- **Encrypted passwords:** encrypted in the browser for this server only.
- **Bot protection:** an invisible proof-of-work, a minimum fill time, and a slide-to-the-mark human check.
- **Duplicate protection:** a retried submission (double click, lost response) is processed once.

## Files

| File | What it is |
| --- | --- |
| `shared/fields.js` | The fields, used by the browser **and** the server (same rules on both sides) |
| `src/form.ts` | The form config: title, browser-only checks, where it submits |
| `app/page.tsx`, `app/SignupForm.tsx` | The page (server component) and the form (client component) |
| `app/api/session`, `app/api/signup` | Route handlers calling `server/app.mjs` |
| `server/app.mjs` | The API: session, CSRF, proof-of-work, idempotency, decryption, validation |
| `server/validate.mjs` | Server-side validation from `shared/fields.js`, including `showIf` rules |
| `server/lib/` | Generated from PixiFormUI (password decryption, proof-of-work, conditions) |

## Before production

- Serve over HTTPS and set `HTTPS=1` (secure session cookie).
- The password-encryption key is created in `.keys/` on first run. Keep it out of git; in production load it from
  your secrets manager and point `PFE_KEY_FILE` at it. On serverless hosts the file system is read-only and short
  lived, so always provide `PFE_KEY_FILE` there.
- Sessions, users and rate limits are kept in memory: replace them with your database or Redis (serverless functions
  don't share memory).
- Optional settings: `POW_DIFFICULTY` (default 18, 0 turns the proof-of-work off), `MIN_FILL_MS` (default 2000).

Docs: https://pixiformui.lets.gen.in/docs/
