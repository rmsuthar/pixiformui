import { defineConfig, type Plugin } from 'vite';

/**
 * Content-Security-Policy.
 * - No 'unsafe-eval', no inline scripts, no workers: the Canvas 2D renderer needs none of them.
 * - Inline styles are only allowed in dev (Vite injects CSS that way).
 */
const baseCsp = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'worker-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
};

const toCsp = (p: Record<string, string[]>) =>
  Object.entries(p).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');

const devCsp = toCsp({
  ...baseCsp,
  'style-src': ["'self'", "'unsafe-inline'"],
  'connect-src': ["'self'", 'ws:', 'wss:'],
  'frame-ancestors': ["'none'"],
});

const prodCsp = toCsp({ ...baseCsp, 'style-src': ["'self'"], 'connect-src': ["'self'"] });

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

/** Injects the production CSP as a <meta> tag into the built index.html. */
function cspMeta(): Plugin {
  return {
    name: 'pixiform-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${prodCsp}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [cspMeta()],
  server: {
    headers: { 'Content-Security-Policy': devCsp, ...securityHeaders },
  },
  preview: {
    headers: { 'Content-Security-Policy': `${prodCsp}; frame-ancestors 'none'`, ...securityHeaders },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
