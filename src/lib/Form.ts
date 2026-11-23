import { EventEmitter } from './render/canvas';
import type { Control } from './core/Control';
import type { FormUI } from './core/FormUI';
import { BotGuard, type BotGuardOptions } from './security/BotGuard';
import { RateLimiter, type RateLimiterOptions } from './security/RateLimiter';
import type { Button } from './controls/Button';
import { sealSecret, type EncryptionKey } from './security/envelope';
import { Secret } from './security/Secret';

export type FormValues = Record<string, unknown>;

/** JSON-safe form data, as produced by `form.serialize()`. */
export type SerializedValues = Record<string, string | number | boolean | null>;

export interface SerializeOptions {
  /**
   * Encrypts every password field (Secret) for the server as a PFE1 envelope, bound to the
   * key's single-use challenge and the field name. Without it, serialize() refuses to
   * include non-empty secrets.
   */
  encryptionKey?: EncryptionKey;
  /** 'error' (default) throws if a secret can't be encrypted; 'omit' leaves secret fields out. */
  secrets?: 'error' | 'omit';
  /** Only these fields. */
  include?: string[];
  /** Leave these fields out. */
  exclude?: string[];
}

export interface SetValuesResult {
  /** Fields that were set. */
  applied: string[];
  /** Fields that were not set, with the reason ('unknown field', 'secret field', 'wrong type', 'not allowed'). */
  skipped: Record<string, string>;
}

export interface SubmitResult {
  ok: boolean;
  /** Server-side errors keyed by field name. */
  fieldErrors?: Record<string, string>;
  message?: string;
}

export interface FormOptions {
  onSubmit: (values: FormValues, form: Form) => Promise<SubmitResult | void> | SubmitResult | void;
  /** Like Flutter's AutovalidateMode. Default 'onUserInteraction'. */
  autovalidateMode?: 'disabled' | 'onUserInteraction' | 'always';
  rateLimit?: RateLimiterOptions | false;
  botGuard?: BotGuardOptions | false;
  /** Wipe secret fields after this much inactivity (ms). 0 = off. Default 5 min. */
  idleTimeoutMs?: number;
  /** When to wipe secret fields after a submit attempt. Default 'always'. */
  wipeSecrets?: 'always' | 'success' | 'never';
}

/**
 * Groups controls, validates them, applies anti-abuse checks, and calls
 * `onSubmit` with collected values. Secret fields are passed as `Secret`
 * handles, never as strings.
 *
 * Events: 'submitstart', 'beforesubmit' ({ values, preventDefault }), 'submitting', 'success' (result), 'failure' (result),
 * 'invalid' (errors), 'blocked' (reason, code: 'bot' | 'rate_limit'), 'idle', 'reset', 'error' (Error).
 */
export class Form extends EventEmitter {
  readonly ui: FormUI;
  private readonly controls = new Map<string, Control<unknown>>();
  private readonly opts: FormOptions;
  private readonly limiter: RateLimiter | null;
  private readonly guard: BotGuard | null;
  private submitting = false;
  private idleTimer = 0;
  private readonly offInteraction: () => void;
  private submitButton: Button | null = null;

  constructor(ui: FormUI, opts: FormOptions) {
    super();
    this.ui = ui;
    this.opts = { autovalidateMode: 'onUserInteraction', idleTimeoutMs: 5 * 60_000, wipeSecrets: 'always', ...opts };
    this.limiter = opts.rateLimit === false ? null : new RateLimiter(opts.rateLimit);
    this.guard = opts.botGuard === false ? null : new BotGuard(opts.botGuard);
    this.offInteraction = ui.onInteraction((e) => {
      this.guard?.recordInteraction(e);
      this.armIdle();
    });
    this.armIdle();
  }

  get isSubmitting(): boolean {
    return this.submitting;
  }

  add(...controls: Control<any>[]): this {
    for (const c of controls) {
      if (this.controls.has(c.fieldName)) throw new Error(`Duplicate field name "${c.fieldName}"`);
      this.controls.set(c.fieldName, c as Control<unknown>);
      c.formContext = () => ({ getField: (n: string) => this.controls.get(n) });
      if (this.opts.autovalidateMode === 'disabled') c.validateOn = 'submit';
      if (this.opts.autovalidateMode === 'always') {
        c.validateOn = 'change';
        c.touched = true;
      }
      c.on('submit', this.onFieldSubmit, this);
    }
    return this;
  }

  /** Wires a button to submit this form (shows a spinner while submitting). */
  bindSubmit(button: Button): this {
    this.submitButton = button;
    button.onPress = async () => {
      await this.submit();
    };
    return this;
  }

  /** The registered controls, in the order they were added. */
  get fields(): Control<unknown>[] {
    return [...this.controls.values()];
  }

  get<T extends Control<any>>(name: string): T | undefined {
    return this.controls.get(name) as T | undefined;
  }

  values(): FormValues {
    const out: FormValues = Object.create(null);
    for (const [name, c] of this.controls) {
      if (c.ariaRole() === 'button') continue;
      out[name] = c.getValue();
    }
    return out;
  }

  /**
   * JSON-ready values: strings, numbers, booleans and null. Dates are ISO strings,
   * phones E.164. Password fields are encrypted with `encryptionKey` (empty ones become '').
   *
   *   const body = await form.serialize({ encryptionKey: session.encryption });
   *   await secureSubmit('/api/register', body, { csrfToken });
   */
  async serialize(opts: SerializeOptions = {}): Promise<SerializedValues> {
    const out: SerializedValues = Object.create(null);
    for (const [name, c] of this.controls) {
      if (c.ariaRole() === 'button') continue;
      if (opts.include && !opts.include.includes(name)) continue;
      if (opts.exclude?.includes(name)) continue;
      const v = c.getValue();
      if (v instanceof Secret) {
        if (opts.secrets === 'omit') continue;
        if (v.isEmpty) out[name] = '';
        else if (opts.encryptionKey) out[name] = await sealSecret(v, opts.encryptionKey, name);
        else throw new Error(`serialize: "${name}" is a secret field; pass encryptionKey (or secrets: 'omit')`);
      } else if (v === undefined) out[name] = null;
      else if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) out[name] = v;
      else out[name] = String(v);
    }
    return out;
  }

  /**
   * Fills fields from plain data (a saved draft, a record being edited, an agent's
   * prefill). Values go through each control's own checks: text is sanitised and
   * length-limited, choices must be one of the options. Secret and one-time-code fields
   * are never set this way, and unknown names are ignored.
   */
  setValues(values: Record<string, unknown>, opts: { emit?: boolean; validate?: boolean } = {}): SetValuesResult {
    const result: SetValuesResult = { applied: [], skipped: Object.create(null) };
    if (!values || typeof values !== 'object') return result;
    for (const name of Object.keys(values)) {
      const c = this.controls.get(name);
      const v = values[name];
      if (!c || c.ariaRole() === 'button') {
        result.skipped[name] = 'unknown field';
        continue;
      }
      if (c.secure || c.sensitive) {
        result.skipped[name] = 'secret field';
        continue;
      }
      const current = c.getValue();
      const expected = current === null ? null : typeof current;
      const ok = v === null ? expected !== 'boolean' && expected !== 'number' : expected === null ? typeof v === 'string' || typeof v === 'number' : typeof v === expected;
      if (!ok) {
        result.skipped[name] = 'wrong type';
        continue;
      }
      c.setValue(v as never, opts.emit ?? true);
      const after = c.getValue();
      if (v !== null && after !== v && after === current) {
        result.skipped[name] = 'not allowed'; // e.g. a choice that isn't an option
        continue;
      }
      result.applied.push(name);
      if (opts.validate) {
        c.touched = true;
        void c.validate();
      }
    }
    return result;
  }

  async validate(): Promise<Record<string, string>> {
    const errors: Record<string, string> = {};
    const list = [...this.controls.values()].filter((c) => c.ariaRole() !== 'button');
    const results = await Promise.all(list.map((c) => ((c.touched = true), c.validate())));
    results.forEach((r, i) => {
      if (r) errors[list[i].fieldName] = r;
    });
    return errors;
  }

  async submit(): Promise<SubmitResult | null> {
    if (this.submitting) return null;
    this.submitting = true;
    this.emit('submitstart');
    if (this.submitButton) this.submitButton.loading = true;
    try {
      const errors = await this.validate();
      const names = Object.keys(errors);
      if (names.length) {
        this.controls.get(names[0])?.focus();
        this.ui.announcer.announce(`${names.length} field${names.length > 1 ? 's need' : ' needs'} attention. ${errors[names[0]]}`, true);
        this.emit('invalid', errors);
        return { ok: false, fieldErrors: errors };
      }
      // Last chance for the app to stop (e.g. its own confirmation step). Not counted as an attempt.
      const values = this.values();
      let prevented = false;
      this.emit('beforesubmit', {
        values,
        preventDefault: () => (prevented = true),
        get defaultPrevented() {
          return prevented;
        },
      });
      if (prevented) return null;
      const bot = this.guard?.check();
      if (bot && !bot.ok) return this.block(bot.reason!, 'bot');
      const limit = this.limiter?.attempt();
      if (limit && !limit.allowed) return this.block(`Too many attempts. Try again in ${Math.ceil(limit.retryInMs / 1000)}s.`, 'rate_limit');

      this.emit('submitting');
      let result: SubmitResult;
      try {
        result = (await this.opts.onSubmit(values, this)) ?? { ok: true };
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
        result = { ok: false, message: 'Something went wrong. Please try again.' };
      }
      if (result.fieldErrors) {
        for (const [name, msg] of Object.entries(result.fieldErrors)) this.controls.get(name)?.setError(msg, 'server');
        const first = Object.keys(result.fieldErrors)[0];
        if (first) this.controls.get(first)?.focus();
      }
      const wipe = this.opts.wipeSecrets;
      if (wipe === 'always' || (wipe === 'success' && result.ok)) this.wipeSecrets();
      if (result.ok) this.limiter?.reset();
      if (result.message) this.ui.announcer.announce(result.message, !result.ok);
      this.emit(result.ok ? 'success' : 'failure', result);
      return result;
    } finally {
      this.submitting = false;
      if (this.submitButton) this.submitButton.loading = false;
    }
  }

  /** Zeroes every secret field's memory. */
  wipeSecrets(): void {
    for (const c of this.controls.values()) {
      if (c.secure || c.sensitive) {
        c.wipe();
        c.redraw();
        this.ui.focus.sync(c);
        c.emit('change', c.getValue(), c);
      }
    }
  }

  reset(): void {
    for (const c of this.controls.values()) c.reset();
    this.wipeSecrets();
    this.emit('reset');
  }

  destroy(): void {
    window.clearTimeout(this.idleTimer);
    this.offInteraction();
    this.wipeSecrets();
    for (const c of this.controls.values()) c.off('submit', this.onFieldSubmit, this);
    this.controls.clear();
    this.removeAllListeners();
  }

  private block(reason: string, code: 'bot' | 'rate_limit'): SubmitResult {
    this.ui.announcer.announce(reason, true);
    this.emit('blocked', reason, code);
    return { ok: false, message: reason };
  }

  /** Enter (or OTP completion) moves to the next field of THIS form, or submits from the last one. */
  private onFieldSubmit(source?: Control<unknown>): void {
    const list = [...this.controls.values()];
    const idx = source ? list.indexOf(source) : -1;
    const next = list.slice(idx + 1).find((c) => c.isFocusable());
    if (idx >= 0 && next) next.focus();
    else void this.submit();
  }

  private armIdle(): void {
    const ms = this.opts.idleTimeoutMs ?? 0;
    window.clearTimeout(this.idleTimer);
    if (ms <= 0) return;
    this.idleTimer = window.setTimeout(() => {
      const hadSecrets = [...this.controls.values()].some((c) => c.secure && !c.isEmpty());
      this.wipeSecrets();
      if (hadSecrets) {
        this.ui.announcer.announce('Passwords were cleared after inactivity.');
        this.emit('idle');
      }
    }, ms);
  }
}
