import type { FormValues, SetValuesResult, SubmitResult } from './Form';
import type { AnalyticsEvent } from './analytics';
import type { Control } from './core/Control';
import { PIXIFORM_EVENTS, type PixiFormEventMap, type PixiFormListeners } from './events';
import { mountPixiForm, type PixiFormConfig, type PixiFormHandle } from './mount';

/** Config for the element: `onSubmit` is optional; without it a `pixiform-submit` event is dispatched. */
export type PixiFormElementConfig = Omit<PixiFormConfig, 'onSubmit'> & Partial<Pick<PixiFormConfig, 'onSubmit'>>;

export interface PixiFormSubmitDetail {
  values: Record<string, unknown>;
  /** Call with your result (or a promise of it) to finish the submission. */
  respondWith(result: SubmitResult | Promise<SubmitResult>): void;
}

/**
 * `<pixi-form>` custom element.
 *
 *   const el = document.querySelector('pixi-form');
 *   el.config = { fields: [...], submitText: 'Save' };
 *   el.addEventListener('pixiform-submit', (e) => e.detail.respondWith(save(e.detail.values)));
 *
 * Events (all bubble and cross shadow roots; `detail` = the payload in PixiFormEventMap):
 *   pixiform-beforeload { config }          before mounting; cancelable; may edit detail.config
 *   pixiform-loadstart, pixiform-load, pixiform-resize, pixiform-themechange, pixiform-a11ychange,
 *   pixiform-error, pixiform-destroy        loading the UI
 *   pixiform-ready   { handle }             mounted (handle available)
 *   pixiform-change, pixiform-dirty, pixiform-focus, pixiform-blur, pixiform-validate,
 *   pixiform-grouptoggle, pixiform-beforesubmit (cancelable), pixiform-submitting,
 *   pixiform-success, pixiform-failure, pixiform-invalid, pixiform-blocked, pixiform-reset,
 *   pixiform-idle                           form activity
 *   pixiform-submit  { values, respondWith } only when neither config.onSubmit nor config.action is set
 *   pixiform-analytics AnalyticsEvent       only when config.analytics is set (e.g. `analytics: {}`)
 */
// On a server (SSR) there's no HTMLElement: a stand-in base lets the module load; the element only
// works in a browser, where definePixiFormElement() registers it.
const ElementBase: typeof HTMLElement = typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

export class PixiFormElement extends ElementBase {
  #config: PixiFormElementConfig | null = null;
  #handle: PixiFormHandle | null = null;
  #generation = 0;

  get config(): PixiFormElementConfig | null {
    return this.#config;
  }

  /** Setting a new config re-mounts the form. */
  set config(value: PixiFormElementConfig | null) {
    this.#config = value;
    if (this.isConnected) void this.#mount();
  }

  /** The live handle (null until `pixiform-ready`). */
  get handle(): PixiFormHandle | null {
    return this.#handle;
  }

  /**
   * Returns current values of all fields. Passwords are returned as opaque
   * `Secret` handles (never plaintext strings).
   */
  values(): FormValues {
    return this.#handle?.values() ?? {};
  }

  /**
   * Updates non-secret fields from a key-value record, re-validating and redrawing.
   * Secret and sensitive fields (passwords, OTP) are skipped for security.
   */
  setValues(values: Record<string, unknown>, opts?: { emit?: boolean; validate?: boolean }): SetValuesResult {
    return this.#handle?.form.setValues(values, opts) ?? { applied: [], skipped: {} };
  }

  /** Gets an individual control by its declared field name. */
  get<T extends Control<any> = Control<any>>(name: string): T | undefined {
    return this.#handle?.get<T>(name);
  }

  /** Programmatically triggers form submission. */
  submit(): Promise<SubmitResult | null> {
    return this.#handle ? this.#handle.submit() : Promise.resolve(null);
  }

  /** Restores all fields to their initial empty states. */
  reset(): void {
    this.#handle?.reset();
  }

  /** Shows or hides a field or group, overriding its showIf rule (`null` restores the rule). */
  setVisible(name: string, visible: boolean | null): void {
    this.#handle?.setVisible(name, visible);
  }

  /** True if the field or group is currently shown. */
  isVisible(name: string): boolean {
    return this.#handle?.isVisible(name) ?? false;
  }

  /** Open the form in a dialog over the page / put it back (config.popout adds a button for this). */
  popOut(): void {
    this.#handle?.popOut();
  }
  popIn(): void {
    this.#handle?.popIn();
  }

  connectedCallback(): void {
    if (!this.style.display) this.style.display = 'block';
    if (this.#config && !this.#handle) void this.#mount();
  }

  disconnectedCallback(): void {
    this.#generation++;
    this.#handle?.destroy();
    this.#handle = null;
  }

  async #mount(): Promise<void> {
    const gen = ++this.#generation;
    this.#handle?.destroy();
    this.#handle = null;
    const fire = (type: string, detail: unknown, cancelable = false) =>
      this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable }));
    if (!this.#config) return;
    // Last chance to adjust the config (or cancel) before anything is built.
    const before = { config: { ...this.#config } };
    if (!fire('pixiform-beforeload', before, true)) return;
    const cfg = before.config;
    const dispatchSubmit: NonNullable<PixiFormConfig['onSubmit']> = (values) =>
      new Promise<SubmitResult>((resolve) => {
        let answered = false;
        const detail: PixiFormSubmitDetail = {
          values,
          respondWith: (r) => {
            answered = true;
            Promise.resolve(r).then(resolve, () => resolve({ ok: false, message: 'Submission failed.' }));
          },
        };
        fire('pixiform-submit', detail);
        if (!answered) resolve({ ok: true }); // nobody responded: treat as accepted
      });
    // `action` submits by itself; otherwise answer the 'pixiform-submit' event.
    const onSubmit = cfg.onSubmit ?? (cfg.action ? undefined : dispatchSubmit);
    // With `analytics` configured, every event is also a DOM event for tag managers.
    const analytics = cfg.analytics
      ? {
          ...cfg.analytics,
          onEvent: (e: AnalyticsEvent) => {
            cfg.analytics?.onEvent?.(e);
            fire('pixiform-analytics', e);
          },
        }
      : undefined;
    // Every form event becomes a `pixiform-<type>` DOM event, plus the config's own listeners.
    const on: PixiFormListeners = {};
    for (const type of PIXIFORM_EVENTS) {
      const own = cfg.on?.[type] as ((d: unknown) => void) | undefined;
      (on as Record<string, (d: unknown) => void>)[type] = (detail) => {
        if (gen !== this.#generation && type !== 'destroy') return;
        try {
          own?.(detail); // if this throws, the DOM event still fires; the error is reported as 'error'
        } finally {
          if (type === 'beforesubmit') {
            const d = detail as PixiFormEventMap['beforesubmit'];
            if (!fire('pixiform-beforesubmit', d, true)) d.preventDefault();
          } else fire(`pixiform-${type}`, detail);
        }
      };
    }
    let handle: PixiFormHandle;
    try {
      handle = await mountPixiForm(this, { ...cfg, onSubmit, analytics, on });
    } catch (err) {
      // Already reported as a pixiform-error event (phase 'load').
      console.error('[pixiform] could not mount the form:', (err as Error).message);
      return;
    }
    if (gen !== this.#generation) {
      handle.destroy(); // config changed or element removed while mounting
      return;
    }
    this.#handle = handle;
    fire('pixiform-ready', { handle });
  }
}

/** Registers the element (idempotent). Default tag: `pixi-form`. */
export function definePixiFormElement(tag = 'pixi-form'): void {
  if (typeof customElements === 'undefined') return; // server-side rendering: nothing to register
  if (!customElements.get(tag)) customElements.define(tag, class extends PixiFormElement {});
}

declare global {
  interface HTMLElementTagNameMap {
    'pixi-form': PixiFormElement;
  }
}
