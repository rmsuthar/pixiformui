import { Application, Circle, Container, Graphics, Rectangle, Text } from '../lib/render/canvas';
import {
  Button,
  Checkbox,
  Column,
  DatePicker,
  FieldGroup,
  Form,
  FormAnalytics,
  type AnalyticsEvent,
  FormUI,
  Icons,
  Label,
  OtpInput,
  PasswordInput,
  PhoneInput,
  PrivacyScreen,
  RadioGroup,
  Row,
  ScrollView,
  Select,
  Slider,
  StrengthMeter,
  Switch,
  TextArea,
  TextInput,
  Toast,
  accentPalettes,
  checkContrast,
  fromRule,
  presetTheme,
  type AccentName,
  sealSecret,
  secureSubmit,
  type EncryptionKey,
  type Layoutable,
  type Secret,
  type SubmitResult,
  createPasskey,
  getPasskey,
  passkeyAutofillAvailable,
  passkeyErrorMessage,
  passkeysSupported,
  type PasskeyAuthenticationJSON,
} from '../lib';
import { Formatters } from '../lib/security/formatters';
import { COUNTRIES, COUNTRY_NAMES, OTP_LENGTH, otpRules, registrationRules as R } from '../../shared/rules.ts';

const APPBAR_H = 60;

async function main(): Promise<void> {
  const host = document.getElementById('app')!;
  let mode: 'light' | 'dark' = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  let accent: AccentName = 'indigo';
  let theme = presetTheme(accent, mode);

  const app = new Application();
  await app.init({
    resizeTo: host,
    background: theme.colors.background,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  host.appendChild(app.canvas);

  const ui = new FormUI(app, { theme, host });
  app.stage.addChild(ui);

  // ------------------------------------------------------------ fields (from shared rules)
  const fullName = new TextInput(ui, {
    ...fromRule(R, 'fullName'),
    placeholder: 'Ada Lovelace',
    formatters: [Formatters.singleSpaces()],
  });
  const username = new TextInput(ui, {
    ...fromRule(R, 'username'),
    placeholder: 'ada_l',
    formatters: [Formatters.lowerCase()],
    info: 'Your public handle. It appears on your profile and cannot be changed later.',
    helperText: '3–24 chars: a–z, 0–9, _',
  });
  const email = new TextInput(ui, {
    ...fromRule(R, 'email'),
    placeholder: 'you@example.com',
    formatters: [Formatters.lowerCase()],
    info: 'Used to sign in and for security alerts. We never share it.',
  });
  const password = new PasswordInput(ui, {
    ...fromRule(R, 'password'),
    placeholder: 'At least 12 characters',
    validateOn: 'blur',
    info: 'Encrypted in your browser before it is sent, then stored only as a salted hash. Use 12+ characters mixing letters, numbers and symbols.',
  });
  const confirm = new PasswordInput(ui, {
    ...fromRule(R, 'confirmPassword'),
    placeholder: 'Repeat password',
  });
  const strength = new StrengthMeter(ui);
  const phone = new PhoneInput(ui, {
    ...fromRule(R, 'phone'),
    defaultCountry: 'IN',
    preferredCountries: ['IN', 'US', 'GB', 'AE', 'SG'],
    helperText: 'Optional',
    info: 'Pick your country, then type the number. You can also paste a full +country number.',
  });
  const dateOfBirth = new DatePicker(ui, {
    ...fromRule(R, 'dateOfBirth'),
    placeholder: 'Select your birthday',
    info: 'You must be at least 16. Tip: click the month title to jump by year.',
  });
  const onboardingCall = new DatePicker(ui, {
    ...fromRule(R, 'onboardingCall'),
    time: { step: 30, defaultTime: '10:00' },
    placeholder: 'Optional · pick a weekday slot',
    info: 'Book a free 30-minute setup call. Weekdays only, within the next 60 days.',
  });
  const country = new Select(ui, {
    ...fromRule(R, 'country'),
    options: COUNTRIES.map((c) => ({ value: c, label: COUNTRY_NAMES[c] })),
    placeholder: 'Choose a country',
    info: 'Determines data residency and which regulations apply to your account.',
  });
  const plan = new RadioGroup(ui, {
    ...fromRule(R, 'plan'),
    direction: 'horizontal',
    value: 'free',
    info: 'You can upgrade or downgrade at any time from your account settings.',
    options: [
      { value: 'free', label: 'Free' },
      { value: 'pro', label: 'Pro' },
      { value: 'team', label: 'Team' },
    ],
  });
  const experience = new Slider(ui, {
    ...fromRule(R, 'experience'),
    min: R.experience.min,
    max: R.experience.max,
    step: R.experience.step,
    value: 3,
    format: (v) => (v === 1 ? '1 yr' : `${v} yrs`),
    info: 'Use the arrow keys for fine control. Page Up/Down jumps by 4 years.',
  });
  const bio = new TextArea(ui, {
    ...fromRule(R, 'bio'),
    rows: 4,
    showCounter: true,
    placeholder: 'Tell us a little about yourself…',
    formatters: [Formatters.noMarkup()],
  });
  const newsletter = new Switch(ui, {
    ...fromRule(R, 'newsletter'),
    description: 'Occasional emails about new features. No spam.',
    info: 'At most one email a month. Unsubscribe with one click.',
  });
  const terms = new Checkbox(ui, {
    ...fromRule(R, 'terms'),
    info: 'Summary: we store only what is needed to run your account, and you can export or delete it at any time.',
  });

  // ------------------------------------------------------------ groups (fieldsets)
  const accountGroup = new FieldGroup(ui, {
    name: 'account',
    title: 'Account',
    description: 'How you sign in.',
  }).add(new Row([fullName, username], 16, 520), email, new Row([password, confirm], 16, 520), strength);
  const aboutGroup = new FieldGroup(ui, {
    name: 'about',
    title: 'About you',
    info: 'Used to verify your identity and schedule your onboarding.',
  }).add(new Row([phone, country], 16, 520), new Row([dateOfBirth, onboardingCall], 16, 520));
  const prefsGroup = new FieldGroup(ui, {
    name: 'preferences',
    title: 'Plan & preferences',
    description: 'Optional. Sensible defaults are already selected.',
    collapsible: true,
    collapsed: true,
  }).add(plan, experience, bio, newsletter);

  const resetBtn = new Button(ui, { name: 'reset', text: 'Reset', variant: 'outline' });
  const submitBtn = new Button(ui, { name: 'submit', text: 'Create account' });

  // Re-check strength and confirmation as the password changes.
  password.on('change', (s: Secret) => {
    strength.update(s);
    if (confirm.touched && !confirm.isEmpty()) void confirm.validate({ getField: (n) => form.get(n) });
  });

  // ------------------------------------------------------------ form + server submit
  let session = await fetchSession();
  const toast = new Toast(ui);

  const form = new Form(ui, {
    autovalidateMode: 'onUserInteraction',
    idleTimeoutMs: 3 * 60_000,
    wipeSecrets: 'always',
    rateLimit: { maxAttempts: 5, windowMs: 60_000, lockoutMs: 15_000 },
    botGuard: { minFillMs: 2500, minInteractions: 5 },
    onSubmit: async (values): Promise<SubmitResult> => {
      const plain = { ...values };
      delete plain.password;
      delete plain.confirmPassword;
      const pw = values.password as Secret;
      const cf = values.confirmPassword as Secret;
      // Passwords are encrypted for the server (ECDH P-256 + AES-256-GCM) straight from
      // wipeable memory; no plaintext JS string is ever created on the client.
      const send = async () => {
        const key = session.encryption;
        if (!key) throw new Error('Encryption key unavailable');
        return secureSubmit(
          '/api/register',
          {
            ...plain,
            password: pw.isEmpty ? '' : await sealSecret(pw, key, 'password'),
            confirmPassword: cf.isEmpty ? '' : await sealSecret(cf, key, 'confirmPassword'),
          },
          { csrfToken: session.csrfToken },
        );
      };
      let res = await send();
      if (res.status === 403) {
        session = await fetchSession(); // session expired: refresh token + key once
        res = await send();
      }
      const body = (await res.json().catch(() => ({}))) as SubmitResult & { challenge?: string };
      // Each challenge is single-use; the server sends the next one with every reply.
      if (body.challenge && session.encryption) session.encryption = { ...session.encryption, challenge: body.challenge };
      return { ok: res.ok && body.ok !== false, message: body.message, fieldErrors: body.fieldErrors };
    },
  });
  form.add(fullName, username, email, password, confirm, phone, country, dateOfBirth, onboardingCall, plan, experience, bio, newsletter, terms);
  form.bindSubmit(submitBtn);

  // Privacy-safe analytics: metadata only, never values. In production pass an adapter,
  // e.g. onEvent: analyticsAdapters.ga4(), and gate it with your consent banner.
  const analyticsLog: AnalyticsEvent[] = [];
  (window as unknown as { __pixiformEvents: AnalyticsEvent[] }).__pixiformEvents = analyticsLog;
  new FormAnalytics(ui, form, {
    formId: 'signup',
    onEvent: (e) => {
      analyticsLog.push(e);
      if (location.hostname === 'localhost') console.debug('[analytics]', e.type, e);
    },
  });
  resetBtn.onPress = () => {
    form.reset();
    strength.update(password.getValue());
    toast.show('Form cleared.');
  };
  form.on('success', (r: SubmitResult) => {
    toast.show(r.message ?? 'Account created.', 'success', 5000);
    form.reset();
    strength.update(password.getValue());
  });
  form.on('failure', (r: SubmitResult) => toast.show(r.message ?? 'Submission failed.', 'error'));
  form.on('invalid', (errs: Record<string, string>) => toast.show(`Please fix ${Object.keys(errs).length} field(s).`, 'error'));
  form.on('blocked', (reason: string) => toast.show(reason, 'error'));
  form.on('idle', () => toast.show('Passwords were cleared after inactivity.'));

  // ------------------------------------------------------------ OTP (two-step verification)
  const otp = new OtpInput(ui, {
    ...fromRule(otpRules, 'code'),
    length: OTP_LENGTH,
    groupSize: 3,
    autoSubmit: true,
    webOtp: true,
    info: 'The code arrives by SMS. On Android and iOS the keyboard can fill it in for you.',
    helperText: 'Paste or type the code. Codes expire after 5 minutes.',
  });
  const sendCode = new Button(ui, { name: 'sendCode', text: 'Send code', variant: 'outline' });
  const verifyBtn = new Button(ui, { name: 'verify', text: 'Verify' });
  const postJson = async (url: string, body: unknown) => {
    let res = await secureSubmit(url, body, { csrfToken: session.csrfToken });
    if (res.status === 403) {
      session = await fetchSession();
      res = await secureSubmit(url, body, { csrfToken: session.csrfToken });
    }
    return { res, body: (await res.json().catch(() => ({}))) as SubmitResult };
  };
  sendCode.onPress = async () => {
    const { res, body } = await postJson('/api/otp/send', {});
    toast.show(body.message ?? (res.ok ? 'Code sent.' : 'Could not send a code.'), res.ok ? 'info' : 'error', 6000);
    if (res.ok) {
      otp.clear();
      otp.setError(null);
      otp.focus();
    }
  };
  const otpForm = new Form(ui, {
    botGuard: { minFillMs: 800, minInteractions: 1 },
    rateLimit: { maxAttempts: 6, windowMs: 60_000, lockoutMs: 30_000 },
    onSubmit: async (values): Promise<SubmitResult> => {
      const { res, body } = await postJson('/api/otp/verify', { code: values.code });
      return { ok: res.ok && body.ok !== false, message: body.message, fieldErrors: body.fieldErrors };
    },
  });
  otpForm.add(otp).bindSubmit(verifyBtn);
  otpForm.on('success', (r: SubmitResult) => toast.show(r.message ?? 'Verified.', 'success', 5000));
  otpForm.on('failure', (r: SubmitResult) => toast.show(r.message ?? 'Verification failed.', 'error'));
  otpForm.on('blocked', (reason: string) => toast.show(reason, 'error'));

  // ------------------------------------------------------------ draft handoff (from the MCP server)
  // An assistant prepared non-secret details; the link carries a single-use id in the
  // URL fragment (never sent to servers). Claim it, prefill, and let the person finish.
  const draftId = /^#draft=([A-Za-z0-9_-]{22})$/.exec(location.hash)?.[1];
  if (draftId) {
    history.replaceState(null, '', location.pathname + location.search);
    const { res, body } = await postJson('/api/drafts/claim', { id: draftId });
    const values = (body as SubmitResult & { values?: Record<string, unknown> }).values;
    if (res.ok && values) {
      const { applied } = form.setValues(values, { validate: true });
      if (applied.some((f) => ['plan', 'experience', 'bio', 'newsletter'].includes(f))) prefsGroup.setExpanded(true);
      toast.show('Details prefilled. Check them, set a password and accept the terms.', 'info', 7000);
      password.focus();
    } else toast.show(body.message ?? 'This link has expired or was already used.', 'error', 6000);
  }

  // ------------------------------------------------------------ layout
  const card = new Card(
    ui,
    new Column(
      [
        new Label(ui, 'Create your account', 'title'),
        new Label(ui, 'Rendered entirely on canvas. What you type never enters the page DOM.', 'subtitle'),
        Column.spacer(4),
        accountGroup,
        aboutGroup,
        prefsGroup,
        terms,
        Column.spacer(4),
        new Row([resetBtn, submitBtn], 12, 0),
        new Label(
          ui,
          'Protected by: canvas rendering, wipeable secret memory, CSRF token, strict CSP, rate limiting, bot checks, and server-side validation with the same rules.',
          'caption',
        ),
      ],
      20,
    ),
  );
  const otpCard = new Card(
    ui,
    new Column(
      [
        new Label(ui, 'Two-step verification', 'title'),
        new Label(ui, `We'll send a ${OTP_LENGTH}-digit code to confirm it's you.`, 'subtitle'),
        otp,
        new Row([sendCode, verifyBtn], 12, 0),
      ],
      20,
    ),
  );
  // ------------------------------------------------------------ passkeys (WebAuthn)
  const pkUser = new TextInput(ui, {
    name: 'passkeyUsername',
    label: 'Passkey username',
    placeholder: 'e.g. ada_passkey',
    formatters: [Formatters.lowerCase()],
    allow: /[a-z0-9_]/,
    maxLength: 24,
    // Lets the browser offer saved passkeys in this field's suggestions.
    autocomplete: 'username webauthn',
    helperText: 'Choose one to create a passwordless account, or leave empty to sign in.',
    info: 'Passkeys use your device lock (Face ID, fingerprint or PIN) instead of a password. Nothing secret leaves your device.',
  });
  const createPk = new Button(ui, { name: 'createPasskey', text: 'Create a passkey' });
  const signInPk = new Button(ui, { name: 'signInPasskey', text: 'Sign in with a passkey', variant: 'outline' });
  let conditional: AbortController | null = null;
  const finishSignIn = async (credential: PasskeyAuthenticationJSON) => {
    const r = await postJson('/api/passkey/login/verify', { credential });
    toast.show(r.body.message ?? (r.res.ok ? 'Signed in.' : 'Sign-in failed.'), r.res.ok ? 'success' : 'error', 6000);
  };
  // Passkey suggestions in the username field (where the browser supports them).
  const startConditional = async () => {
    if (!(await passkeyAutofillAvailable())) return;
    conditional?.abort();
    const ac = (conditional = new AbortController());
    try {
      const { res, body } = await postJson('/api/passkey/login/options', {});
      if (!res.ok || ac.signal.aborted) return;
      await finishSignIn(await getPasskey((body as any).options, { mediation: 'conditional', signal: ac.signal }));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.show(passkeyErrorMessage(e), 'error');
    }
  };
  createPk.onPress = async () => {
    conditional?.abort();
    const username = pkUser.getValue().trim();
    if (!username) {
      pkUser.setError('Choose a username to create a passkey.');
      pkUser.focus();
      return;
    }
    try {
      const { res, body } = await postJson('/api/passkey/register/options', { username });
      if (!res.ok) {
        if (body.fieldErrors?.username) pkUser.setError(body.fieldErrors.username, 'server');
        toast.show(body.message ?? 'Could not start passkey registration.', 'error');
        return;
      }
      const credential = await createPasskey((body as any).options);
      const r = await postJson('/api/passkey/register/verify', { credential });
      toast.show(r.body.message ?? (r.res.ok ? 'Passkey created.' : 'Passkey could not be saved.'), r.res.ok ? 'success' : 'error', 6000);
    } catch (e) {
      toast.show(passkeyErrorMessage(e), 'error');
    } finally {
      void startConditional();
    }
  };
  signInPk.onPress = async () => {
    conditional?.abort();
    try {
      const { res, body } = await postJson('/api/passkey/login/options', { username: pkUser.getValue().trim() });
      if (!res.ok) return void toast.show(body.message ?? 'Could not start sign-in.', 'error');
      await finishSignIn(await getPasskey((body as any).options));
    } catch (e) {
      toast.show(passkeyErrorMessage(e), 'error');
    } finally {
      void startConditional();
    }
  };
  if (!passkeysSupported()) {
    createPk.enabled = false;
    signInPk.enabled = false;
  } else void startConditional();
  const passkeyCard = new Card(
    ui,
    new Column(
      [
        new Label(ui, 'Passkeys', 'title'),
        new Label(
          ui,
          passkeysSupported() ? 'Sign in with Face ID, fingerprint or your device PIN. No password to type or leak.' : 'This browser does not support passkeys.',
          'subtitle',
        ),
        pkUser,
        new Row([createPk, signInPk], 12, 0),
      ],
      20,
    ),
  );

  const page = new Page(new Column([card, otpCard, passkeyCard], 24));
  const scroll = new ScrollView(ui, page);
  const applyTheme = () => {
    theme = presetTheme(accent, mode);
    ui.setTheme(theme);
    app.renderer.background.color = theme.colors.background;
    document.documentElement.style.colorScheme = mode;
    const issues = checkContrast(theme);
    if (issues.length) console.warn('[theme] contrast:', issues);
  };
  const appBar = new AppBar(
    ui,
    () => {
      mode = mode === 'light' ? 'dark' : 'light';
      applyTheme();
    },
    (name) => {
      accent = name;
      applyTheme();
    },
    () => ({ mode, accent }),
  );
  ui.content.addChild(scroll, appBar);
  const privacy = new PrivacyScreen(ui);
  void privacy;

  const relayout = () => {
    const { width, height } = app.screen;
    appBar.layout(width);
    scroll.y = APPBAR_H;
    scroll.setViewport(width, height - APPBAR_H);
  };
  app.renderer.on('resize', relayout);
  relayout();
}

interface SessionInfo {
  csrfToken: string | null;
  encryption: EncryptionKey | null;
}

async function fetchSession(): Promise<SessionInfo> {
  try {
    const r = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) return { csrfToken: null, encryption: null };
    const j = (await r.json()) as { csrfToken?: unknown; encryption?: Partial<EncryptionKey> };
    const e = j.encryption;
    const valid = e && e.alg === 'PFE1' && typeof e.kid === 'string' && typeof e.spki === 'string' && typeof e.challenge === 'string';
    return {
      csrfToken: typeof j.csrfToken === 'string' ? j.csrfToken : null,
      encryption: valid ? (e as EncryptionKey) : null,
    };
  } catch {
    return { csrfToken: null, encryption: null };
  }
}

// ------------------------------------------------------------------ demo-only widgets
/** Rounded surface with padding around a child column. */
class Card extends Container implements Layoutable {
  private readonly bg = new Graphics();
  private height_ = 0;
  private width_ = 0;
  private laying = false;
  constructor(private readonly ui: FormUI, private readonly child: Column) {
    super();
    this.addChild(this.bg, child);
    child.on('resize', () => !this.laying && this.width_ && this.paint());
    ui.on('themechange', () => this.width_ && this.layout(this.width_));
  }
  get layoutHeight(): number {
    return this.height_;
  }
  layout(width: number): void {
    this.width_ = width;
    const pad = width < 480 ? 18 : 32;
    this.child.position.set(pad, pad);
    this.laying = true;
    this.child.layout(width - pad * 2);
    this.laying = false;
    this.paint();
  }
  private paint(): void {
    const pad = this.child.x;
    const c = this.ui.theme.colors;
    this.height_ = this.child.layoutHeight + pad * 2;
    this.bg
      .clear()
      .roundRect(0, 4, this.width_, this.height_, 18)
      .fill({ color: c.shadow, alpha: 0.06 })
      .roundRect(0, 0, this.width_, this.height_, 18)
      .fill(c.surface)
      .stroke({ width: 1, color: c.border, alpha: 0.6, alignment: 1 });
    this.emit('resize', this);
  }
}

/** Centers the card horizontally with page margins. */
class Page extends Container implements Layoutable {
  private height_ = 0;
  private width_ = 0;
  private laying = false;
  constructor(private readonly card: Column) {
    super();
    this.addChild(card);
    card.on('resize', () => {
      if (this.laying) return;
      this.height_ = card.layoutHeight + 48;
      this.emit('resize', this);
    });
  }
  get layoutHeight(): number {
    return this.height_;
  }
  layout(width: number): void {
    this.width_ = width;
    const margin = width < 480 ? 12 : 24;
    const w = Math.min(680, this.width_ - margin * 2);
    this.laying = true;
    this.card.layout(w);
    this.laying = false;
    this.card.position.set(Math.round((width - w) / 2), 24);
    this.height_ = this.card.layoutHeight + 48;
  }
}

/** Top bar with title, accent swatches and light/dark toggle. */
class AppBar extends Container {
  private readonly bg = new Graphics();
  private readonly logo = new Graphics();
  private readonly title: Text;
  private readonly toggle = new Graphics();
  private readonly swatches = new Container();
  private width_ = 0;
  constructor(
    private readonly ui: FormUI,
    onToggle: () => void,
    private readonly onAccent: (name: AccentName) => void,
    private readonly state: () => { mode: 'light' | 'dark'; accent: AccentName },
  ) {
    super();
    this.title = new Text({ text: 'PixiForm' });
    this.addChild(this.bg, this.logo, this.title, this.swatches, this.toggle);
    this.toggle.eventMode = 'static';
    this.toggle.cursor = 'pointer';
    this.toggle.on('pointertap', onToggle);
    this.toggle.on('pointerdown', () => (ui.focus.claimed = true));
    this.eventMode = 'static';
    ui.on('themechange', () => this.layout(this.width_));
  }
  layout(width: number): void {
    this.width_ = width;
    const t = this.ui.theme;
    const c = t.colors;
    const { mode, accent } = this.state();
    this.hitArea = new Rectangle(0, 0, width, APPBAR_H);
    this.bg.clear().rect(0, 0, width, APPBAR_H).fill(c.surface).rect(0, APPBAR_H - 1, width, 1).fill({ color: c.border, alpha: 0.7 });
    this.logo.clear().roundRect(16, 16, 28, 28, 8).fill(c.primary);
    Icons.lock(this.logo, 30, 30, 18, c.primaryText);
    this.title.style = { fontFamily: t.fontFamily.join(','), fontSize: 18, fontWeight: '700', fill: c.text };
    this.title.position.set(54, (APPBAR_H - this.title.height) / 2);
    const cx = width - 34;
    this.toggle.clear().circle(cx, APPBAR_H / 2, 18).fill({ color: c.secondary });
    if (mode === 'dark') Icons.sun(this.toggle, cx, APPBAR_H / 2, 20, c.text);
    else Icons.moon(this.toggle, cx, APPBAR_H / 2, 20, c.text);

    // accent swatches (fewer on narrow screens)
    this.swatches.removeChildren().forEach((ch) => ch.destroy());
    const names = Object.keys(accentPalettes) as AccentName[];
    const shown = width < 400 ? names.slice(0, 3) : names;
    let x = cx - 34 - shown.length * 30;
    for (const name of shown) {
      const g = new Graphics();
      const sx = x + 15;
      if (name === accent) g.circle(sx, APPBAR_H / 2, 13).stroke({ width: 2, color: c.text });
      g.circle(sx, APPBAR_H / 2, 9).fill(accentPalettes[name][mode]);
      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.hitArea = new Circle(sx, APPBAR_H / 2, 15);
      g.on('pointerdown', () => (this.ui.focus.claimed = true));
      g.on('pointertap', () => this.onAccent(name));
      this.swatches.addChild(g);
      x += 30;
    }
  }
}

void main();
