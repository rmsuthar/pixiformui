# PFE1: encrypted secret fields

PixiForm encrypts password fields **in the browser** with the server's public key before they are sent.
This is defence in depth **on top of HTTPS**. TLS protects the connection; PFE1 keeps passwords unreadable to
everything between the browser and the code that hashes them: TLS-terminating proxies, CDNs, load balancers,
API gateways, request/body logging, APM and crash reporters.

## Why this design

| Choice | Reason |
| --- | --- |
| ECDH P-256 + HKDF-SHA256 + AES-256-GCM | The ECIES / HPKE-base construction. Every major language ships all three in its standard crypto library: Web Crypto, Node, Python `cryptography`, Go, .NET, Java JCA, PHP OpenSSL, Ruby OpenSSL. |
| Fresh ephemeral key per secret | Forward secrecy per envelope. Identical passwords produce unrelated envelopes. |
| Challenge + field name in the AAD | A captured envelope can't be replayed (the challenge is single-use) or moved to another field. |
| Encrypt from `SecureBuffer` | The browser never creates a JS string of the password: code points → UTF-8 bytes → encrypt → zero the bytes. |

**Even stronger option:** a PAKE such as **OPAQUE** (RFC 9807) means the server never learns the password at all,
not even at registration. It needs a dedicated library on both ends and a different login protocol, so PFE1 is the
portable, dependency-free default here.

## Envelope format

```
envelope = "pfe1." kid "." B64U(epk) "." B64U(iv) "." B64U(ciphertext || tag)

kid      = first 16 chars of B64U(SHA-256(server public key, SPKI DER))
epk      = ephemeral P-256 public key, uncompressed point (65 bytes, starts with 0x04)
iv       = 12 random bytes
tag      = 16-byte GCM tag (appended to the ciphertext)
B64U     = base64url without padding
```

## Algorithm

```
shared = ECDH(serverPrivateKey, epk)                       32-byte X coordinate
key    = HKDF-SHA256(IKM = shared, salt = epk (65 bytes), info = "pixiform/pfe1/aes-256-gcm", L = 32)
header = "pfe1." kid "." B64U(epk) "." B64U(iv)
aad    = UTF-8( header "|" challenge "|" fieldName )
plain  = AES-256-GCM-Decrypt(key, iv, ciphertext, tag, aad)
```

Decryptors **must**:

1. Match `^pfe1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{87})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22,})$`
   and cap the last group at 1400 chars.
2. Reject unknown `kid`s, check `len(epk) == 65`, `epk[0] == 0x04`, `len(iv) == 12`, `len(ct) >= 17`.
3. Validate that `epk` is on the curve. Every listed library does this when importing the point.
4. Use the challenge **they** issued, never one sent by the client. Consume it on every attempt.
5. Return one generic error for all failures, and zero the shared secret, AES key and plaintext after use.

## Protocol

```
GET  /api/session   -> { csrfToken, encryption: { alg: "PFE1", kid, spki, challenge } }
POST /api/register  <- { ..., password: "pfe1....", confirmPassword: "pfe1...." }   (X-CSRF-Token header)
                    -> { ok, message, fieldErrors?, challenge: <next single-use challenge> }
```

The server refuses non-envelope values for any field whose rule type is `secret`.

## Keys and rotation

- Private key: EC P-256, PKCS#8 PEM. Dev mode generates `.keys/pfe-current.pem` (mode 600, git-ignored).
- Production: create the key yourself and point `PFE_KEY_FILE` at it. Keep it in a secrets manager or KMS.
  ```bash
  openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out pfe-current.pem
  ```
- Rotation: deploy the new key as `PFE_KEY_FILE` and list old keys in `PFE_RETIRED_KEY_FILES` (comma-separated)
  until in-flight sessions expire (30 min). Envelopes name their `kid`, so both keys work during the overlap.
- `PFE_REQUIRE_KEY=1` makes the server refuse to start without a key file (no auto-generation).

## After decryption: hashing

The Node server mixes in a **pepper** (`HMAC-SHA256(PASSWORD_PEPPER, password)`) and then hashes with
**scrypt N=2^17, r=8, p=1** (OWASP minimum), a 16-byte random salt, stored as
`scrypt$v1$N$r$p$salt$hash`. `verifyPassword()` compares in constant time. Keep the pepper outside the database:
a stolen database alone then can't be brute-forced. Argon2id (where available) is an equally good choice.

## Decryptors in other languages

| Language | File | Dependency | Verified by `npm run test:pfe` |
| --- | --- | --- | --- |
| Node.js 22 | `server/pfe.ts` | built-in `node:crypto` | ✅ |
| Python 3.9+ | `server/decrypt/python/pfe.py` | `cryptography` | ✅ |
| Go 1.26.11+ | `server/decrypt/go/pfe.go` | standard library | ✅ |
| C# / .NET 8+ | `server/decrypt/csharp/Pfe.cs` | standard library | ✅ |
| Ruby 3+ | `server/decrypt/ruby/pfe.rb` | `openssl` gem | ✅ |
| PHP 8.1+ | `server/decrypt/php/pfe.php` | `ext-openssl` | ⚠️ not run yet (no PHP on the dev machine) |
| Java 17+ | `server/decrypt/java/Pfe.java` | JCA | ⚠️ not run yet (no runnable JDK on the dev machine) |

`npm run test:pfe` generates a fresh key and envelopes **with the browser code** (3 valid, including multi-byte UTF-8,
and 5 that must be rejected: wrong field, replayed challenge, tampered ciphertext, unknown key, malformed). It then
runs every decryptor whose toolchain is installed and reports PASS/FAIL. Run it on a machine with PHP and Java to
verify those two.

## Threat model: what PFE1 does and doesn't do

- ✅ Passwords stay unreadable in proxy/CDN/gateway logs, request-body logging, and TLS-inspection boxes.
- ✅ Captured requests can't be replayed, and envelopes can't be swapped between fields.
- ✅ No plaintext password string is ever created in the browser.
- ❌ It does **not** replace HTTPS. Without TLS an attacker could swap the public key in `/api/session`.
- ❌ It doesn't protect against malicious JavaScript running in your own page (XSS). That's why the CSP stays strict.
- ❌ The server still sees the plaintext briefly in order to hash it. Only a PAKE (OPAQUE) avoids that.
