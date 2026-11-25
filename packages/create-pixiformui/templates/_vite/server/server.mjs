// Starter server for {{name}}: one process for the app and its API.
//   npm run dev                 → Vite (hot reload) + API on http://localhost:5173
//   npm run build && npm start  → built app + API on http://localhost:3000 (set HTTPS=1 behind TLS)
// The API itself is in server/app.mjs (framework-neutral); this file adapts it to Node's http server
// and serves the app.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleSession, handleSignup, SECURE } from './app.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEV = process.argv.includes('--dev');
const PORT = Number(process.env.PORT ?? (DEV ? 5173 : 3000));

const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  // A strict CSP works: PixiFormUI needs no inline scripts, eval or inline styles. (Vite's dev
  // server injects inline scripts, so it's applied to the built app only.)
  ...(DEV ? {} : { 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" }),
  ...(SECURE ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' } : {}),
};

/** Node request → the plain request app.mjs expects. */
const toRequest = (req) => ({
  method: req.method,
  headers: req.headers,
  ip: req.socket.remoteAddress ?? 'unknown',
  text: () =>
    new Promise((resolveText, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > 64 * 1024) req.destroy();
        else chunks.push(c);
      });
      req.on('end', () => resolveText(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    }),
});

const send = (res, r) => {
  res.writeHead(r.status, { ...HEADERS, ...r.headers });
  res.end(r.body);
};

// ------------------------------------------------------------------ static files (production)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.map': 'application/json', '.woff2': 'font/woff2' };
const dist = join(root, 'dist');

function serveStatic(req, res) {
  let file = normalize(join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!file.startsWith(dist)) return send(res, { status: 400, headers: {}, body: 'Bad path.' });
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  if (!existsSync(file)) return send(res, { status: 503, headers: { 'Content-Type': 'text/plain' }, body: 'Run `npm run build` first.' });
  const immutable = file.startsWith(join(dist, 'assets'));
  res.writeHead(200, { ...HEADERS, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
  createReadStream(file).pipe(res);
}

// ------------------------------------------------------------------ start
const vite = DEV ? await (await import('vite')).createServer({ root, server: { middlewareMode: true }, appType: 'spa' }) : null;

createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/api/session') return send(res, handleSession(toRequest(req)));
    if (path === '/api/signup') return send(res, await handleSignup(toRequest(req)));
    if (path.startsWith('/api/')) return send(res, { status: 404, headers: { 'Content-Type': 'application/json' }, body: '{"message":"Not found."}' });
    if (vite) return vite.middlewares(req, res);
    serveStatic(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, { status: 500, headers: { 'Content-Type': 'application/json' }, body: '{"ok":false,"message":"Something went wrong."}' });
  }
}).listen(PORT, () => console.log(`\n  {{name}} running at http://localhost:${PORT}${DEV ? ' (dev)' : ''}\n`));
