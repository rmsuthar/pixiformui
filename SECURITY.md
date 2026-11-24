# Security policy

PixiFormUI is a security-focused library, so reports are very welcome and taken seriously.

## Reporting a vulnerability

**Please don't open a public issue.** Report privately instead:

- GitHub: [Report a vulnerability](https://github.com/rmsuthar/pixiformui/security/advisories/new) (private advisory), or
- Email: ravindra.suthar@me.com with "SECURITY" in the subject.

Include the affected version, a description, and steps or a proof of concept. You'll get an acknowledgement within
3 working days and a status update within 10. Fixes are released as a patch version with a GitHub security
advisory; reporters are credited unless they prefer otherwise.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x (latest) | ✅ |

Until 1.0, only the latest minor version receives security fixes.

## Threat model (summary)

**What PixiFormUI protects against**

- **DOM scraping**: browser extensions, session-replay and analytics tools, and injected third-party scripts that read
  form values from the page with `querySelector`, `input.value` or DOM mutation observers. Values are drawn on a
  canvas and kept in memory; the single hidden relay input is reset after every keystroke.
- **Scripted input**: untrusted (synthetic) keyboard and input events are ignored.
- **Plaintext passwords in transit and logs**: password fields are encrypted in the browser (PFE1: ECDH P-256,
  HKDF-SHA256, AES-256-GCM) for your server's public key, bound to a single-use challenge and the field name, so a
  captured request can't be replayed and TLS-terminating proxies, CDNs and request logs never see the plaintext.
- **Leaking secrets by accident**: passwords are `Secret` handles in wipeable memory, never JavaScript strings;
  `JSON.stringify` prints `[redacted]`, analytics events contain no values, and `setValues()` can't set secrets.
- **Accidental exposure on screen**: optional privacy screen when the window loses focus.

**What it does not protect against**

- A fully compromised page: script running in the page can still hook drawing, keyboard events or the library's
  own objects. Use a strict Content Security Policy (the library needs only `script-src 'self'`) and keep third-party
  scripts off pages with sensitive forms.
- Malware, keyloggers or compromised browsers on the user's device, and screen capture of what's displayed.
- Server-side weaknesses: always validate on the server with the shared rules, hash passwords (the reference server
  uses scrypt with a pepper), and protect the PFE1 private key.
- Phishing and look-alike pages.

See the [security model chapter](https://pixiformui.lets.gen.in/docs/guide/security-model/) and the
[encryption spec](https://pixiformui.lets.gen.in/docs/encryption/) for details.
