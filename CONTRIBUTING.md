# Contributing to PixiFormUI

Thanks for helping! Bug reports, docs fixes and pull requests are all welcome.

## Getting started

```bash
git clone https://github.com/rmsuthar/pixiformui.git
cd pixiformui
npm install
npm run dev            # reference server + demo at http://localhost:8787
```

## Before opening a pull request

```bash
npm run typecheck
npm test               # unit tests (shared rules, encryption helpers, events…)
npm run build:lib && npm run size
npx playwright install chromium webkit firefox   # once
npm run test:e2e       # browser tests in Chromium, WebKit (Safari) and Firefox
```

- Add or update tests for behaviour changes; browser tests live in `tests/e2e/`.
- Add a line to `CHANGELOG.md` under **Unreleased** for anything users will notice.
- Keep the library dependency-free and compatible with a strict CSP (`script-src 'self'`, no `eval`, no workers).

## Ground rules for security

PixiFormUI's promise is that field values never reach the DOM, logs, analytics or plain-text storage. Changes must keep
that: secrets stay in `Secret`/`SecureBuffer`, untrusted events are ignored, and analytics carry metadata only.
**Report vulnerabilities privately** (see [SECURITY.md](SECURITY.md)), not in issues or pull requests.

## Project layout

| Path | What |
| --- | --- |
| `src/lib/` | The library (renderer, controls, Form, accessibility, analytics, events) |
| `shared/` | Validation rules and JSON Schema shared by browser, server and agents |
| `server/` | Reference server, PFE1 decryptors (7 languages), MCP server |
| `site/`, `scripts/build-site.mjs` | Website and docs (deployed to Cloudflare) |
| `tests/` | Unit tests (`*.test.ts`) and browser tests (`e2e/`) |

Releases are cut by maintainers; see [docs/RELEASING.md](docs/RELEASING.md).

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE) and that you'll follow
the [Code of Conduct](CODE_OF_CONDUCT.md).
