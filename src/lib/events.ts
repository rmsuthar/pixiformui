import type { ActivePrefs } from './core/a11yPrefs';
import type { FormValues, SubmitResult } from './Form';
import type { Theme } from './theme';

/** Lifecycle state of a mounted form, mirrored on the host as `data-pixiform-state`. */
export type LoadState = 'waiting' | 'loading' | 'ready' | 'error' | 'destroyed';

/**
 * Every event a PixiFormUI form emits, with its payload.
 *
 * - `handle.on('change', (e) => e.name)` with mountPixiForm()
 * - `config.on = { load(e) {…}, submit… }` to listen from the start (catches `load`)
 * - `el.addEventListener('pixiform-change', (e) => e.detail.name)` with <pixi-form>
 *
 * Payloads never contain secret plaintext: password fields' values are `Secret` handles.
 */
export interface PixiFormEventMap {
  // ---------------------------------------------------------------- loading the UI
  /** The host scrolled into view / the browser went idle and mounting starts (`load: 'visible' | 'idle'`). */
  loadstart: { reason: 'eager' | 'visible' | 'idle' };
  /** First frame painted: the form is visible and interactive. */
  load: { ms: number; fields: number; width: number; height: number };
  /** The canvas changed size (container resize, form grew or shrank). */
  resize: { width: number; height: number };
  /** The theme changed (setTheme, OS light/dark switch). */
  themechange: { theme: Theme; mode: 'light' | 'dark' };
  /** Accessibility settings in effect changed (high contrast, reduced motion, text scale…). */
  a11ychange: { prefs: Readonly<ActivePrefs> };
  /** Something failed: mounting, the submit handler, or one of your event listeners. */
  error: { error: Error; phase: 'load' | 'submit' | 'listener' };
  /** handle.destroy() ran; secrets are wiped and the canvas removed. */
  destroy: Record<string, never>;

  // ---------------------------------------------------------------- form activity
  /** A field's value changed. */
  change: { name: string; value: unknown };
  /** First user edit since load or reset (use it for "unsaved changes" prompts). */
  dirty: { name: string };
  focus: { name: string };
  blur: { name: string };
  /** A field's validation result changed. `code`: 'required' | 'invalid' | 'server' | a validator's code. */
  validate: { name: string; error: string | null; code: string | null };
  /** A FieldGroup was opened or folded. */
  grouptoggle: { group: string; expanded: boolean };
  /** A field or group was shown or hidden by its showIf rule or handle.setVisible(). */
  fieldvisibility: { name: string; visible: boolean };
  /**
   * Validation passed and the form is about to submit. Call `preventDefault()` to stop
   * (e.g. to show your own confirmation first, then call `handle.submit()` again).
   */
  beforesubmit: { values: FormValues; preventDefault(): void; readonly defaultPrevented: boolean };
  /** Anti-abuse checks passed; the submit handler is running. */
  submitting: Record<string, never>;
  success: { result: SubmitResult };
  failure: { result: SubmitResult };
  /** Client-side validation failed. */
  invalid: { errors: Record<string, string> };
  /** Rate limit or bot check refused the submit. */
  blocked: { reason: string; code: 'bot' | 'rate_limit' | 'cooldown' };
  reset: Record<string, never>;
  /** Secrets were wiped after inactivity. */
  idle: Record<string, never>;
}

export type PixiFormEventType = keyof PixiFormEventMap;
export type PixiFormListener<K extends PixiFormEventType> = (detail: PixiFormEventMap[K]) => void;
export type PixiFormListeners = { [K in PixiFormEventType]?: PixiFormListener<K> };

/** All event names (handy for forwarding them, e.g. as DOM events). */
export const PIXIFORM_EVENTS: readonly PixiFormEventType[] = [
  'loadstart', 'load', 'resize', 'themechange', 'a11ychange', 'error', 'destroy',
  'change', 'dirty', 'focus', 'blur', 'validate', 'grouptoggle', 'fieldvisibility',
  'beforesubmit', 'submitting', 'success', 'failure', 'invalid', 'blocked', 'reset', 'idle',
];

/**
 * Typed event emitter. A listener that throws doesn't stop the others; the
 * exception is reported as an `error` event (phase 'listener') instead.
 */
export class FormEvents {
  private readonly map = new Map<PixiFormEventType, Set<(d: any) => void>>();

  on<K extends PixiFormEventType>(type: K, fn: PixiFormListener<K>): () => void {
    let set = this.map.get(type);
    if (!set) this.map.set(type, (set = new Set()));
    set.add(fn);
    return () => this.off(type, fn);
  }

  once<K extends PixiFormEventType>(type: K, fn: PixiFormListener<K>): () => void {
    const off = this.on(type, (d) => {
      off();
      fn(d);
    });
    return off;
  }

  off<K extends PixiFormEventType>(type: K, fn: PixiFormListener<K>): void {
    this.map.get(type)?.delete(fn);
  }

  /** Adds every listener in an `{ load() {…}, change() {…} }` object. */
  addAll(listeners: PixiFormListeners | undefined): void {
    if (!listeners) return;
    for (const [type, fn] of Object.entries(listeners)) {
      if (typeof fn === 'function' && (PIXIFORM_EVENTS as readonly string[]).includes(type)) this.on(type as PixiFormEventType, fn as PixiFormListener<any>);
    }
  }

  emit<K extends PixiFormEventType>(type: K, detail: PixiFormEventMap[K]): void {
    for (const fn of [...(this.map.get(type) ?? [])]) {
      try {
        fn(detail);
      } catch (err) {
        if (type === 'error') console.error('[pixiform] error listener failed', err);
        else this.emit('error', { error: err instanceof Error ? err : new Error(String(err)), phase: 'listener' });
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}
