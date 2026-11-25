/**
 * Server-side rendering helpers. PixiFormUI draws on a canvas, so the form itself can only render
 * in the browser; on the server, render a lightweight skeleton in its place:
 *
 *   // server (Next.js, Remix, Astro, Express…): safe to import, no DOM needed
 *   import { pixiformSkeleton, PIXIFORM_SKELETON_CSS } from 'pixiformui/ssr';
 *   html = `<div id="signup">${pixiformSkeleton(config)}</div>`;   // + PIXIFORM_SKELETON_CSS in your CSS
 *
 *   // browser
 *   mountPixiForm(document.getElementById('signup'), config);       // replaces the skeleton on its first frame
 *
 * The skeleton has the form's title, labels and button, sized like the real controls, so the page
 * doesn't jump when the form appears, and visitors without JavaScript (and crawlers) still see what
 * the form asks for. It uses classes only (no inline styles), so it works under a strict CSP.
 */
import { evaluateCondition, type ConditionField, type ShowIf } from './conditions';

/** The parts of a form config the skeleton reads (a full PixiFormConfig works). */
export interface SkeletonConfig {
  title?: string;
  subtitle?: string;
  /** Field configs (FieldConfig[]); read loosely, see SkeletonField. */
  fields: readonly object[];
  submitText?: string;
  resetText?: string;
  maxWidth?: number;
  card?: boolean;
}

/** What the skeleton reads from each field config. */
export interface SkeletonField {
  type: string;
  name?: string;
  label?: string;
  title?: string;
  description?: string;
  text?: string;
  row?: string;
  rows?: number;
  value?: unknown;
  checked?: boolean;
  options?: readonly unknown[];
  direction?: string;
  fields?: readonly SkeletonField[];
  strengthMeter?: boolean;
  required?: boolean;
  showIf?: ShowIf;
  hideLabel?: boolean;
  [key: string]: unknown;
}

export interface SkeletonOptions {
  /** Shown to visitors without JavaScript. Default: "This form needs JavaScript. Please enable it to continue." */
  noScriptMessage?: string;
}

const WIDTHS = [360, 420, 480, 520, 560, 600, 640, 720, 800, 960];

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Initial values from the config, so showIf rules can be resolved like the first frame. */
function initialValues(fields: readonly SkeletonField[], out = new Map<string, ConditionField>()): Map<string, ConditionField> {
  for (const f of fields) {
    if (f.type === 'group') initialValues(f.fields ?? [], out);
    else if (f.name) {
      const v = f.type === 'checkbox' || f.type === 'switch' ? !!(f.checked ?? f.value) : (f.value ?? null);
      out.set(f.name, { value: v, empty: v === null || v === '' || v === false });
    }
  }
  return out;
}

function shown(f: SkeletonField, values: Map<string, ConditionField>): boolean {
  if (f.showIf === undefined) return true;
  try {
    if (typeof f.showIf === 'function') {
      const plain: Record<string, unknown> = {};
      for (const [k, v] of values) plain[k] = v.value;
      return !!f.showIf(plain);
    }
    return evaluateCondition(f.showIf, (n) => values.get(n));
  } catch {
    return true;
  }
}

function label(f: SkeletonField): string {
  if (f.hideLabel || !f.label) return '';
  return `<span class="pf-skel-label">${esc(f.label)}${f.required ? ' *' : ''}</span>`;
}

function field(f: SkeletonField, values: Map<string, ConditionField>): string {
  if (f.type === 'hidden' || !shown(f, values)) return '';
  switch (f.type) {
    case 'group': {
      const inner = list(f.fields ?? [], values);
      const desc = f.description ? `<span class="pf-skel-desc">${esc(f.description)}</span>` : '';
      return `<div class="pf-skel-group"><span class="pf-skel-group-title">${esc(f.title ?? '')}</span>${desc}${inner}</div>`;
    }
    case 'heading':
      return `<span class="pf-skel-heading">${esc(f.text)}</span>`;
    case 'paragraph':
      return `<span class="pf-skel-text">${esc(f.text)}</span>`;
    case 'checkbox':
    case 'switch':
      return `<div class="pf-skel-inline"><span class="pf-skel-${f.type}"></span><span class="pf-skel-label">${esc(f.label)}${f.required ? ' *' : ''}</span></div>`;
    case 'radio': {
      const n = Math.min(8, f.options?.length ?? 2);
      const opts = f.direction === 'horizontal' ? '<span class="pf-skel-choices"></span>' : '<span class="pf-skel-choice"></span>'.repeat(n);
      return `<div class="pf-skel-field">${label(f)}${opts}</div>`;
    }
    case 'textarea': {
      const rows = Math.max(2, Math.min(8, Math.round(Number(f.rows) || 3)));
      return `<div class="pf-skel-field">${label(f)}<span class="pf-skel-box pf-skel-rows${rows}"></span></div>`;
    }
    case 'slider':
      return `<div class="pf-skel-field">${label(f)}<span class="pf-skel-track"></span></div>`;
    case 'humancheck':
      return `<div class="pf-skel-field">${label({ ...f, label: f.label ?? 'Human check', required: true })}<span class="pf-skel-box pf-skel-slide"></span></div>`;
    case 'otp':
      return `<div class="pf-skel-field">${label(f)}<span class="pf-skel-box pf-skel-otp"></span></div>`;
    default: {
      const meter = f.type === 'password' && f.strengthMeter ? '<span class="pf-skel-meter"></span><span class="pf-skel-hint"></span>' : '';
      return `<div class="pf-skel-field">${label(f)}<span class="pf-skel-box"></span>${meter}</div>`;
    }
  }
}

function list(fields: readonly SkeletonField[], values: Map<string, ConditionField>): string {
  let html = '';
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.row) {
      // Consecutive fields with the same row key sit side by side.
      const row: SkeletonField[] = [];
      while (i < fields.length && fields[i].row === f.row) row.push(fields[i++]);
      i--;
      const cells = row.map((x) => field(x, values)).filter(Boolean);
      if (cells.length) html += `<div class="pf-skel-row">${cells.map((c) => `<div class="pf-skel-cell">${c}</div>`).join('')}</div>`;
    } else html += field(f, values);
  }
  return html;
}

/**
 * HTML for a server-rendered placeholder of the form. Put it inside the element you'll mount the
 * form on; mountPixiForm() removes it on the first frame. Include PIXIFORM_SKELETON_CSS in your CSS.
 */
export function pixiformSkeleton(config: SkeletonConfig, opts: SkeletonOptions = {}): string {
  const fields = (config.fields ?? []) as readonly SkeletonField[];
  const values = initialValues(fields);
  // The next width step up (a placeholder shouldn't be narrower than the real form).
  const width = WIDTHS.find((w) => w >= (config.maxWidth ?? 640)) ?? WIDTHS[WIDTHS.length - 1];
  const head =
    (config.title ? `<span class="pf-skel-title">${esc(config.title)}</span>` : '') +
    (config.subtitle ? `<span class="pf-skel-subtitle">${esc(config.subtitle)}</span>` : '');
  const buttons = config.resetText
    ? `<div class="pf-skel-row"><div class="pf-skel-cell"><span class="pf-skel-button pf-skel-outline">${esc(config.resetText)}</span></div><div class="pf-skel-cell"><span class="pf-skel-button">${esc(config.submitText ?? 'Submit')}</span></div></div>`
    : `<span class="pf-skel-button">${esc(config.submitText ?? 'Submit')}</span>`;
  const msg = opts.noScriptMessage ?? 'This form needs JavaScript. Please enable it to continue.';
  return (
    `<div class="pf-skel pf-skel-w${width}${config.card === false ? ' pf-skel-flat' : ''}" data-pixiform-skeleton aria-busy="true">` +
    `<div class="pf-skel-card">${head}${list(fields, values)}${buttons}</div>` +
    `<noscript><p class="pf-skel-noscript">${esc(msg)}</p></noscript>` +
    `</div>`
  );
}

/** Styles for pixiformSkeleton(): add to your stylesheet (or a <style> tag with your CSP nonce). */
export const PIXIFORM_SKELETON_CSS = `
.pf-skel{--pf-bg:#fff;--pf-line:#dde2ea;--pf-fill:#eef1f5;--pf-text:#111827;--pf-muted:#5b6577;--pf-accent:#4f46e5;padding:16px;font:14px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--pf-text)}
@media (prefers-color-scheme:dark){.pf-skel{--pf-bg:#1a1f29;--pf-line:#343c4c;--pf-fill:#232a36;--pf-text:#e5e7eb;--pf-muted:#9aa3b2;--pf-accent:#818cf8}}
.pf-skel-card{box-sizing:border-box;margin:0 auto;max-width:640px;padding:28px;background:var(--pf-bg);border:1px solid var(--pf-line);border-radius:16px;display:flex;flex-direction:column;gap:20px}
.pf-skel-flat .pf-skel-card{padding:0;border:0;background:none}
${WIDTHS.map((w) => `.pf-skel-w${w} .pf-skel-card{max-width:${w}px}`).join('')}
.pf-skel-title{font-size:22px;font-weight:700;line-height:32px}
.pf-skel-subtitle,.pf-skel-desc,.pf-skel-text{color:var(--pf-muted)}
.pf-skel-subtitle{margin-top:-8px}
.pf-skel-heading{font-size:18px;font-weight:600}
.pf-skel-field{display:flex;flex-direction:column;gap:6px}
.pf-skel-label{font-size:13px;font-weight:600;line-height:20px}
.pf-skel-box{display:block;height:44px;border:1px solid var(--pf-line);border-radius:10px;background:var(--pf-bg)}
.pf-skel-rows2{height:64px}.pf-skel-rows3{height:86px}.pf-skel-rows4{height:108px}.pf-skel-rows5{height:130px}.pf-skel-rows6{height:152px}.pf-skel-rows7{height:174px}.pf-skel-rows8{height:196px}
.pf-skel-slide{height:44px;background:var(--pf-fill)}
.pf-skel-otp{height:52px;border:0;background:none}
.pf-skel-meter{display:block;height:4px;margin-top:14px;border-radius:2px;background:var(--pf-fill)}
.pf-skel-hint{display:block;height:18px;margin-top:2px}
.pf-skel-track{display:block;height:4px;margin:14px 0;border-radius:2px;background:var(--pf-fill)}
.pf-skel-choices{display:block;height:28px}
.pf-skel-choice{display:block;height:26px}
.pf-skel-inline{display:flex;align-items:center;gap:10px;min-height:28px}
.pf-skel-checkbox{width:20px;height:20px;border:2px solid var(--pf-line);border-radius:5px;box-sizing:border-box}
.pf-skel-switch{order:2;margin-left:auto;width:44px;height:26px;border-radius:13px;background:var(--pf-fill)}
.pf-skel-group{display:flex;flex-direction:column;gap:18px;padding:20px;border:1px solid var(--pf-line);border-radius:14px}
.pf-skel-group-title{font-size:16px;font-weight:600}
.pf-skel-group-title+.pf-skel-desc{margin-top:-16px;font-size:12px}
.pf-skel-row{display:flex;gap:16px}
.pf-skel-cell{flex:1;min-width:0;display:flex;flex-direction:column}
@media (max-width:560px){.pf-skel-row{flex-direction:column;gap:20px}}
.pf-skel-button{display:flex;align-items:center;justify-content:center;height:44px;border-radius:10px;background:var(--pf-accent);color:#fff;font-weight:600}
.pf-skel-outline{background:none;color:var(--pf-text);border:1px solid var(--pf-line)}
.pf-skel-noscript{margin:12px auto 0;max-width:640px;color:var(--pf-muted);text-align:center}
@media (prefers-reduced-motion:no-preference){.pf-skel .pf-skel-box,.pf-skel .pf-skel-button{animation:pf-skel-pulse 1.6s ease-in-out infinite}}
@keyframes pf-skel-pulse{50%{opacity:.6}}
`.trim();
