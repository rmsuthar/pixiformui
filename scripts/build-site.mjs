// Builds the PixiFormUI website into dist-site/:
//   1. Vite builds the home page (live demo uses the library source) and 404 page.
//   2. The Markdown docs are rendered to static HTML. The developer guide is split into one
//      page per chapter (better titles, descriptions and URLs for search engines).
//   3. sitemap.xml and robots.txt are generated.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const SITE = (process.env.SITE_URL ?? 'https://pixiformui.lets.gen.in').replace(/\/+$/, '');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-site');
const today = new Date().toISOString().slice(0, 10);

execSync('npx vite build --config vite.site.config.ts', { cwd: root, stdio: 'inherit' });

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const strip = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
// GitHub-style heading ids, so the docs' existing #anchors keep working.
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
// Product name on the website (code identifiers like mountPixiForm or <pixi-form> are untouched).
const brand = (md) => md.replace(/\bPixiForm\b(?!UI)/g, 'PixiFormUI');
const unbrand = (t) => t.replace(/PixiFormUI/g, 'PixiForm');
/** Plain-text summary for meta descriptions (≤ 158 chars, cut at a word). */
const summarize = (text) => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= 158) return t;
  return t.slice(0, 157).replace(/\s+\S*$/, '') + '…';
};

/** Builds a description from the opening content (paragraphs, list items, table cells) until it's useful. */
function describeTokens(tokens, marked, fallback) {
  let text = '';
  for (const t of tokens) {
    if (t.type === 'heading' && text) break;
    let chunk = '';
    if (t.type === 'paragraph') chunk = t.text;
    else if (t.type === 'list') chunk = t.items.map((i) => i.text.split('\n')[0]).join('; ');
    else if (t.type === 'table') chunk = t.rows.slice(0, 4).map((r) => r.map((c) => c.text).join(' ')).join('; ');
    else continue;
    text += (text ? ' ' : '') + strip(marked.parseInline(chunk)).replace(/\s*:\s*$/, '.');
    if (text.length >= 120) break;
  }
  return summarize(text.length >= 60 ? text : `${fallback} ${text}`.trim());
}

// ------------------------------------------------------------------ pages
/** Hand-written search descriptions for guide chapters (fallback: generated from the opening text). */
const CHAPTER_DESCRIPTIONS = {
  "what-pixiform-is-and-when-to-use-it": "What PixiFormUI is, how canvas rendering keeps typed values out of the DOM, and when to choose it over native HTML forms.",
  "getting-started": "Install PixiFormUI, run the secure reference server and demo, and learn the project layout and npm scripts.",
  "architecture-and-core-concepts": "How PixiFormUI works: the canvas scene graph, the hidden keyboard proxy, focus management, wipeable secret memory and submission.",
  "tutorial-build-a-sign-in-form": "Step-by-step tutorial: build a secure sign-in form with PixiFormUI, from canvas setup to encrypted submission.",
  "controls-reference": "Reference for every PixiFormUI control: text, password, OTP, date picker, phone input, checkbox, switch, radio, select, slider and button.",
  "the-form-controller": "The PixiFormUI Form controller: collecting values, validation, rate limiting, bot checks, idle wipe of secrets and submit flow.",
  "validation": "Validate PixiFormUI fields with required rules, custom and async validators, autovalidate modes and server-side field errors.",
  "input-formatting-and-sanitisation": "Format and sanitise input in PixiFormUI: input formatters, character allow-lists, Unicode normalisation and control-character stripping.",
  "styling-and-theming": "Theme PixiFormUI forms: palette API with theme, text and accent colours, presets, light and dark modes, and contrast checks.",
  "layout": "Lay out PixiFormUI forms with Column, Row, ScrollView and FieldGroup: responsive rows, titled and collapsible sections.",
  "widgets": "PixiFormUI widgets: labels, password strength meter, toasts and the privacy screen that hides forms when the window loses focus.",
  "extending-pixiform": "Build custom PixiFormUI controls and widgets with the canvas primitives, the Control base class, accessibility hooks and validation.",
  "shared-rules": "One rule file validates in the browser, on the server and in AI-agent tools: PixiFormUI shared validation rules and JSON Schema.",
  "the-server": "The PixiFormUI reference server: sessions, CSRF tokens, strict CSP, rate limits, password hashing with scrypt and pepper, and OTP.",
  "encrypted-password-fields-pfe1": "How PixiFormUI encrypts password fields end to end with ECDH P-256 and AES-256-GCM, and decrypts them on your server.",
  "security-model": "PixiFormUI's security model: what canvas rendering protects against, the threats it doesn't cover, and the defence-in-depth layers.",
  "mobile": "PixiFormUI on phones: native keyboards, SMS code autofill, touch scrolling, the on-screen keyboard and responsive layouts.",
  "accessibility": "Accessible canvas forms: PixiFormUI's screen-reader outline, linked errors, keyboard support, high contrast, reduced motion and zoom.",
  "testing": "Test PixiFormUI forms: unit tests for shared rules, browser tests through the accessibility outline, and encryption round-trip tests.",
  "deployment-checklist": "Checklist for deploying PixiFormUI to production: keys, pepper, CSP, HTTPS, rate limits, sessions and monitoring.",
  "troubleshooting-and-faq": "Fix common PixiFormUI problems and find answers about frameworks, custom drawing, password managers and browser support.",
  "api-quick-reference": "Quick reference for the PixiFormUI API: FormUI, Form, controls, layout, theming, security helpers and mountPixiForm options.",
  "using-pixiform-in-existing-apps-html-react-angular": "Embed PixiFormUI in existing apps: the <pixi-form> web component for HTML, React and Angular wrappers, and mountPixiForm().",
  "analytics": "Privacy-safe form analytics with PixiFormUI: funnels, drop-off fields and error codes for GA4, Tag Manager, Segment and PostHog.",
  "serialization-ajax-and-mcp": "Serialize PixiFormUI forms to JSON with encrypted passwords, submit with AJAX without code, generate JSON Schema, and use MCP.",
  "events-and-loading": "PixiFormUI events: load lifecycle, change, dirty, validate and cancelable beforesubmit, plus lazy loading with a placeholder state."
};
/** @type {{ url: string, title: string, nav: string, description: string, html: string, toc: {id:string,text:string}[], kind: 'article'|'index', prev?: any, next?: any, crumbs: {name:string,url:string}[] }[]} */
const pages = [];
/** heading id → page url (for cross-page #anchor links) */
const anchorPage = new Map();
const docFile = { 'DEVELOPER_GUIDE.md': '/docs/guide/', 'ENCRYPTION.md': '/docs/encryption/', 'RENDERER.md': '/docs/renderer/' };

function lex(md) {
  const marked = new Marked({ gfm: true });
  const tokens = marked.lexer(md);
  // Assign GitHub-style ids to every heading, in document order, de-duplicated across the doc.
  const ids = new Map();
  const seen = new Map();
  for (const t of tokens) {
    if (t.type !== 'heading') continue;
    let id = slugify(unbrand(t.text));
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    if (n) id = `${id}-${n}`;
    ids.set(t, id);
  }
  return { tokens, ids };
}

function renderer(ids, pageUrl, toc) {
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(token) {
        const html = this.parser.parseInline(token.tokens);
        const id = ids.get(token) ?? slugify(unbrand(token.text));
        if (token.depth === 3 && toc) toc.push({ id, text: strip(html) });
        const anchor = token.depth > 1 ? `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` : '';
        return `<h${token.depth} id="${id}">${html}${anchor}</h${token.depth}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const t = title ? ` title="${esc(title)}"` : '';
        if (/^https?:\/\//.test(href)) return `<a href="${esc(href)}"${t} rel="noopener noreferrer">${text}</a>`;
        if (href.startsWith('#')) {
          const id = decodeURIComponent(href.slice(1));
          const target = anchorPage.get(id);
          if (!target || target.url === pageUrl) return `<a href="${esc(href)}"${t}>${text}</a>`;
          return `<a href="${target.url}${target.isChapter === id ? '' : `#${esc(id)}`}"${t}>${text}</a>`;
        }
        const [file, hash] = href.split('#');
        const name = file.split('/').pop();
        if (docFile[name]) {
          const target = hash ? anchorPage.get(hash) : null;
          const url = target ? `${target.url}${target.isChapter === hash ? '' : `#${esc(hash)}`}` : docFile[name];
          return `<a href="${url}"${t}>${text}</a>`;
        }
        if (name === 'README.md') return `<a href="/"${t}>${text}</a>`;
        // Links into the source tree: show the path, no link (the repository isn't public).
        return /<code>/.test(text) ? text : `<code>${text}</code>`;
      },
    },
  });
  return marked;
}

/** The developer guide: an overview page plus one page per `## N. Chapter`. */
function buildGuide() {
  const { tokens, ids } = lex(brand(readFileSync(join(root, 'docs/DEVELOPER_GUIDE.md'), 'utf8')));
  const links = tokens.links;
  const intro = [];
  const chapters = [];
  for (const t of tokens) {
    if (t.type === 'heading' && t.depth === 2 && /^\d+\.\s/.test(t.text)) chapters.push({ heading: t, tokens: [t] });
    else if (chapters.length) chapters[chapters.length - 1].tokens.push(t);
    else intro.push(t);
  }
  // Map every heading id to its chapter page first, so links can cross pages.
  for (const ch of chapters) {
    const id = ids.get(ch.heading);
    ch.number = ch.heading.text.match(/^(\d+)\./)[1];
    ch.name = ch.heading.text.replace(/^\d+\.\s*/, '').replace(/\s*\(.*\)\s*$/, '').trim();
    ch.slug = id.replace(/^\d+-/, '').replace(/-+$/, '');
    ch.url = `/docs/guide/${ch.slug}/`;
    for (const t of ch.tokens) if (t.type === 'heading') anchorPage.set(ids.get(t), { url: ch.url, isChapter: id });
  }
  for (const t of intro) if (t.type === 'heading') anchorPage.set(ids.get(t), { url: '/docs/guide/', isChapter: null });

  // Overview page: the intro, minus the old in-page contents list, plus a chapter list.
  const introTokens = [];
  let skipping = false;
  for (const t of intro) {
    if (t.type === 'heading' && t.depth === 2 && /contents/i.test(t.text)) { skipping = true; continue; }
    if (skipping && t.type === 'heading') skipping = false;
    if (!skipping && t.type !== 'hr') introTokens.push(t);
  }
  introTokens.links = links;
  const introHtml = renderer(ids, '/docs/guide/', null).parser(introTokens);
  const list = chapters
    .map((c) => `<li><a href="${c.url}"><span class="num">${c.number}</span>${esc(strip(renderer(ids, '', null).parseInline(c.name)))}</a></li>`)
    .join('');
  const introText = strip(introHtml).replace(/^PixiFormUI Developer Guide\s*/, '');
  pages.push({
    url: '/docs/guide/',
    title: 'PixiFormUI Developer Guide: secure canvas forms for JavaScript',
    nav: 'Developer guide',
    description: summarize(introText),
    html: `${introHtml}\n<h2 id="chapters">Chapters</h2>\n<ol class="chapter-list">${list}</ol>`,
    toc: [],
    kind: 'index',
    crumbs: [{ name: 'Docs', url: '/docs/' }, { name: 'Developer guide', url: '/docs/guide/' }],
  });

  chapters.forEach((ch, i) => {
    const toc = [];
    // The chapter heading becomes the page's h1.
    const h = ch.tokens[0];
    const body = ch.tokens.slice(1);
    body.links = links;
    const html = renderer(ids, ch.url, toc).parser(body);
    const nameText = strip(renderer(ids, '', null).parseInline(ch.name));
    const description = CHAPTER_DESCRIPTIONS[ch.slug] ?? describeTokens(body, renderer(ids, ch.url, null), `${nameText} in PixiFormUI, the secure canvas form library:`);
    pages.push({
      url: ch.url,
      title: `${nameText} · PixiFormUI Developer Guide`,
      h1: `<p class="eyebrow">Chapter ${ch.number}</p>\n        <h1 id="${ids.get(h)}">${renderer(ids, '', null).parseInline(h.text.replace(/^\d+\.\s*/, ''))}</h1>`,
      nav: nameText,
      description,
      html,
      toc,
      kind: 'article',
      prev: chapters[i - 1] ? { url: chapters[i - 1].url, name: strip(renderer(ids, '', null).parseInline(chapters[i - 1].name)) } : null,
      next: chapters[i + 1] ? { url: chapters[i + 1].url, name: strip(renderer(ids, '', null).parseInline(chapters[i + 1].name)) } : null,
      crumbs: [{ name: 'Docs', url: '/docs/' }, { name: 'Developer guide', url: '/docs/guide/' }, { name: nameText, url: ch.url }],
    });
  });
  return chapters;
}

/** A single-page doc (encryption spec, renderer notes). */
function buildSingle(src, url, nav, title) {
  const { tokens, ids } = lex(brand(readFileSync(join(root, src), 'utf8')));
  for (const t of tokens) if (t.type === 'heading') anchorPage.set(ids.get(t), { url, isChapter: null });
  return () => {
    const toc = [];
    const marked = renderer(ids, url, null);
    // Use h2s for this page's table of contents.
    const h2toc = tokens.filter((t) => t.type === 'heading' && t.depth === 2).map((t) => ({ id: ids.get(t), text: strip(marked.parseInline(t.text)) }));
    const html = marked.parser(tokens);
    pages.push({
      url,
      title,
      nav,
      description: describeTokens(tokens.filter((t) => !(t.type === 'heading' && t.depth === 1)), marked, nav),
      html,
      toc: h2toc.length ? h2toc : toc,
      kind: 'article',
      crumbs: [{ name: 'Docs', url: '/docs/' }, { name: nav, url }],
    });
  };
}

const chapters = buildGuide();
const encryption = buildSingle('docs/ENCRYPTION.md', '/docs/encryption/', 'Encryption (PFE1)', 'PFE1 Encryption Spec: Encrypted Password Fields · PixiFormUI');
const rendererDoc = buildSingle('docs/RENDERER.md', '/docs/renderer/', 'Renderer', 'Canvas 2D renderer · PixiFormUI');
encryption();
rendererDoc();
// ------------------------------------------------------------------ install page + versioned downloads
const lib = JSON.parse(readFileSync(join(root, 'dist-lib/package.json'), 'utf8'));
const files = ['pixiformui.standalone.js', 'pixiformui.js'];
// Always ship the freshly built version's files…
mkdirSync(join(out, 'v', lib.version), { recursive: true });
for (const f of files) {
  const src = join(root, 'dist-lib', f);
  if (!existsSync(src)) throw new Error(`Missing ${src}: run npm run build:lib first`);
  copyFileSync(src, join(out, 'v', lib.version, f));
}
// …but advertise the latest version that's actually on npm, so CDN links never 404
// between a version bump and `npm publish`.
let published = null;
try {
  const r = await fetch('https://registry.npmjs.org/pixiformui/latest', { signal: AbortSignal.timeout(8000) });
  if (r.ok) published = (await r.json()).version;
} catch {}
const version = published && published !== lib.version && existsSync(join(out, 'v', published, files[0])) ? published : lib.version;
if (version !== lib.version) console.log(`install page: npm latest is ${version} (built ${lib.version} not published yet)`);
const downloads = files.map((f) => {
  const buf = readFileSync(join(out, 'v', version, f));
  return { file: f, url: `/v/${version}/${f}`, sri: `sha384-${createHash('sha384').update(buf).digest('base64')}`, kb: Math.round(gzipSync(buf).length / 1024) };
});
const [standalone, esm] = downloads;
// Earlier versions kept under site/public/v/<version>/ (copied into dist-site by Vite).
const sriOf = (p) => `sha384-${createHash('sha384').update(readFileSync(p)).digest('base64')}`;
const older = existsSync(join(out, 'v'))
  ? readdirSync(join(out, 'v'))
      .filter((v) => v !== version && v.localeCompare(version, undefined, { numeric: true }) < 0 && existsSync(join(out, 'v', v, 'pixiformui.standalone.js')))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  : [];
const olderHtml = older.length
  ? `<h2 id="older">Older versions</h2>\n<table><thead><tr><th>Version</th><th>Standalone bundle (SHA-384)</th></tr></thead><tbody>${older
      .map((v) => `<tr><td>${v}</td><td><a href="/v/${v}/pixiformui.standalone.js" download>pixiformui.standalone.js</a><br><code>${sriOf(join(out, 'v', v, 'pixiformui.standalone.js'))}</code></td></tr>`)
      .join('')}</tbody></table>`
  : '';
const code = (s) => `<pre><code>${esc(s)}</code></pre>`;
pages.push({
  url: '/docs/install/',
  title: `Install PixiFormUI ${version}: npm, CDN and self-hosted downloads`,
  nav: 'Install',
  description: `Install PixiFormUI ${version} from npm, load it from a CDN, or self-host the bundle with Subresource Integrity hashes. MIT licensed.`,
  html: `<h1>Install</h1>
<p>Current version: <strong>${version}</strong> · MIT licence · zero dependencies.</p>
<h2 id="npm">npm (React, Angular, Vue, Svelte, any bundler)</h2>
${code('npm install pixiformui')}
${code(`import { mountPixiForm } from 'pixiformui';\n\nconst form = await mountPixiForm(document.getElementById('signup'), {\n  fields: [{ type: 'email', name: 'email', label: 'Email', required: true }],\n  onSubmit: async (values) => ({ ok: true, message: 'Saved' }),\n});`)}
<p>TypeScript types are included. The <a href="/docs/guide/using-pixiform-in-existing-apps-html-react-angular/">embedding guide</a> has React and Angular wrappers.</p>
<h2 id="self-host">Self-hosted (recommended without a bundler)</h2>
<p>Download the bundle and serve it from your own origin, so a strict <code>script-src 'self'</code> Content Security Policy keeps working:</p>
<table><thead><tr><th>File</th><th>Use</th><th>Size (gzip)</th></tr></thead><tbody>
<tr><td><a href="${standalone.url}" download>${standalone.file}</a></td><td>Plain HTML; registers <code>&lt;pixi-form&gt;</code></td><td>${standalone.kb} KB</td></tr>
<tr><td><a href="${esm.url}" download>${esm.file}</a></td><td>ES module for your own bundling</td><td>${esm.kb} KB</td></tr>
</tbody></table>
${code(`<script type="module" src="/vendor/${standalone.file}"></script>\n<pixi-form id="contact"></pixi-form>`)}
<h2 id="cdn">CDN with integrity check</h2>
<p>Load a pinned version straight from this site or from jsDelivr. The <code>integrity</code> hash makes the browser refuse a modified file:</p>
${code(`<script type="module"\n  src="${SITE}${standalone.url}"\n  integrity="${standalone.sri}"\n  crossorigin="anonymous"></script>`)}
${code(`<script type="module"\n  src="https://cdn.jsdelivr.net/npm/pixiformui@${version}/${standalone.file}"\n  integrity="${standalone.sri}"\n  crossorigin="anonymous"></script>`)}
<p>Remember to allow the CDN host in your CSP <code>script-src</code>.</p>
<table><thead><tr><th>File</th><th>SHA-384 (Subresource Integrity)</th></tr></thead><tbody>
${downloads.map((d) => `<tr><td>${d.file}</td><td><code>${d.sri}</code></td></tr>`).join('')}
</tbody></table>
${olderHtml}
<h2 id="source">Source code</h2>
<p>The full source (library, reference server, decryptors for seven languages, MCP server, examples and docs) is on <a href="https://github.com/rmsuthar/pixiformui" rel="noopener noreferrer">GitHub</a>. Issues and pull requests are welcome.</p>
<h2 id="server">Server side</h2>
<p>Password fields arrive encrypted (PFE1). Decrypt them with the helper for your language (Node, Python, Go, C#, Ruby, PHP or Java), and validate with the same shared rules: see <a href="/docs/guide/the-server/">The server</a>, <a href="/docs/encryption/">the encryption spec</a> and <a href="/docs/guide/shared-rules/">shared rules</a>.</p>
<h2 id="licence">Licence and support</h2>
<p>PixiFormUI is released under the MIT licence. Questions or integration help: <a href="mailto:ravindra.suthar@me.com">ravindra.suthar@me.com</a> · <a href="https://www.linkedin.com/in/ravindrasuthar/" rel="me noopener noreferrer">LinkedIn</a>.</p>`,
  toc: [
    { id: 'npm', text: 'npm' },
    { id: 'self-host', text: 'Self-hosted' },
    { id: 'cdn', text: 'CDN with integrity' },
    ...(older.length ? [{ id: 'older', text: 'Older versions' }] : []),
    { id: 'source', text: 'Source code' },
    { id: 'server', text: 'Server side' },
    { id: 'licence', text: 'Licence and support' },
  ],
  kind: 'article',
  crumbs: [{ name: 'Docs', url: '/docs/' }, { name: 'Install', url: '/docs/install/' }],
});
console.log(`install page + /v/${version}/ downloads`);

pages.push({
  url: '/docs/',
  title: 'PixiFormUI documentation',
  nav: 'Docs',
  description: 'Documentation for PixiFormUI: the developer guide, the PFE1 encryption spec for password fields, and notes on the Canvas 2D renderer.',
  html: `<h1>Documentation</h1>
<ul class="doc-cards">
  <li><a href="/docs/install/"><b>Install</b><span>npm, CDN or self-hosted downloads with integrity hashes. MIT licence.</span></a></li>
  <li><a href="/docs/guide/"><b>Developer guide</b><span>Setup, every control, theming, the server, accessibility, analytics, events and MCP, in ${chapters.length} chapters.</span></a></li>
  <li><a href="/docs/encryption/"><b>Encryption spec (PFE1)</b><span>How password fields are encrypted in the browser and decrypted on your server in seven languages.</span></a></li>
  <li><a href="/docs/renderer/"><b>Renderer</b><span>The Canvas 2D scene graph behind every control, and its API for custom controls.</span></a></li>
</ul>`,
  toc: [],
  kind: 'index',
  crumbs: [{ name: 'Docs', url: '/docs/' }],
});

// ------------------------------------------------------------------ layout
function sidebar(current) {
  const top = [
    ['/docs/install/', 'Install'],
    ['/docs/guide/', 'Developer guide'],
    ['/docs/encryption/', 'Encryption (PFE1)'],
    ['/docs/renderer/', 'Renderer'],
  ];
  const chapterLinks = chapters
    .map((c) => {
      const p = pages.find((x) => x.url === c.url);
      return `<li><a href="${c.url}"${c.url === current.url ? ' aria-current="page"' : ''}><span class="num">${c.number}</span>${esc(p.nav)}</a></li>`;
    })
    .join('');
  const tocHtml = current.toc.length
    ? `<div class="toc"><h2>On this page</h2><ul>${current.toc.map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ul></div>`
    : '';
  return `<aside class="docs-side" aria-label="Documentation">
        <h2>Docs</h2>
        <ul>${top.map(([u, n]) => `<li><a href="${u}"${u === current.url ? ' aria-current="page"' : ''}>${n}</a></li>`).join('')}</ul>
        ${tocHtml}
        <div class="chapters-nav">
          <h2>Guide chapters</h2>
          <ul class="chapters">${chapterLinks}</ul>
        </div>
      </aside>`;
}

function jsonLd(p) {
  const crumbs = {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', url: '/' }, ...p.crumbs].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.url })),
  };
  const graph = [crumbs];
  if (p.kind === 'article') {
    graph.push({
      '@type': 'TechArticle',
      headline: p.nav,
      description: p.description,
      url: SITE + p.url,
      inLanguage: 'en',
      dateModified: today,
      image: `${SITE}/og-image.png`,
      isPartOf: { '@type': 'WebSite', name: 'PixiFormUI', url: `${SITE}/` },
      about: { '@type': 'SoftwareApplication', name: 'PixiFormUI' },
    });
  }
  // A data block, not executed, so the strict CSP (no inline scripts) still applies to real scripts.
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`;
}

function layout(p) {
  const pager =
    p.prev || p.next
      ? `<nav class="pager" aria-label="Chapters">${p.prev ? `<a rel="prev" href="${p.prev.url}"><small>Previous</small>${esc(p.prev.name)}</a>` : '<span></span>'}${p.next ? `<a rel="next" href="${p.next.url}"><small>Next</small>${esc(p.next.name)}</a>` : ''}</nav>`
      : '';
  const crumbs = `<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li>${p.crumbs
    .map((c, i) => (i === p.crumbs.length - 1 ? `<li aria-current="page">${esc(c.name)}</li>` : `<li><a href="${c.url}">${esc(c.name)}</a></li>`))
    .join('')}</ol></nav>`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(p.title)}</title>
    <meta name="description" content="${esc(p.description)}" />
    <link rel="canonical" href="${SITE}${p.url}" />
    <meta name="color-scheme" content="light dark" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta name="theme-color" content="#4f46e5" />
    <meta property="og:type" content="${p.kind === 'article' ? 'article' : 'website'}" />
    <meta property="og:site_name" content="PixiFormUI" />
    <meta property="og:title" content="${esc(p.title)}" />
    <meta property="og:description" content="${esc(p.description)}" />
    <meta property="og:url" content="${SITE}${p.url}" />
    <meta property="og:image" content="${SITE}/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="stylesheet" href="/css/site.css" />
    <script src="/js/menu.js" defer></script>
    ${jsonLd(p)}${p.url === '/docs/guide/' ? '\n    <script src="/js/guide-anchors.js" defer></script>' : ''}
  </head>
  <body>
    <a class="skip" href="#content">Skip to content</a>
    <header class="nav">
      <div class="wrap nav-inner">
        <a class="brand" href="/" aria-label="PixiFormUI home"><img src="/favicon.svg" alt="" width="28" height="28" /><span>PixiForm<b>UI</b></span></a>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu" hidden>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path class="l1" d="M4 7h16"/><path class="l2" d="M4 12h16"/><path class="l3" d="M4 17h16"/></svg>
        </button>
        <nav id="site-nav" aria-label="Main">
          <a href="/#features">Features</a>
          <a href="/#demo">Demo</a>
          <a href="/#integrate">Integrate</a>
          <a href="/docs/install/">Install</a>
          <a href="/docs/" aria-current="page">Docs</a>
          <a href="/#contact">Contact</a>
          <a href="https://github.com/rmsuthar/pixiformui" rel="noopener noreferrer">GitHub</a>
        </nav>
      </div>
    </header>
    <div class="wrap docs">
      ${sidebar(p)}
      <main id="content" class="prose">
        ${crumbs}
        ${p.h1 ?? ''}
${p.html}
        ${pager}
      </main>
    </div>
    <footer class="footer"><div class="wrap footer-inner"><span>© 2026 PixiFormUI</span><nav aria-label="Footer"><a href="/">Home</a><a href="/docs/">Docs</a><a href="/#demo">Demo</a><a href="mailto:ravindra.suthar@me.com">ravindra.suthar@me.com</a><a href="https://www.linkedin.com/in/ravindrasuthar/" rel="me noopener noreferrer">LinkedIn</a><a href="https://github.com/rmsuthar/pixiformui" rel="noopener noreferrer">GitHub</a></nav></div></footer>
  </body>
</html>
`;
}

for (const p of pages) {
  const dir = join(out, p.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), layout(p));
}
console.log(`docs: ${pages.length} pages (${chapters.length} guide chapters)`);

// Old single-page links like /docs/guide/#18-accessibility → the chapter page that now holds that anchor.
const moved = {};
for (const [id, t] of anchorPage) if (t.url.startsWith('/docs/guide/') && t.url !== '/docs/guide/') moved[id] = t.isChapter === id ? t.url : `${t.url}#${id}`;
mkdirSync(join(out, 'js'), { recursive: true });
writeFileSync(
  join(out, 'js', 'guide-anchors.js'),
  `(function(){var m=${JSON.stringify(moved)};var h=decodeURIComponent(location.hash.slice(1));if(h&&m[h])location.replace(m[h]);})();\n`,
);

// ------------------------------------------------------------------ sitemap + robots
const urls = ['/', ...pages.map((p) => p.url)];
writeFileSync(
  join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><priority>${u === '/' ? '1.0' : u.split('/').length > 4 ? '0.6' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`,
);
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /404.html\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`sitemap.xml (${urls.length} URLs), robots.txt → dist-site/`);
