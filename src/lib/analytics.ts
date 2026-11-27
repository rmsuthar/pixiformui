import type { Control } from './core/Control';
import type { FormUI } from './core/FormUI';
import type { Container } from './render/canvas';
import { FieldGroup } from './FieldGroup';
import type { Form, SubmitResult } from './Form';

export type AnalyticsEventType =
  | 'form_view'
  | 'form_start'
  | 'field_focus'
  | 'field_complete'
  | 'field_error'
  | 'group_toggle'
  | 'submit_attempt'
  | 'submit_invalid'
  | 'submit_success'
  | 'submit_failure'
  | 'submit_blocked'
  | 'form_idle'
  | 'form_abandon';

/**
 * One analytics event. Built from metadata only: it never contains field
 * values, value lengths, or validation message text.
 */
export interface AnalyticsEvent {
  type: AnalyticsEventType;
  /** Your form identifier (`formId` option). */
  formId: string;
  /** Random id for this form instance (one page view). Not a user id. */
  formSessionId: string;
  /** Milliseconds since the form was mounted. */
  t: number;
  field?: string;
  /** 'text' | 'email' | 'tel' | 'password' | 'checkbox' | 'switch' | 'combobox' | 'radiogroup' | 'slider' | … */
  fieldType?: string;
  /** Name of the FieldGroup containing the field, if any. */
  group?: string;
  /** Time spent: on a field (field_complete) or since the first interaction (submit_*, form_abandon). */
  durationMs?: number;
  /** Number of edits made during the visit to a field. */
  changes?: number;
  /** 'required' | 'invalid' | 'server' | a validator's `code`. */
  errorCode?: string;
  /** Fields with errors (submit_invalid / submit_failure). */
  errorFields?: string[];
  errorCount?: number;
  /** 1 for the first submit of this form instance, 2 for the second… */
  attempt?: number;
  /** group_toggle: the new state. */
  expanded?: boolean;
  /** submit_blocked: 'bot' | 'rate_limit'. */
  reason?: string;
  /** form_abandon: last field the user was in, and progress. */
  lastField?: string;
  completedFields?: number;
  totalFields?: number;
}

export interface AnalyticsOptions {
  /** Identifies the form in reports. Default 'form'. */
  formId?: string;
  /** Receives every event. Use an adapter: analyticsAdapters.ga4(), .dataLayer(), .posthog()… */
  onEvent?: (e: AnalyticsEvent) => void;
  /** Called before each event; nothing is sent while it returns false (events are dropped, not queued). */
  consent?: () => boolean;
  /** Fraction of form instances to track (0–1). Default 1. */
  sampleRate?: number;
  /** Only send these event types. */
  events?: AnalyticsEventType[];
  /** Field names that must never appear in events (they're still counted in progress totals). */
  excludeFields?: string[];
  /** Send form_abandon when the page is hidden or the form destroyed after a start without success. Default true. */
  trackAbandon?: boolean;
}

interface FieldState {
  focusedAt: number;
  changes: number;
  completed: boolean;
  lastErrorCode: string | null;
}

const uuid = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b: number) => b.toString(16).padStart(2, '0')).join('');

/**
 * Privacy-safe analytics for a Form: views, starts, per-field time and
 * corrections, error codes, submit outcomes and abandonment.
 *
 *   const tracking = new FormAnalytics(ui, form, {
 *     formId: 'signup',
 *     onEvent: analyticsAdapters.ga4(),
 *     consent: () => myConsent.analytics,
 *   });
 *   // later: tracking.destroy()
 *
 * mountPixiForm() and <pixi-form> create one for you from `config.analytics`.
 */
export class FormAnalytics {
  readonly formSessionId = uuid();
  private readonly formId: string;
  private readonly t0 = performance.now();
  private readonly enabled: boolean;
  private readonly fields = new Map<Control<unknown>, FieldState>();
  private readonly offs: (() => void)[] = [];
  private startedAt = 0;
  private succeeded = false;
  private abandonSent = false;
  private attempts = 0;
  private lastField: string | undefined;
  private viewed = false;
  private observer: IntersectionObserver | null = null;
  private destroyed = false;

  constructor(
    private readonly ui: FormUI,
    form: Form,
    private readonly opts: AnalyticsOptions = {},
  ) {
    this.formId = String(opts.formId ?? 'form').slice(0, 64);
    this.enabled = Math.random() < Math.min(1, Math.max(0, opts.sampleRate ?? 1));
    if (!this.enabled) return;

    for (const c of form.fields) this.watchField(c);
    // Groups: those around the fields (works before the layout is attached) and any in the UI.
    for (const c of form.fields) for (let n: Container | null = c.parent; n; n = n.parent) if (n instanceof FieldGroup) this.watchGroup(n);
    this.watchGroups(ui.content);
    this.listen(form, 'submitstart', () => {
      this.attempts++;
      this.emit({ type: 'submit_attempt', attempt: this.attempts, durationMs: this.sinceStart() });
    });
    this.listen(form, 'invalid', (errors: Record<string, string>) => {
      const names = this.visibleNames(Object.keys(errors));
      this.emit({ type: 'submit_invalid', attempt: this.attempts, errorCount: Object.keys(errors).length, errorFields: names });
    });
    this.listen(form, 'success', () => {
      this.succeeded = true;
      this.emit({ type: 'submit_success', attempt: this.attempts, durationMs: this.sinceStart() });
    });
    this.listen(form, 'failure', (r: SubmitResult) => {
      const names = this.visibleNames(Object.keys(r.fieldErrors ?? {}));
      this.emit({ type: 'submit_failure', attempt: this.attempts, errorCount: names.length, errorFields: names });
    });
    this.listen(form, 'blocked', (_reason: string, code?: string) => this.emit({ type: 'submit_blocked', reason: code ?? 'blocked' }));
    this.listen(form, 'idle', () => this.emit({ type: 'form_idle' }));
    this.offs.push(ui.onInteraction(() => this.markStarted()));

    if (opts.trackAbandon !== false) {
      window.addEventListener('pagehide', this.onHide);
      document.addEventListener('visibilitychange', this.onHide);
    }
    this.observeView();
  }

  /** Sends a custom event through the same pipeline (consent, sampling, allow-list). */
  track(type: AnalyticsEventType, data: Omit<Partial<AnalyticsEvent>, 'type' | 'formId' | 'formSessionId' | 't'> = {}): void {
    this.emit({ ...data, type });
  }

  destroy(): void {
    if (this.destroyed) return;
    if (this.enabled) this.sendAbandon();
    this.destroyed = true;
    this.offs.forEach((off) => off());
    this.observer?.disconnect();
    window.removeEventListener('pagehide', this.onHide);
    document.removeEventListener('visibilitychange', this.onHide);
  }

  // ---------------------------------------------------------------- internals
  private emit(partial: Omit<AnalyticsEvent, 'formId' | 'formSessionId' | 't'>): void {
    if (!this.enabled || this.destroyed || !this.opts.onEvent) return;
    if (this.opts.events && !this.opts.events.includes(partial.type)) return;
    try {
      if (this.opts.consent && !this.opts.consent()) return;
    } catch {
      return;
    }
    const e: AnalyticsEvent = { ...partial, formId: this.formId, formSessionId: this.formSessionId, t: Math.round(performance.now() - this.t0) };
    for (const k of Object.keys(e) as (keyof AnalyticsEvent)[]) if (e[k] === undefined) delete e[k];
    try {
      this.opts.onEvent(Object.freeze(e));
    } catch (err) {
      console.warn('[pixiform] analytics handler failed', err);
    }
  }

  private watchField(c: Control<unknown>): void {
    if (this.fields.has(c) || c.isAction) return;
    const st: FieldState = { focusedAt: 0, changes: 0, completed: false, lastErrorCode: null };
    this.fields.set(c, st);
    const excluded = this.opts.excludeFields?.includes(c.fieldName) ?? false;
    const meta = () => (excluded ? null : { field: c.fieldName, fieldType: fieldType(c), group: groupOf(c) });

    this.listen(c, 'focus', () => {
      st.focusedAt = performance.now();
      st.changes = 0;
      this.lastField = excluded ? undefined : c.fieldName;
      const m = meta();
      if (m) this.emit({ type: 'field_focus', ...m });
    });
    this.listen(c, 'change', () => {
      if (this.isActive(c)) st.changes++; // programmatic resets/wipes happen without focus
    });
    this.listen(c, 'blur', () => {
      if (!st.changes) return;
      st.completed = true;
      const m = meta();
      if (m) this.emit({ type: 'field_complete', ...m, durationMs: Math.round(performance.now() - st.focusedAt), changes: st.changes });
      st.changes = 0;
    });
    this.listen(c, 'validate', (error: string | null) => {
      const code = error ? (c.errorCode ?? 'invalid') : null;
      if (code === st.lastErrorCode) return;
      st.lastErrorCode = code;
      const m = meta();
      if (code && m) this.emit({ type: 'field_error', ...m, errorCode: code });
    });
  }

  private readonly groups = new Set<FieldGroup>();

  private watchGroup(g: FieldGroup): void {
    if (this.groups.has(g)) return;
    this.groups.add(g);
    this.listen(g, 'toggle', (expanded: boolean) => this.emit({ type: 'group_toggle', group: g.fieldName, expanded }));
  }

  private watchGroups(node: Container): void {
    for (const child of node.children) {
      if (child instanceof FieldGroup) this.watchGroup(child);
      this.watchGroups(child instanceof FieldGroup ? child.content : child);
    }
  }

  private listen(target: { on(e: string, fn: (...a: any[]) => void): unknown; off(e: string, fn: (...a: any[]) => void): unknown }, event: string, fn: (...a: any[]) => void): void {
    target.on(event, fn);
    this.offs.push(() => target.off(event, fn));
  }

  /** True while keyboard focus is on the control or one of its parts (composites like PhoneInput). */
  private isActive(c: Control<unknown>): boolean {
    const cur = this.ui.focus.current;
    if (!cur) return false;
    for (let n: Container | null = cur.view; n; n = n.parent) if (n === c) return true;
    return false;
  }

  private markStarted(): void {
    if (this.startedAt) return;
    this.startedAt = performance.now();
    this.emit({ type: 'form_start' });
  }

  private sinceStart(): number | undefined {
    return this.startedAt ? Math.round(performance.now() - this.startedAt) : undefined;
  }

  private visibleNames(names: string[]): string[] {
    const ex = this.opts.excludeFields ?? [];
    return names.filter((n) => !ex.includes(n)).slice(0, 25);
  }

  private observeView(): void {
    const canvas = this.ui.app.canvas;
    if (typeof IntersectionObserver === 'undefined') {
      this.sendView();
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.sendView();
          this.observer?.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    this.observer.observe(canvas);
  }

  private sendView(): void {
    if (this.viewed) return;
    this.viewed = true;
    this.emit({ type: 'form_view', totalFields: this.fields.size });
  }

  private onHide = (): void => {
    if (document.visibilityState === 'hidden') this.sendAbandon();
  };

  private sendAbandon(): void {
    if (this.opts.trackAbandon === false || !this.startedAt || this.succeeded || this.abandonSent) return;
    this.abandonSent = true;
    const completed = [...this.fields.values()].filter((s) => s.completed).length;
    this.emit({
      type: 'form_abandon',
      lastField: this.lastField,
      completedFields: completed,
      totalFields: this.fields.size,
      durationMs: this.sinceStart(),
    });
  }
}

function fieldType(c: Control<unknown>): string {
  if (c.secure) return 'password';
  if (c.sensitive) return 'otp';
  const role = c.ariaRole();
  if (role === 'textbox') return c.inputMode === 'text' || c.inputMode === 'none' ? 'text' : c.inputMode;
  return role;
}

function groupOf(c: Control<unknown>): string | undefined {
  for (let n: Container | null = c.parent; n; n = n.parent) if (n instanceof FieldGroup) return n.fieldName;
  return undefined;
}
