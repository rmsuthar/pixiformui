import { Control, type ControlOptions } from '../core/Control';
import type { FormUI } from '../core/FormUI';

export type HiddenValue = string | number | boolean | null;

export interface HiddenFieldOptions extends Pick<ControlOptions<HiddenValue>, 'name'> {
  /** The value submitted with the form. */
  value?: HiddenValue;
}

/**
 * A value that is submitted with the form but never shown, like `<input type="hidden">`:
 * a campaign or referral code, a record id, a plan picked on the previous page.
 *
 *   { type: 'hidden', name: 'campaign', value: 'spring-sale' }
 *   handle.get('campaign')!.setValue(new URLSearchParams(location.search).get('utm_campaign'));
 *
 * Nothing about it is drawn, focusable or in the accessibility outline, and its value isn't in
 * the page's HTML either. Anyone can still change what is sent (it's their browser), so your
 * server must treat it as untrusted input like any other field. Don't put secrets in it.
 */
export class HiddenField extends Control<HiddenValue> {
  private value: HiddenValue;
  private readonly initial: HiddenValue;

  constructor(ui: FormUI, opts: HiddenFieldOptions) {
    super(ui, { name: opts.name, hideLabel: true, validateOn: 'submit' });
    this.value = this.initial = HiddenField.clean(opts.value ?? null);
    this.visible = false;
    this.eventMode = 'none';
  }

  private static clean(v: unknown): HiddenValue {
    if (v === null || v === undefined) return null;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    return String(v).slice(0, 2048);
  }

  getValue(): HiddenValue {
    return this.value;
  }

  setValue(v: HiddenValue, emit = true): void {
    const n = HiddenField.clean(v);
    if (n === this.value) return;
    this.value = n;
    if (emit) this.emit('change', n, this);
  }

  isEmpty(): boolean {
    return this.value === null || this.value === '';
  }

  reset(): void {
    this.value = this.initial;
  }

  override isFocusable(): boolean {
    return false;
  }

  /** Always hidden, whatever a showIf rule says. */
  override get visible(): boolean {
    return false;
  }

  override set visible(_v: boolean) {
    // ignore: a hidden field is never drawn
  }

  protected bodyHeight(): number {
    return 0;
  }

  override get layoutHeight(): number {
    return 0;
  }

  protected drawBody(): void {}

  override redraw(): void {}
}
