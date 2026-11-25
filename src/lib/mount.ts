/**
 * Framework-agnostic embedding API.
 *
 *   const handle = await mountPixiForm(document.getElementById('signup')!, {
 *     title: 'Create account',
 *     fields: [
 *       { type: 'text', name: 'name', label: 'Name', required: true, row: 'a' },
 *       { type: 'email', name: 'email', label: 'Email', required: true, row: 'a' },
 *       { type: 'group', title: 'Security', collapsible: true, fields: [
 *         { type: 'password', name: 'password', label: 'Password', required: true, strengthMeter: true },
 *       ] },
 *     ],
 *     submitText: 'Sign up',
 *     onSubmit: async (values) => ({ ok: true }),
 *   });
 *   // later: handle.destroy();
 *
 * Works in plain HTML, React, Angular, Vue, Svelte… (see docs/DEVELOPER_GUIDE.md §23).
 */
import { Application, Container, Graphics } from './render/canvas';
import { Button } from './controls/Button';
import { Checkbox, type CheckboxOptions } from './controls/Checkbox';
import { DatePicker, type DatePickerOptions } from './controls/DatePicker';
import { PhoneInput, type PhoneInputOptions } from './controls/PhoneInput';
import { OtpInput, type OtpInputOptions } from './controls/OtpInput';
import { PasswordInput, type PasswordInputOptions } from './controls/PasswordInput';
import { RadioGroup, type RadioGroupOptions } from './controls/RadioGroup';
import { Select, type SelectOptions } from './controls/Select';
import { Slider, type SliderOptions } from './controls/Slider';
import { HumanCheck, type HumanCheckOptions } from './controls/HumanCheck';
import { HiddenField, type HiddenFieldOptions } from './controls/HiddenField';
import { conditionFields, evaluateCondition, type ShowIf } from './conditions';
import { Switch, type SwitchOptions } from './controls/Switch';
import { TextArea, TextInput, type TextAreaOptions, type TextInputOptions } from './controls/TextInput';
import type { Control } from './core/Control';
import { FormUI } from './core/FormUI';
import type { Focusable } from './core/types';
import { FormAnalytics, type AnalyticsOptions } from './analytics';
import type { A11yOptions } from './core/a11yPrefs';
import { FieldGroup, type FieldGroupOptions } from './FieldGroup';
import {
  FormEvents,
  type LoadState,
  type PixiFormEventMap,
  type PixiFormEventType,
  type PixiFormListener,
  type PixiFormListeners,
} from './events';
import { Form, type FormOptions, type FormValues, type SubmitResult } from './Form';
import { Column, Row, ScrollView, type Layoutable } from './layout';
import type { Secret } from './security/Secret';
import type { EncryptionKey } from './security/envelope';
import { secureSubmit, type SecureSubmitOptions } from './security/secureSubmit';
import { FormProof, type PowChallenge } from './security/proof';
import { Formatters } from './security/formatters';
import {
  accentPalettes,
  createFormTheme,
  darkTheme,
  lightTheme,
  presetTheme,
  type AccentName,
  type FormPalette,
  type Theme,
} from './theme';
import { Label, PrivacyScreen, StrengthMeter, Toast } from './widgets';

// ------------------------------------------------------------------ config types
type WithRow<T> = T & {
  /** Fields sharing the same `row` key are placed side by side (stacked on narrow screens). */
  row?: string;
  /**
   * Show this field (or group, heading, paragraph) only when the condition holds, e.g.
   * `{ field: 'contact', equals: 'phone' }`. While hidden it isn't validated or submitted.
   */
  showIf?: ShowIf;
};

export type FieldConfig =
  | WithRow<{ type: 'text' | 'email' | 'tel' | 'url' | 'number' } & TextInputOptions>
  | WithRow<{ type: 'textarea' } & TextAreaOptions>
  | WithRow<{ type: 'password'; strengthMeter?: boolean } & PasswordInputOptions>
  | WithRow<{ type: 'otp' } & OtpInputOptions>
  | WithRow<{ type: 'checkbox' } & CheckboxOptions>
  | WithRow<{ type: 'switch' } & SwitchOptions>
  | WithRow<{ type: 'radio' } & RadioGroupOptions<string>>
  | WithRow<{ type: 'select' } & SelectOptions<string>>
  | WithRow<{ type: 'slider' } & SliderOptions>
  | WithRow<{ type: 'humancheck' } & HumanCheckOptions>
  | WithRow<{ type: 'hidden' } & HiddenFieldOptions>
  | WithRow<{ type: 'date' } & DatePickerOptions>
  | WithRow<{ type: 'phone' } & PhoneInputOptions>
  | WithRow<{ type: 'heading' | 'paragraph'; text: string }>
  | WithRow<GroupConfig>;

/** A titled section of fields (a fieldset). Values still submit with flat field names. */
export interface GroupConfig extends FieldGroupOptions {
  type: 'group';
  fields: FieldConfig[];
}

/** A full Theme, a palette, or a preset accent name. */
export type ThemeInput = Theme | FormPalette | AccentName;

export interface PixiFormConfig {
  /** Identifies the form (analytics `formId`, default accessible name fallback). */
  id?: string;
  fields: FieldConfig[];
  /** Your submit handler. Optional when `action` is set. */
  onSubmit?: FormOptions['onSubmit'];
  /**
   * Submit without code: POSTs `form.serialize()` as JSON to this URL with the
   * hardened secureSubmit(), encrypting password fields. The server replies
   * `{ ok, message?, fieldErrors?, challenge? }`; fieldErrors appear under the fields.
   */
  action?: string;
  /**
   * URL returning `{ csrfToken, encryption }` (like the reference server's /api/session).
   * Fetched before the first submit and again once after a 403 (expired session).
   */
  session?: string;
  /** Static alternatives to `session`. */
  csrfToken?: string;
  encryptionKey?: EncryptionKey;
  /** Extra secureSubmit options for `action` (headers, allowedOrigins, timeoutMs). */
  submitOptions?: Omit<SecureSubmitOptions, 'csrfToken'>;
  /**
   * Optional CAPTCHA for `action` submits: return a fresh token from Turnstile, hCaptcha… (it's
   * sent as X-Captcha-Token for your server to verify). The library loads no third-party script.
   */
  captcha?: () => Promise<string>;
  title?: string;
  subtitle?: string;
  submitText?: string;
  /** Show a reset button with this text. */
  resetText?: string;
  theme?: ThemeInput;
  /** 'auto' follows prefers-color-scheme live. Ignored when `theme` is a full Theme. Default 'auto'. */
  mode?: 'light' | 'dark' | 'auto';
  /**
   * 'auto' (default): the canvas grows with the form and the PAGE scrolls (best for embedding).
   * 'fill': the canvas fills the host element and scrolls internally (give the host a height).
   */
  layout?: 'auto' | 'fill';
  /** Max form width in px; the form is centred. Default 640. */
  maxWidth?: number;
  /** Draw a card behind the form. Default true. */
  card?: boolean;
  /** Transparent canvas so the host page shows through. Default true in 'auto' layout. */
  transparent?: boolean;
  /** Cover the form when the window loses focus. Default true. */
  privacyScreen?: boolean;
  /** Show toasts for success/failure messages. Default true. */
  toasts?: boolean;
  /** Extra Form options (rate limit, bot guard, autovalidate, idle timeout, wipe policy). */
  form?: Omit<FormOptions, 'onSubmit'>;
  /**
   * Event listeners registered before mounting starts, so early events (`loadstart`,
   * `load`, `error` while loading) are never missed: `{ load(e) {…}, change(e) {…} }`.
   */
  on?: PixiFormListeners;
  /**
   * When to build the UI. 'eager' (default): now. 'visible': when the host comes within
   * `loadMargin` of the viewport (good for long pages). 'idle': when the browser is idle.
   * The host's `data-pixiform-state` attribute is 'waiting' → 'loading' → 'ready' (or 'error'),
   * so CSS can show a placeholder.
   */
  load?: 'eager' | 'visible' | 'idle';
  /** Root margin for `load: 'visible'`. Default '200px'. */
  loadMargin?: string;
  /** Accessibility: name, system-setting overrides, text scale, outline. Defaults follow the OS. */
  a11y?: A11yOptions;
  /** Privacy-safe analytics events (never values). See analyticsAdapters for GA4, GTM, Segment, PostHog… */
  analytics?: AnalyticsOptions;
}

export interface PixiFormHandle {
  readonly app: Application;
  readonly ui: FormUI;
  readonly form: Form;
  readonly controls: Readonly<Record<string, Control<any>>>;
  /** Analytics tracker (null without `config.analytics`). Use `analytics.track()` for custom events. */
  readonly analytics: FormAnalytics | null;
  /** Field groups by name (auto names are group1, group2… in config order). */
  readonly groups: Readonly<Record<string, FieldGroup>>;
  get<T extends Control<any> = Control<any>>(name: string): T | undefined;
  values(): FormValues;
  submit(): Promise<SubmitResult | null>;
  reset(): void;
  setTheme(theme: ThemeInput, mode?: 'light' | 'dark' | 'auto'): void;
  toast(message: string, kind?: 'info' | 'success' | 'error'): void;
  /** Subscribe to an event (typed payloads, see PixiFormEventMap). Returns an unsubscribe function. */
  on<K extends PixiFormEventType>(type: K, fn: PixiFormListener<K>): () => void;
  once<K extends PixiFormEventType>(type: K, fn: PixiFormListener<K>): () => void;
  /** The underlying emitter (on/once/off/emit). */
  readonly events: FormEvents;
  /** 'loading' until the first frame is painted, then 'ready'; 'destroyed' after destroy(). */
  readonly state: LoadState;
  /** Resolves with the `load` event's payload once the first frame is painted. */
  readonly loaded: Promise<PixiFormEventMap['load']>;
  /** True after the first user edit since load or the last reset. */
  isDirty(): boolean;
  /**
   * Shows or hides a field or group from code, overriding its showIf rule; `null` hands control
   * back to the rule. Hidden fields aren't validated or submitted, and keep their value.
   */
  setVisible(name: string, visible: boolean | null): void;
  /** True if the field or group is currently shown (false inside a hidden group). */
  isVisible(name: string): boolean;
  destroy(): void;
}

// ------------------------------------------------------------------ theme resolution
function resolveTheme(input: ThemeInput | undefined, mode: 'light' | 'dark'): Theme {
  if (!input) return mode === 'dark' ? darkTheme : lightTheme;
  if (typeof input === 'string') {
    if (!(input in accentPalettes)) throw new Error(`Unknown accent preset "${input}"`);
    return presetTheme(input, mode);
  }
  if ('colors' in input && 'fontSize' in input) return input as Theme;
  const palette = input as FormPalette;
  return createFormTheme({ ...palette, mode: palette.mode ?? mode });
}

// ------------------------------------------------------------------ mount
export async function mountPixiForm(host: HTMLElement, config: PixiFormConfig): Promise<PixiFormHandle> {
  if (!(host instanceof HTMLElement)) throw new Error('mountPixiForm: host must be an HTMLElement');
  const events = new FormEvents();
  events.addAll(config.on);
  const setState = (s: LoadState) => {
    host.dataset.pixiformState = s;
    if (s === 'loading' || s === 'waiting') host.setAttribute('aria-busy', 'true');
    else host.removeAttribute('aria-busy');
  };
  const strategy = config.load ?? 'eager';
  try {
    if (!Array.isArray(config.fields) || config.fields.length === 0) throw new Error('mountPixiForm: fields are required');
    if (!config.onSubmit && !config.action) throw new Error('mountPixiForm: provide onSubmit or action');
    if (strategy !== 'eager') {
      setState('waiting');
      await waitToLoad(strategy, host, config.loadMargin ?? '200px');
    }
    setState('loading');
    events.emit('loadstart', { reason: strategy });
    return await mountInner(host, config, events, setState, performance.now());
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    setState('error');
    events.emit('error', { error, phase: 'load' });
    throw error;
  }
}

/** Resolves when the host nears the viewport ('visible') or the browser is idle ('idle'). */
function waitToLoad(strategy: 'visible' | 'idle', host: HTMLElement, margin: string): Promise<void> {
  return new Promise((resolve) => {
    if (strategy === 'idle') {
      const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(() => resolve(), { timeout: 2000 });
      else setTimeout(resolve, 200);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') return resolve();
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          resolve();
        }
      },
      { rootMargin: margin },
    );
    io.observe(host);
  });
}

async function mountInner(
  host: HTMLElement,
  config: PixiFormConfig,
  events: FormEvents,
  setState: (s: LoadState) => void,
  t0: number,
): Promise<PixiFormHandle> {
  let state: LoadState = 'loading';
  const layoutMode = config.layout ?? 'auto';
  const autoHeight = layoutMode === 'auto';
  let destroyed = false;
  const mq = matchMedia('(prefers-color-scheme: dark)');
  let modeSetting = config.mode ?? 'auto';
  let themeInput = config.theme;
  const currentMode = (): 'light' | 'dark' => (modeSetting === 'auto' ? (mq.matches ? 'dark' : 'light') : modeSetting);
  let theme = resolveTheme(themeInput, currentMode());
  const transparent = config.transparent ?? autoHeight;

  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const app = new Application();
  await app.init({
    width: Math.max(280, host.clientWidth || 360),
    height: autoHeight ? 200 : Math.max(200, host.clientHeight || 600),
    ...(autoHeight ? {} : { resizeTo: host }),
    // Premultiplied alpha: a transparent clear colour must be black, or it tints the page.
    background: transparent ? 0x000000 : theme.colors.background,
    backgroundAlpha: transparent ? 0 : 1,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  app.renderer.background.alpha = transparent ? 0 : 1;
  const canvas = app.canvas;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  if (!autoHeight) canvas.style.height = '100%';
  // 'auto': let the page scroll vertically on touch; 'fill': the canvas handles all gestures.
  canvas.style.touchAction = autoHeight ? 'pan-y' : 'none';
  canvas.style.userSelect = 'none';
  canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent');
  canvas.style.setProperty('-webkit-touch-callout', 'none');
  host.appendChild(canvas);

  const ui = new FormUI(app, {
    theme,
    host,
    fitVisualViewport: !autoHeight,
    a11y: { label: config.title, ...(config.a11y ?? {}) },
  });
  app.stage.addChild(ui);

  // ---- controls
  const controls: Record<string, Control<any>> = {};
  const groups: Record<string, FieldGroup> = {};
  let groupSeq = 0;

  // ---- conditional visibility: one toggle per field, group and conditional heading, in config order
  interface Toggle {
    name: string;
    views: Container[];
    showIf?: ShowIf;
    parent: Toggle | null;
    control?: Control<any>;
    shown: boolean;
  }
  const toggles: Toggle[] = [];
  const toggleByName = new Map<string, Toggle>();
  const addToggle = (name: string, views: Container[], showIf: ShowIf | undefined, parent: Toggle | null, control?: Control<any>): Toggle => {
    if (showIf !== undefined && typeof showIf !== 'function') conditionFields(showIf); // validates the shape
    const t: Toggle = { name, views, showIf, parent, control, shown: true };
    toggles.push(t);
    if (name) toggleByName.set(name, t);
    return t;
  };

  /** Builds a list of field configs into layout items (rows are built after their fields exist). */
  const build = (fields: FieldConfig[], depth: number, parent: Toggle | null = null): Layoutable[] => {
    if (depth > 4) throw new Error('mountPixiForm: groups can be nested at most 4 levels deep');
    const entries: (Layoutable | { row: string })[] = [];
    const rows = new Map<string, Layoutable[]>();
    const place = (row: string | undefined, item: Layoutable) => {
      if (!row) return void entries.push(item);
      let group = rows.get(row);
      if (!group) {
        group = [];
        rows.set(row, group);
        entries.push({ row });
      }
      group.push(item);
    };

    for (const f of fields) {
      const { type, row, showIf, ...opts } = f as FieldConfig & Record<string, unknown> & { showIf?: ShowIf };
      let c: Control<any> | null = null;
      switch (type) {
        case 'group': {
          const { fields: inner, ...gopts } = opts as unknown as Omit<GroupConfig, 'type'>;
          if (!Array.isArray(inner) || inner.length === 0) throw new Error('mountPixiForm: a group needs fields');
          const g = new FieldGroup(ui, { ...gopts, name: gopts.name ?? `group${++groupSeq}` });
          if (groups[g.fieldName] || controls[g.fieldName]) throw new Error(`mountPixiForm: duplicate name "${g.fieldName}"`);
          groups[g.fieldName] = g;
          const gt = addToggle(g.fieldName, [g], showIf, parent);
          g.add(...build(inner, depth + 1, gt));
          place(row, g);
          continue;
        }
        case 'heading':
        case 'paragraph': {
          const label = new Label(ui, String((f as { text: string }).text), type === 'heading' ? 'title' : 'body');
          if (showIf !== undefined) addToggle('', [label], showIf, parent);
          place(row, label);
          continue;
        }
        case 'text':
          c = new TextInput(ui, opts as unknown as TextInputOptions);
          break;
        case 'email':
          c = new TextInput(ui, { inputMode: 'email', formatters: [Formatters.lowerCase()], maxLength: 254, ...(opts as unknown as TextInputOptions) });
          break;
        case 'tel':
          c = new TextInput(ui, { inputMode: 'tel', allow: /[0-9+\-() ]/, maxLength: 20, ...(opts as unknown as TextInputOptions) });
          break;
        case 'url':
          c = new TextInput(ui, { inputMode: 'url', maxLength: 2048, ...(opts as unknown as TextInputOptions) });
          break;
        case 'number':
          c = new TextInput(ui, { inputMode: 'decimal', allow: /[0-9.\-]/, maxLength: 32, ...(opts as unknown as TextInputOptions) });
          break;
        case 'textarea':
          c = new TextArea(ui, opts as unknown as TextAreaOptions);
          break;
        case 'password': {
          const { strengthMeter, ...rest } = opts as unknown as PasswordInputOptions & { strengthMeter?: boolean };
          const pw = new PasswordInput(ui, rest);
          c = pw;
          if (strengthMeter) {
            if (controls[pw.fieldName]) throw new Error(`mountPixiForm: duplicate field name "${pw.fieldName}"`);
            const meter = new StrengthMeter(ui);
            pw.on('change', (sec: Secret) => meter.update(sec));
            place(row, pw);
            place(undefined, meter);
            controls[pw.fieldName] = pw;
            addToggle(pw.fieldName, [pw, meter], showIf, parent, pw);
            continue;
          }
          break;
        }
        case 'otp':
          c = new OtpInput(ui, opts as unknown as OtpInputOptions);
          break;
        case 'checkbox':
          c = new Checkbox(ui, opts as unknown as CheckboxOptions);
          break;
        case 'switch':
          c = new Switch(ui, opts as unknown as SwitchOptions);
          break;
        case 'radio':
          c = new RadioGroup(ui, opts as unknown as RadioGroupOptions<string>);
          break;
        case 'select':
          c = new Select(ui, opts as unknown as SelectOptions<string>);
          break;
        case 'slider':
          c = new Slider(ui, opts as unknown as SliderOptions);
          break;
        case 'humancheck':
          c = new HumanCheck(ui, opts as unknown as HumanCheckOptions);
          break;
        case 'hidden':
          c = new HiddenField(ui, opts as unknown as HiddenFieldOptions);
          break;
        case 'date':
          c = new DatePicker(ui, opts as unknown as DatePickerOptions);
          break;
        case 'phone':
          c = new PhoneInput(ui, opts as unknown as PhoneInputOptions);
          break;
        default:
          throw new Error(`mountPixiForm: unknown field type "${String(type)}"`);
      }
      if (controls[c.fieldName] || groups[c.fieldName]) throw new Error(`mountPixiForm: duplicate field name "${c.fieldName}"`);
      controls[c.fieldName] = c;
      addToggle(c.fieldName, [c], showIf, parent, c);
      place(row, c);
    }
    return entries.map((e) => ('row' in e && !(e instanceof Container) ? new Row(rows.get(e.row)!, 16, 520) : (e as Layoutable)));
  };

  const items: Layoutable[] = [];
  if (config.title) items.push(new Label(ui, config.title, 'title'));
  if (config.subtitle) items.push(new Label(ui, config.subtitle, 'subtitle'));
  items.push(...build(config.fields, 0));

  // ---- buttons + form
  const submitBtn = new Button(ui, { name: 'pixiformSubmit', text: config.submitText ?? 'Submit' });
  const resetBtn = config.resetText ? new Button(ui, { name: 'pixiformReset', text: config.resetText, variant: 'outline' }) : null;
  items.push(resetBtn ? new Row([resetBtn, submitBtn], 12, 0) : submitBtn);

  const submitter = config.onSubmit ? null : actionSubmitter(config);
  const form = new Form(ui, { ...(config.form ?? {}), onSubmit: config.onSubmit ?? submitter! });
  submitter?.prefetch();
  form.add(...Object.values(controls)).bindSubmit(submitBtn);

  // ---- showIf: re-evaluated after every change; hidden fields count as empty, so rules chain.
  for (const t of toggles) {
    if (t.showIf === undefined || typeof t.showIf === 'function') continue;
    for (const name of conditionFields(t.showIf) ?? []) {
      if (!controls[name]) throw new Error(`mountPixiForm: showIf of "${t.name || 'a heading'}" refers to unknown field "${name}"`);
    }
  }
  const overrides = new Map<string, boolean>();
  let visibilityReady = false;
  const applyToggle = (t: Toggle) => {
    const c = t.control;
    if (c) {
      c.excluded = !t.shown;
      if (!t.shown) {
        if (c.focused) c.blur();
        c.touched = false;
        c.setError(null);
      }
    }
    for (const v of t.views) {
      v.visible = t.shown;
      v.emit('resize', v); // the parent column/row/group closes or opens the gap
    }
    if (visibilityReady && t.name) events.emit('fieldvisibility', { name: t.name, visible: t.shown });
  };
  const resolveVisibility = () => {
    for (let pass = 0; pass <= toggles.length; pass++) {
      const shownValues: Record<string, unknown> = Object.create(null);
      for (const t of toggles) if (t.control && t.shown) shownValues[t.name] = t.control.getValue();
      const get = (name: string) => {
        const t = toggleByName.get(name);
        return t?.control && t.shown ? { value: t.control.getValue(), empty: t.control.isEmpty() } : undefined;
      };
      let changed = false;
      for (const t of toggles) {
        let own = true;
        if (overrides.has(t.name)) own = overrides.get(t.name)!;
        else if (typeof t.showIf === 'function') {
          try {
            own = !!t.showIf({ ...shownValues });
          } catch (err) {
            own = false;
            events.emit('error', { error: err instanceof Error ? err : new Error(String(err)), phase: 'listener' });
          }
        } else if (t.showIf !== undefined) own = evaluateCondition(t.showIf, get);
        const shown = own && (t.parent ? t.parent.shown : true);
        if (shown !== t.shown) {
          t.shown = shown;
          changed = true;
          applyToggle(t);
        }
      }
      if (!changed) break;
    }
  };
  resolveVisibility();
  visibilityReady = true;
  for (const c of Object.values(controls)) c.on('change', resolveVisibility);
  form.on('reset', resolveVisibility);
  const toast = new Toast(ui);
  const showToasts = config.toasts ?? true;
  if (showToasts) {
    form.on('success', (r: SubmitResult) => r.message && toast.show(r.message, 'success'));
    form.on('failure', (r: SubmitResult) => toast.show(r.message ?? 'Something went wrong.', 'error'));
    form.on('blocked', (reason: string) => toast.show(reason, 'error'));
  }
  // form.reset() wipes secrets, which emits 'change' on password fields, so strength meters reset too.
  if (resetBtn) resetBtn.onPress = () => form.reset();

  const analytics = config.analytics ? new FormAnalytics(ui, form, { formId: config.id, ...config.analytics }) : null;

  // ---- layout
  const column = new Column(items, 20);
  const surface = new Surface(ui, column, config.card ?? true, config.maxWidth ?? 640);
  let scroll: ScrollView | null = null;
  if (autoHeight) ui.content.addChild(surface);
  else {
    scroll = new ScrollView(ui, surface);
    ui.content.addChild(scroll);
  }
  const privacy = config.privacyScreen === false ? null : new PrivacyScreen(ui);

  let frame = 0;
  // ---- 'auto' layout for tall forms: a canvas "window" that follows the page scroll.
  // Browsers cap canvas size (iOS Safari ≈16.7M pixels), so a form taller than ~2 screens
  // gets a canvas of at most that height, moved within the host as the page scrolls; the host
  // keeps the form's full height so native scrolling, anchors and layout are unchanged.
  let formHeight = 0;
  let windowTop = 0;
  let windowed = false;
  const hostInlineHeight = host.style.height;
  const maxCanvasHeight = () => Math.max(720, Math.round(window.innerHeight * 2));
  const placeWindow = (force = false) => {
    if (destroyed || !autoHeight) return;
    const width = app.screen.width;
    const cap = maxCanvasHeight();
    const shouldWindow = formHeight > cap;
    if (shouldWindow !== windowed) {
      windowed = shouldWindow;
      canvas.style.position = windowed ? 'absolute' : '';
      canvas.style.left = windowed ? '0' : '';
      host.style.height = windowed ? `${formHeight}px` : hostInlineHeight;
      force = true;
    }
    if (windowed) host.style.height = `${formHeight}px`;
    const h = windowed ? cap : formHeight;
    let top = 0;
    if (windowed) {
      const vh = window.innerHeight;
      const hostTop = host.getBoundingClientRect().top;
      const viewTop = -hostTop; // viewport top in host coordinates
      const margin = Math.round(vh * 0.15);
      const covered = viewTop - margin >= windowTop && viewTop + vh + margin <= windowTop + h;
      top = covered && !force ? windowTop : Math.round(viewTop - (h - vh) / 2); // centre on the viewport
      top = Math.max(0, Math.min(formHeight - h, top));
    }
    if (app.screen.height !== h) app.renderer.resize(width, h);
    if (top !== windowTop || force) {
      windowTop = top;
      canvas.style.top = windowed ? `${top}px` : '';
      ui.content.y = -top;
      ui.emit('scroll');
      const cur = ui.focus.current;
      if (cur) ui.repositionProxy(cur);
    }
  };
  let windowFrame = 0;
  const onWindowScroll = () => {
    if (windowed && !windowFrame) windowFrame = requestAnimationFrame(() => ((windowFrame = 0), placeWindow()));
  };
  window.addEventListener('scroll', onWindowScroll, { capture: true, passive: true });
  window.addEventListener('resize', onWindowScroll, { passive: true });

  const relayout = () => {
    frame = 0;
    if (destroyed) return;
    const width = Math.max(280, host.clientWidth);
    if (autoHeight) {
      surface.layout(width);
      formHeight = Math.ceil(surface.layoutHeight);
      if (app.screen.width !== width) app.renderer.resize(width, app.screen.height);
      placeWindow(true);
    } else {
      scroll!.setViewport(app.screen.width, app.screen.height);
    }
    const cur = ui.focus.current;
    if (cur) ui.repositionProxy(cur);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(relayout);
  };
  const ro = new ResizeObserver(schedule);
  ro.observe(host);
  surface.on('resize', schedule);
  app.renderer.on('resize', () => !autoHeight && schedule());

  // ---- events: forward everything to the typed emitter
  let dirty = false;
  const inside = (c: Control<any>) => {
    for (let n: Container | null = ui.focus.current?.view ?? null; n; n = n.parent) if (n === c) return true;
    return false;
  };
  form.on('beforesubmit', (d: PixiFormEventMap['beforesubmit']) => events.emit('beforesubmit', d));
  form.on('submitting', () => events.emit('submitting', {}));
  form.on('success', (result: SubmitResult) => events.emit('success', { result }));
  form.on('failure', (result: SubmitResult) => events.emit('failure', { result }));
  form.on('invalid', (errors: Record<string, string>) => events.emit('invalid', { errors }));
  form.on('blocked', (reason: string, code: 'bot' | 'rate_limit' | 'cooldown') => events.emit('blocked', { reason, code }));
  form.on('idle', () => events.emit('idle', {}));
  form.on('error', (error: Error) => events.emit('error', { error, phase: 'submit' }));
  form.on('reset', () => {
    dirty = false;
    events.emit('reset', {});
  });
  for (const c of Object.values(controls)) {
    const name = c.fieldName;
    c.on('change', (value: unknown) => {
      events.emit('change', { name, value });
      if (!dirty && inside(c)) {
        dirty = true; // only real edits count, not resets or programmatic setValue
        events.emit('dirty', { name });
      }
    });
    c.on('focus', () => events.emit('focus', { name }));
    c.on('blur', () => events.emit('blur', { name }));
    c.on('validate', (error: string | null) => events.emit('validate', { name, error, code: c.errorCode }));
  }
  for (const g of Object.values(groups)) g.on('toggle', (expanded: boolean) => events.emit('grouptoggle', { group: g.fieldName, expanded }));
  ui.on('themechange', (t: Theme) => events.emit('themechange', { theme: t, mode: currentMode() }));
  ui.on('a11ychange', () => events.emit('a11ychange', { prefs: ui.activePrefs }));
  app.renderer.on('resize', (width: number, height: number) => events.emit('resize', { width, height }));

  // 'load' fires once the first full frame (after layout) is on the canvas.
  let resolveLoaded!: (d: PixiFormEventMap['load']) => void;
  const loaded = new Promise<PixiFormEventMap['load']>((r) => (resolveLoaded = r));
  const onFirstPaint = () => {
    app.renderer.off('postrender', onFirstPaint);
    if (destroyed) return;
    state = 'ready';
    setState('ready');
    const detail = { ms: Math.round(performance.now() - t0), fields: Object.keys(controls).length, width: app.screen.width, height: app.screen.height };
    resolveLoaded(detail);
    events.emit('load', detail);
  };
  app.renderer.on('postrender', onFirstPaint);
  relayout();

  // ---- auto-height: reveal focused controls in whatever element scrolls the page
  const sentinel = document.createElement('div');
  Object.assign(sentinel.style, { position: 'absolute', left: '0', width: '1px', pointerEvents: 'none', visibility: 'hidden' });
  host.appendChild(sentinel);
  const reveal = (c: Focusable) => {
    const b = c.view.getBounds(); // canvas coordinates; the canvas sits `windowTop` px into the host
    sentinel.style.top = `${Math.max(0, b.y + windowTop - 24)}px`;
    sentinel.style.height = `${b.height + 48}px`;
    sentinel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const onFocusChange = (c: Focusable | null, viaKeyboard: boolean) => {
    if (autoHeight && c && (viaKeyboard || ui.isTouch)) reveal(c);
  };
  ui.on('focuschange', onFocusChange);
  const onViewport = () => {
    const cur = ui.focus.current;
    if (autoHeight && cur) reveal(cur);
  };
  window.visualViewport?.addEventListener('resize', onViewport);
  // Keep the hidden keyboard proxy (and IME window) aligned while the page scrolls.
  const onScroll = () => {
    const cur = ui.focus.current;
    if (cur) ui.repositionProxy(cur);
  };
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });

  // ---- live theme
  const applyTheme = () => {
    theme = resolveTheme(themeInput, currentMode());
    ui.setTheme(theme);
    app.renderer.background.color = transparent ? 0x000000 : theme.colors.background;
    app.renderer.background.alpha = transparent ? 0 : 1;
  };
  const onScheme = () => modeSetting === 'auto' && !(themeInput && typeof themeInput === 'object' && 'fontSize' in themeInput) && applyTheme();
  mq.addEventListener('change', onScheme);

  const handle: PixiFormHandle = {
    app,
    ui,
    form,
    controls,
    analytics,
    groups,
    get: <T extends Control<any>>(name: string) => controls[name] as T | undefined,
    values: () => form.values(),
    submit: () => form.submit(),
    reset: () => form.reset(),
    setTheme(input, mode) {
      themeInput = input;
      if (mode) modeSetting = mode;
      applyTheme();
    },
    toast: (message, kind = 'info') => toast.show(message, kind),
    on: (type, fn) => events.on(type, fn),
    once: (type, fn) => events.once(type, fn),
    events,
    get state() {
      return state;
    },
    loaded,
    isDirty: () => dirty,
    setVisible(name, visible) {
      if (!toggleByName.has(name)) throw new Error(`setVisible: unknown field or group "${name}"`);
      if (visible === null) overrides.delete(name);
      else overrides.set(name, !!visible);
      resolveVisibility();
    },
    isVisible: (name) => toggleByName.get(name)?.shown ?? false,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      mq.removeEventListener('change', onScheme);
      window.visualViewport?.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('scroll', onWindowScroll, { capture: true });
      window.removeEventListener('resize', onWindowScroll);
      cancelAnimationFrame(windowFrame);
      host.style.height = hostInlineHeight;
      ui.off('focuschange', onFocusChange);
      analytics?.destroy(); // sends form_abandon if the user started but didn't finish
      privacy?.destroy();
      form.destroy(); // wipes secrets
      ui.destroy({ children: true });
      sentinel.remove();
      app.destroy(true, { children: true });
      state = 'destroyed';
      setState('destroyed');
      events.emit('destroy', {});
      events.clear();
    },
  };
  return handle;
}

// ------------------------------------------------------------------ centred (optionally carded) surface
class Surface extends Container implements Layoutable {
  private readonly bg = new Graphics();
  private height_ = 0;
  private width_ = 0;
  private laying = false;
  constructor(
    private readonly ui: FormUI,
    private readonly child: Column,
    private readonly card: boolean,
    private readonly maxWidth: number,
  ) {
    super();
    this.addChild(this.bg, child);
    child.on('resize', () => {
      if (this.laying || !this.width_) return;
      this.paint();
      this.emit('resize', this);
    });
    ui.on('themechange', () => this.width_ && this.layout(this.width_));
  }
  get layoutHeight(): number {
    return this.height_;
  }
  layout(width: number): void {
    this.width_ = width;
    this.laying = true;
    const outer = width < 480 ? 8 : 16;
    const w = Math.min(this.maxWidth, width - outer * 2);
    const pad = this.card ? (w < 440 ? 18 : 28) : 0;
    this.child.layout(w - pad * 2);
    this.child.position.set(Math.round((width - w) / 2) + pad, outer + pad);
    this.laying = false;
    this.paint();
  }
  private paint(): void {
    const outer = this.width_ < 480 ? 8 : 16;
    const w = Math.min(this.maxWidth, this.width_ - outer * 2);
    const pad = this.card ? (w < 440 ? 18 : 28) : 0;
    const h = this.child.layoutHeight + pad * 2;
    this.height_ = h + outer * 2 + 8; // room for the shadow / focus ring
    const x = Math.round((this.width_ - w) / 2);
    const c = this.ui.theme.colors;
    this.bg.clear();
    if (this.card) {
      this.bg
        .roundRect(x, outer + 4, w, h, 16)
        .fill({ color: c.shadow, alpha: 0.06 })
        .roundRect(x, outer, w, h, 16)
        .fill(c.surface)
        .stroke({ width: 1, color: c.border, alpha: 0.6, alignment: 1 });
    }
  }
}

// ------------------------------------------------------------------ `action`: submit without code
interface SessionInfo {
  csrfToken?: string;
  encryption?: EncryptionKey;
  pow?: PowChallenge;
}

/** Builds an onSubmit that serializes, encrypts secrets and POSTs to `config.action`. */
export function actionSubmitter(
  config: Pick<PixiFormConfig, 'action' | 'session' | 'csrfToken' | 'encryptionKey' | 'submitOptions' | 'captcha'>,
): FormOptions['onSubmit'] & { prefetch: () => void } {
  const action = config.action!;
  let session: SessionInfo | null = null;
  let loading: Promise<void> | null = null;
  const proof = new FormProof();
  const loadSession = () =>
    (loading = (async () => {
      const res = await fetch(config.session!, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`session request failed (${res.status})`);
      session = (await res.json()) as SessionInfo;
      proof.update(session.pow); // start the invisible proof-of-work while the person types
    })());
  const submit = async (_values: FormValues, form: Form): Promise<SubmitResult> => {
    try {
      if (config.session && !session) await (loading ?? loadSession()).catch(() => loadSession());
      const send = async () => {
        const key = session?.encryption ?? config.encryptionKey;
        const body = await form.serialize({ encryptionKey: key });
        return secureSubmit(action, body, {
          ...(config.submitOptions ?? {}),
          csrfToken: session?.csrfToken ?? config.csrfToken,
          idempotencyKey: form.idempotencyKey, // a retry of the same data is processed only once
          proof: await proof.token(), // '' when the server doesn't ask for one
          captchaToken: config.captcha ? await config.captcha() : undefined,
        });
      };
      let res = await send();
      if (res.status === 403 && config.session) {
        await loadSession(); // expired session: new CSRF token + key, then retry once
        res = await send();
      }
      const reply = (await res.json().catch(() => ({}))) as SubmitResult & { challenge?: string; pow?: PowChallenge };
      proof.update(reply.pow); // the server rotates the proof challenge after use
      // PFE1 challenges are single-use; the server sends the next one with each reply.
      const key = session?.encryption ?? config.encryptionKey;
      if (reply.challenge && key) {
        const next = { ...key, challenge: reply.challenge };
        if (session?.encryption) session.encryption = next;
        else config.encryptionKey = next;
      }
      if (res.status === 409 && res.headers.get('Idempotency-Status') === 'in-progress') {
        return { ok: false, message: 'Your previous submission is still being processed. Please wait a moment.' };
      }
      return {
        ok: res.ok && reply.ok !== false,
        message: reply.message ?? (res.ok ? undefined : `The request failed (${res.status}).`),
        fieldErrors: reply.fieldErrors,
      };
    } catch (err) {
      console.error('[pixiform] submit failed:', (err as Error).message);
      return { ok: false, message: 'Could not send the form. Please try again.' };
    }
  };
  /** Fetch the session (and start the proof-of-work) as soon as the form loads. */
  const prefetch = () => {
    if (config.session && !session && !loading) void loadSession().catch(() => (loading = null));
  };
  return Object.assign(submit, { prefetch });
}
