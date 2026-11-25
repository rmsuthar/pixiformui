// Browser side of `npm run docs:images`: builds each documented scene with the real library
// (dist-lib/pixiformui.js) so the guide's pictures always match what PixiFormUI draws.
// Each scene renders into #stage; the driver (scripts/doc-images.mjs) screenshots it.
import * as P from '/dist-lib/pixiformui.js';

const stage = document.getElementById('stage');
const T = P.lightTheme;
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const frames = (n = 3) => new Promise((r) => { const f = () => (n-- <= 0 ? r() : requestAnimationFrame(f)); f(); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A canvas with a FormUI, laying `build(ui)` out in a column. Returns { ui, col, el }. */
async function scene(target, width, build, { pad = 24, gap = 20, caption } = {}) {
  const box = document.createElement('figure');
  box.className = 'scene';
  const el = document.createElement('div');
  el.className = 'canvas';
  el.style.width = `${width}px`;
  box.append(el);
  if (caption) {
    const c = document.createElement('figcaption');
    c.textContent = caption;
    box.append(c);
  }
  target.append(box);
  const app = new P.Application();
  await app.init({ width, height: 80, background: T.colors.surface, antialias: true, autoDensity: true, resolution: 2 });
  el.append(app.canvas);
  const ui = new P.FormUI(app, { theme: T, host: el });
  app.stage.addChild(ui);
  const items = await build(ui);
  const col = new P.Column(items, gap);
  col.position.set(pad, pad);
  ui.content.addChild(col);
  let fitting = false;
  const fit = () => {
    if (fitting) return; // layout() itself emits 'resize'
    fitting = true;
    col.layout(width - pad * 2);
    app.renderer.resize(width, Math.ceil(col.layoutHeight + pad * 2));
    fitting = false;
  };
  fit();
  col.on('resize', fit);
  await frames();
  return { ui, col, el, app, fit };
}

/** Dashed outlines with labels over a scene (coordinates in canvas px). */
function annotate(el, boxes) {
  el.style.position = 'relative';
  for (const b of boxes) {
    const d = document.createElement('div');
    d.className = `note ${b.tone ?? ''}`;
    Object.assign(d.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
    if (b.label) {
      const s = document.createElement('span');
      s.textContent = b.label;
      if (b.labelSide === 'left') s.classList.add('left');
      d.append(s);
    }
    el.append(d);
  }
}

const bounds = (c) => {
  const b = c.getBounds();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
};
const type = (c, text) => {
  for (const ch of text) c.handleText(ch);
};
const row = () => {
  const r = document.createElement('div');
  r.className = 'row';
  stage.append(r);
  return r;
};

export const scenes = {
  // ------------------------------------------------------------------ controls
  async 'controls/anatomy'() {
    const { el } = await scene(stage, 460, (ui) => {
      const c = new P.TextInput(ui, { name: 'email', label: 'Email', required: true, info: 'We never share it.', helperText: 'We send the receipt here.', placeholder: 'you@example.com' });
      window.__c = c;
      return [c];
    }, { pad: 28 });
    const c = window.__c;
    const b = bounds(c);
    const hh = c.headerHeight();
    const bh = c.bodyHeight();
    el.classList.add('wide-notes');
    annotate(el, [
      { x: b.x - 6, y: b.y - 4, w: b.w + 12, h: hh + 2, label: 'label · required * · ⓘ info', tone: 'a' },
      { x: b.x - 6, y: b.y + hh - 1, w: b.w + 12, h: bh + 2, label: 'body (the input itself)', tone: 'b' },
      { x: b.x - 6, y: b.y + hh + bh + 2, w: b.w + 12, h: b.h - hh - bh, label: 'helper text, or the error', tone: 'c' },
    ]);
  },
  async 'controls/text-input'() {
    await scene(stage, 520, (ui) => {
      const empty = new P.TextInput(ui, { name: 'name', label: 'Full name', placeholder: 'Ada Lovelace', required: true });
      const filled = new P.TextInput(ui, { name: 'company', label: 'Company', helperText: 'Optional.' });
      type(filled, 'Analytical Engines Ltd');
      const bad = new P.TextInput(ui, { name: 'email', label: 'Email', required: true });
      type(bad, 'ada@');
      bad.touched = true;
      bad.setError('Enter a valid email address.');
      return [empty, filled, bad];
    });
  },
  async 'controls/textarea'() {
    await scene(stage, 520, (ui) => {
      const t = new P.TextArea(ui, { name: 'message', label: 'Message', rows: 4, maxLength: 500, helperText: 'Up to 500 characters.' });
      type(t, 'Hello! I’d like a demo for our team of twelve.\nThursday afternoon works best.');
      return [t];
    });
  },
  async 'controls/password'() {
    await scene(stage, 520, (ui) => {
      const pw = new P.PasswordInput(ui, { name: 'password', label: 'Password', required: true });
      const meter = new P.StrengthMeter(ui);
      pw.on('change', (s) => meter.update(s));
      type(pw, 'Tr0ub4dor&Horse');
      const shown = new P.PasswordInput(ui, { name: 'shown', label: 'Revealed with the eye button', revealTimeoutMs: 0 });
      type(shown, 'correct-horse');
      shown.setRevealed(true);
      return [pw, meter, shown];
    });
  },
  async 'controls/choices'() {
    await scene(stage, 520, (ui) => {
      const a = new P.Checkbox(ui, { name: 'terms', label: 'I agree to the terms', required: true });
      const b = new P.Checkbox(ui, { name: 'news', label: 'Send me product updates', checked: true });
      const s1 = new P.Switch(ui, { name: 'dark', label: 'Dark mode' });
      const s2 = new P.Switch(ui, { name: 'notify', label: 'Notifications', value: true });
      return [a, b, s1, s2];
    }, { gap: 14 });
  },
  async 'controls/radio'() {
    await scene(stage, 520, (ui) => {
      const v = new P.RadioGroup(ui, { name: 'plan', label: 'Plan', value: 'pro', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'team', label: 'Team' }] });
      const h = new P.RadioGroup(ui, { name: 'contact', label: 'Contact me by', value: 'email', direction: 'horizontal', options: [{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }, { value: 'post', label: 'Post' }] });
      return [v, h];
    });
  },
  async 'controls/select'() {
    const r = row();
    await scene(r, 340, (ui) => [new P.Select(ui, { name: 'country', label: 'Country', placeholder: 'Choose a country', options: ['India', 'United Kingdom', 'United States', 'Germany', 'Japan'].map((c) => ({ value: c, label: c })) })], { caption: 'Closed' });
    const { col, fit } = await scene(r, 340, (ui) => {
      const s = new P.Select(ui, { name: 'size', label: 'Team size', value: '11-50', options: [{ value: '1-10', label: '1–10' }, { value: '11-50', label: '11–50' }, { value: '51-200', label: '51–200' }, { value: '201+', label: '201 or more' }] });
      window.__s = s;
      return [s, P.Column.spacer(150)];
    }, { caption: 'Open: keyboard, type-ahead, wheel and touch' });
    window.__s.setOpen(true);
    fit();
    await frames(8);
    void col;
  },
  async 'controls/slider'() {
    await scene(stage, 520, (ui) => [
      new P.Slider(ui, { name: 'budget', label: 'Monthly budget', min: 0, max: 5000, step: 100, value: 1800, format: (v) => `$${v.toLocaleString('en-US')}` }),
      new P.Slider(ui, { name: 'years', label: 'Years of experience', min: 0, max: 40, value: 6 }),
    ]);
  },
  async 'controls/buttons'() {
    await scene(stage, 660, (ui) => [
      new P.Row(['primary', 'secondary', 'outline', 'ghost', 'danger'].map((v) => new P.Button(ui, { name: v, text: v[0].toUpperCase() + v.slice(1), variant: v })), 10, 0),
      new P.Row([(() => { const b = new P.Button(ui, { name: 'busy', text: 'Saving…' }); b.loading = true; return b; })(), new P.Button(ui, { name: 'off', text: 'Disabled', disabled: true })], 10, 0),
    ], { gap: 14 });
  },
  async 'controls/otp'() {
    await scene(stage, 520, (ui) => {
      const o = new P.OtpInput(ui, { name: 'code', label: 'Verification code', length: 6, groupSize: 3, helperText: 'Pasting “123-456” fills every box.' });
      type(o, '123');
      return [o];
    });
  },
  async 'controls/date'() {
    const r = row();
    await scene(r, 360, (ui) => {
      return [new P.DatePicker(ui, { name: 'when', label: 'Date and time', time: { step: 30, defaultTime: '10:00' }, value: '2026-12-04T10:30' })];
    }, { caption: 'Closed' });
    const { fit } = await scene(r, 360, (ui) => {
      const d = new P.DatePicker(ui, { name: 'dob', label: 'Date of birth', value: '2026-12-04' });
      window.__d = d;
      return [d, P.Column.spacer(330)];
    }, { caption: 'Open: arrows, PageUp/PageDown, month and year views' });
    window.__d.setOpen(true);
    fit();
    await frames(8);
  },
  async 'controls/phone'() {
    await scene(stage, 520, (ui) => {
      const p = new P.PhoneInput(ui, { name: 'phone', label: 'Mobile', defaultCountry: 'IN', preferredCountries: ['IN', 'US', 'GB'] });
      window.__p = p;
      return [p];
    });
    const p = window.__p;
    const num = p.children.find?.((x) => x?.fieldName === 'phone-number') ?? null;
    void num;
    p.setValue('+919876543210');
    await frames(4);
  },
  async 'controls/humancheck'() {
    await scene(stage, 520, (ui) => [new P.HumanCheck(ui, { name: 'human', label: 'Quick check' })]);
  },

  // ------------------------------------------------------------------ layout
  async 'layout/column'() {
    const { el, col } = await scene(stage, 460, (ui) => [
      new P.TextInput(ui, { name: 'a', label: 'First item', placeholder: 'Column([a, b, c], 20)' }),
      new P.TextInput(ui, { name: 'b', label: 'Second item' }),
      new P.TextInput(ui, { name: 'c', label: 'Third item' }),
    ], { pad: 28, gap: 20 });
    const items = col.children.filter((c) => c.visible && c.layoutHeight);
    annotate(el, items.map((c, i) => ({ ...grow(bounds(c), 6), label: i === 0 ? 'item (full width)' : '', tone: 'b' })));
    const gaps = [];
    for (let i = 1; i < items.length; i++) {
      const a = bounds(items[i - 1]);
      const b = bounds(items[i]);
      gaps.push({ x: a.x + a.w - 70, y: a.y + a.h, w: 64, h: b.y - (a.y + a.h), label: 'gap', tone: 'gap' });
    }
    annotate(el, gaps);
  },
  async 'layout/row'() {
    const r = row();
    const build = (ui) => [new P.Row([new P.TextInput(ui, { name: 'first', label: 'First name' }), new P.TextInput(ui, { name: 'last', label: 'Last name' })], 16, 480)];
    const wide = await scene(r, 560, build, { caption: '560 px: side by side (equal widths, 16 px gap)' });
    await scene(r, 340, build, { caption: '340 px: below the 480 px breakpoint, stacked' });
    const rowEl = wide.col.children[0];
    annotate(wide.el, rowEl.children.filter((c) => c.layoutHeight).map((c) => ({ ...grow(bounds(c), 5), tone: 'b' })));
  },
  async 'layout/groups'() {
    await scene(stage, 540, (ui) => {
      const mk = (variant, title, description) =>
        new P.FieldGroup(ui, { name: variant, title, description, variant }).add(new P.Row([new P.TextInput(ui, { name: `${variant}1`, label: 'City' }), new P.TextInput(ui, { name: `${variant}2`, label: 'Postcode' })], 16, 420));
      return [mk('outline', 'variant: "outline" (default)', 'A bordered section.'), mk('card', 'variant: "card"', 'A raised card.'), mk('plain', 'variant: "plain"', 'A heading and a divider.')];
    }, { gap: 24 });
  },
  async 'layout/group-states'() {
    const r = row();
    await scene(r, 360, (ui) => {
      const g = new P.FieldGroup(ui, { name: 'prefs', title: 'Preferences', description: 'Optional.', collapsible: true, collapsed: true });
      g.add(new P.Switch(ui, { name: 'n', label: 'Newsletter' }));
      return [g];
    }, { caption: 'collapsible: true, folded' });
    await scene(r, 360, (ui) => {
      const g = new P.FieldGroup(ui, { name: 'billing', title: 'Billing', collapsible: true });
      const vat = new P.TextInput(ui, { name: 'vat', label: 'VAT number', required: true });
      vat.touched = true;
      vat.setError('VAT number is required.');
      g.add(vat);
      return [g];
    }, { caption: 'An error inside: badge and red border' });
  },

  // ------------------------------------------------------------------ widgets
  async 'widgets/labels'() {
    await scene(stage, 520, (ui) => [
      new P.Label(ui, "Label: 'title'", 'title'),
      new P.Label(ui, "Label: 'subtitle', for a line under the title.", 'subtitle'),
      new P.Label(ui, "Label: 'body'. Wraps to the available width and never interprets HTML, so <b>tags</b> stay text.", 'body'),
      new P.Label(ui, "Label: 'caption', for fine print.", 'caption'),
    ], { gap: 12 });
  },
  async 'widgets/strength'() {
    await scene(stage, 520, (ui) => {
      const out = [];
      for (const s of ['abc', 'summer24', 'Summer-2024!', 'Tr0ub4dor&Horse!26']) {
        const pw = new P.PasswordInput(ui, { name: `p${out.length}`, label: '', hideLabel: true, revealTimeoutMs: 0 });
        const m = new P.StrengthMeter(ui);
        pw.on('change', (sec) => m.update(sec));
        type(pw, s);
        pw.setRevealed(true);
        out.push(pw, m);
      }
      return out;
    }, { gap: 10 });
    await wait(500); // meters animate
  },
  async 'widgets/toast'() {
    const r = row();
    for (const [kind, msg] of [['info', 'Draft saved.'], ['success', 'Account created.'], ['error', 'Could not send. Try again.']]) {
      const { ui } = await scene(r, 300, (u) => [P.Column.spacer(64)], { pad: 12 });
      new P.Toast(ui).show(msg, kind, 60_000);
    }
    await wait(700);
  },
  async 'widgets/privacy'() {
    const r = row();
    await scene(r, 340, (ui) => [new P.TextInput(ui, { name: 'card', label: 'Card number' }), new P.Button(ui, { name: 'pay', text: 'Pay' })], { caption: 'Window focused' });
    const { ui } = await scene(r, 340, (u) => [new P.TextInput(u, { name: 'card2', label: 'Card number' }), new P.Button(u, { name: 'pay2', text: 'Pay' })], { caption: 'Window switched away: covered' });
    const p = new P.PrivacyScreen(ui);
    p.show();
    await wait(300);
  },

  // ------------------------------------------------------------------ conditional fields (mounted from config)
  async 'conditional/before-after'() {
    const r = row();
    const fields = [
      { type: 'radio', name: 'contact', label: 'Contact me by', value: 'email', direction: 'horizontal', options: [{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }] },
      { type: 'email', name: 'email', label: 'Email', showIf: { field: 'contact', equals: 'email' } },
      { type: 'phone', name: 'phone', label: 'Mobile', defaultCountry: 'IN', showIf: { field: 'contact', equals: 'phone' } },
      { type: 'switch', name: 'business', label: 'Buying for a business' },
      { type: 'group', title: 'Company', showIf: { field: 'business', equals: true }, fields: [{ type: 'text', name: 'company', label: 'Company name' }] },
    ];
    const mount = async (caption, after) => {
      const box = document.createElement('figure');
      box.className = 'scene';
      const host = document.createElement('div');
      host.className = 'canvas';
      host.style.width = '380px';
      const cap = document.createElement('figcaption');
      cap.textContent = caption;
      box.append(host, cap);
      r.append(box);
      const h = await P.mountPixiForm(host, { fields, card: false, theme: T, submitText: 'Send', onSubmit: () => ({ ok: true }), privacyScreen: false });
      await h.loaded;
      if (after) {
        h.get('contact').setValue('phone');
        h.get('business').setValue(true);
      }
      await frames(6);
    };
    await mount('Email chosen, not a business', false);
    await mount('Phone chosen, business: the fields swap, the group appears', true);
  },
};

function grow(b, n) {
  return { x: b.x - n, y: b.y - n, w: b.w + n * 2, h: b.h + n * 2 };
}

export async function render(name) {
  stage.replaceChildren();
  await document.fonts.ready;
  await scenes[name]();
  await frames(4);
}

document.documentElement.style.setProperty('--surface', hex(T.colors.surface));
window.__docImages = { render, names: Object.keys(scenes) };
