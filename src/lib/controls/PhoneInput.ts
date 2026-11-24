import { Control, type ControlOptions } from '../core/Control';
import type { FormUI } from '../core/FormUI';
import { Select } from './Select';
import { TextInput, type TextInputOptions } from './TextInput';
import { COUNTRIES, flagEmoji, formatNational, type Country } from './countries';

export interface PhoneInputOptions extends ControlOptions<string> {
  /** Initial value in E.164 (e.g. '+919876543210'). */
  value?: string;
  /** ISO code of the default country. Default: from the browser locale, else 'US'. */
  defaultCountry?: string;
  /** ISO codes listed first in the menu. */
  preferredCountries?: string[];
  /** Restrict the menu to these ISO codes. */
  onlyCountries?: string[];
  /** Replace or extend the built-in country list. */
  countries?: Country[];
  /** Show flag emoji. Default: true except on Windows (no flag glyphs). */
  showFlags?: boolean;
  placeholder?: string;
  /**
   * Let the browser offer the saved phone number (autocomplete="tel"). A full international
   * number like +44 7911 123456 picks the country automatically. Default false.
   */
  autocomplete?: boolean;
}

const IS_WINDOWS = /Win/.test(navigator.platform || navigator.userAgent);

/** Number part: digits/spaces only, and hands international input (+…, 00…) to the parent. */
class NationalNumberField extends TextInput {
  onInternational: ((text: string) => void) | null = null;

  /** Multi-character input (SMS/contact autofill, IME commit) with a + or 00 prefix is a full number. */
  override handleText(text: string): void {
    if (this.onInternational && text.length > 1 && /^\s*(\+|00)/.test(text)) {
      this.onInternational(text);
      return;
    }
    super.handleText(text);
  }

  override handlePaste(text: string): void {
    if (this.onInternational && /^\s*(\+|00)/.test(text)) {
      this.onInternational(text);
      return;
    }
    super.handlePaste(text);
  }
}

/**
 * Phone number with country code. Value: E.164 string ('+447911123456'),
 * or '' when empty. One label/error for the field; two tab stops inside
 * (country menu, then number).
 *
 * - The number is formatted live with the country's pattern.
 * - Pasting or typing an international number (+44…, 0044…) switches the country.
 * - The domestic trunk prefix (e.g. a leading 0) is dropped automatically.
 * - Built-in validation checks the length for the selected country.
 */
export class PhoneInput extends Control<string> {
  private focusInside = false;
  readonly countryField: Select<string>;
  readonly numberField: NationalNumberField;
  private readonly countries: Country[];
  private readonly byIso = new Map<string, Country>();
  private readonly initial: string;
  private readonly initialCountry: string;
  private country: Country;
  private formatting = false;
  private baseLabel = '';
  private width_ = 0;

  constructor(ui: FormUI, opts: PhoneInputOptions) {
    super(ui, opts);
    let list = opts.countries ?? COUNTRIES;
    if (opts.onlyCountries?.length) list = list.filter((c) => opts.onlyCountries!.includes(c.iso));
    const pref = opts.preferredCountries ?? [];
    this.countries = [...pref.map((p) => list.find((c) => c.iso === p)).filter((c): c is Country => !!c), ...list.filter((c) => !pref.includes(c.iso))];
    for (const c of this.countries) this.byIso.set(c.iso, c);
    const region = (navigator.language.split('-')[1] ?? '').toUpperCase();
    this.initialCountry = this.byIso.has(opts.defaultCountry ?? '') ? opts.defaultCountry! : this.byIso.has(region) ? region : this.byIso.has('US') ? 'US' : this.countries[0].iso;
    this.country = this.byIso.get(this.initialCountry)!;
    const flags = opts.showFlags ?? !IS_WINDOWS;
    const badge = (c: Country) => (flags ? `${flagEmoji(c.iso)}  +${c.dial}` : `${c.iso} +${c.dial}`);

    const childBase = { theme: opts.theme, disabled: opts.disabled, hideLabel: true };
    this.countryField = new Select<string>(ui, {
      ...childBase,
      name: `${this.fieldName}Country`,
      label: `${opts.label ?? 'Phone'} country code`,
      value: this.country.iso,
      // Plain labels drive type-ahead ("uni" → United…) and screen readers; flags are display-only.
      options: this.countries.map((c) => ({ value: c.iso, label: `${c.name} (+${c.dial})` })),
      formatOption: (o) => (flags ? `${flagEmoji(o.value)}  ${o.label}` : o.label),
      formatSelected: (o) => badge(this.byIso.get(o.value)!),
      menuWidth: 300,
      validateOn: 'submit',
    });
    this.numberField = new NationalNumberField(ui, {
      ...childBase,
      name: `${this.fieldName}Number`,
      label: opts.label ?? 'Phone number',
      placeholder: opts.placeholder ?? this.example(),
      inputMode: 'tel',
      autocomplete: opts.autocomplete ? 'tel' : 'off',
      allow: /[0-9 +]/,
      maxLength: 22,
      validateOn: 'submit',
    } as TextInputOptions);
    this.numberField.onInternational = (text) => this.applyInternational(text);
    this.baseLabel = opts.label ?? 'Phone number';
    this.syncNumberLabel();
    this.body.addChild(this.countryField, this.numberField);

    this.countryField.on('change', (iso: string) => {
      this.country = this.byIso.get(iso) ?? this.country;
      if (!opts.placeholder) this.numberField.placeholder = this.example();
      this.syncNumberLabel();
      this.reformat(true);
      this.commitChange(true);
      if (this.countryField.focused) this.numberField.focus();
    });
    this.numberField.on('input', () => this.reformat(false));
    this.numberField.on('change', () => !this.formatting && this.commitChange(true));
    this.numberField.on('submit', () => this.emit('submit', this));
    for (const child of [this.countryField, this.numberField]) {
      child.on('resize', () => this.redraw());
      child.on('blur', () => queueMicrotask(() => this.onChildBlur()));
      // The composite emits one focus/blur pair while focus is anywhere inside it.
      child.on('focus', () => {
        if (this.focusInside) return;
        this.focusInside = true;
        this.emit('focus', this);
      });
    }
    this.validators.unshift((v) => this.lengthError(v));
    this.initial = opts.value ?? '';
    if (this.initial) this.setValue(this.initial, false);
    this.redraw();
  }

  // ------------------------------------------------------------------ value
  /** E.164, e.g. '+919876543210'. '' when no digits are entered. */
  getValue(): string {
    const raw = this.numberField?.getValue() ?? '';
    if (/^\s*(\+|00)/.test(raw)) {
      // Typed in international form and not yet resolved to a country.
      const d = raw.replace(/\D/g, '').replace(/^00/, '');
      return d ? `+${d}` : '';
    }
    const digits = this.nationalDigits();
    return digits ? `+${this.country.dial}${digits}` : '';
  }

  setValue(value: string, emit = true): void {
    if (!value) {
      this.numberField.setValue('', false);
    } else {
      this.applyInternational(value, false);
    }
    if (emit) this.commitChange(true);
    else this.redraw();
  }

  /** Selected country, national digits and E.164 value. */
  getParts(): { country: Country; national: string; e164: string } {
    return { country: this.country, national: this.nationalDigits(), e164: this.getValue() };
  }

  isEmpty(): boolean {
    return this.nationalDigits().length === 0;
  }

  reset(): void {
    this.countryField.setValue(this.initialCountry, false);
    this.country = this.byIso.get(this.initialCountry)!;
    this.numberField.reset();
    if (this.initial) this.applyInternational(this.initial, false);
    this.touched = false;
    this.setError(null);
    this.redraw();
  }

  /** Focus goes to the number part. */
  override focus(): void {
    this.numberField.focus();
  }

  override isFocusable(): boolean {
    return false; // the two inner parts are the tab stops
  }

  override setError(message: string | null, code?: string): void {
    super.setError(message, code);
    this.countryField?.markInvalid(!!message);
    this.numberField?.markInvalid(!!message);
  }

  override get enabled(): boolean {
    return this._enabled;
  }

  override set enabled(v: boolean) {
    super.enabled = v;
    this.countryField.enabled = v;
    this.numberField.enabled = v;
  }

  // ------------------------------------------------------------------ helpers
  /** Screen readers hear the country with the number, e.g. "Phone, United Kingdom +44". */
  private syncNumberLabel(): void {
    this.numberField.fieldLabel = `${this.baseLabel}, ${this.country.name} +${this.country.dial}`;
    this.ui.focus.sync(this.numberField);
  }

  private nationalDigits(): string {
    let d = (this.numberField?.getValue() ?? '').replace(/\D/g, '');
    const trunk = this.country.trunk;
    if (trunk && d.startsWith(trunk)) d = d.slice(trunk.length);
    return d;
  }

  private example(): string {
    const c = this.country;
    return formatNational('9876543210987'.slice(0, c.max), c.pattern);
  }

  private lengthError(value: string): string | null {
    if (!value) return null;
    const n = this.nationalDigits().length;
    const c = this.country;
    if (n < c.min || n > c.max) {
      const len = c.min === c.max ? `${c.min}` : `${c.min}–${c.max}`;
      return `Enter a valid ${c.name} number (${len} digits).`;
    }
    if (value.length > 16) return 'Phone numbers can have at most 15 digits.';
    return null;
  }

  /** Live formatting while the caret is at the end of the number. */
  private reformat(force: boolean): void {
    const f = this.numberField;
    const raw = f.getValue();
    if (/^\s*(\+|00)/.test(raw)) {
      // Typing "+44…": switch country once the dial code plus a few digits are known.
      const d = raw.replace(/\D/g, '').replace(/^00/, '');
      if (force || d.length >= 8) this.applyInternational(raw, false);
      return;
    }
    let digits = raw.replace(/\D/g, '');
    const trunk = this.country.trunk;
    if (trunk && digits.startsWith(trunk)) digits = digits.slice(trunk.length);
    const formatted = formatNational(digits, this.country.pattern);
    const [, selEnd] = f.getSelection();
    if (formatted !== raw && (force || selEnd === f.length)) {
      this.formatting = true;
      f.setValue(formatted, false);
      this.formatting = false;
    }
  }

  /** Parses '+44 7911 123456' / '0044…', picks the country, keeps the national digits. */
  private applyInternational(text: string, emit = true): void {
    let digits = text.replace(/\D/g, '');
    if (/^\s*00/.test(text)) digits = digits.slice(2);
    // Longest matching dial code; prefer the current country when codes are shared (+1 US/CA).
    let match: Country | undefined;
    for (const c of this.countries) {
      if (!digits.startsWith(c.dial)) continue;
      if (!match || c.dial.length > match.dial.length || (c.dial === match.dial && c.iso === this.country.iso)) match = c;
    }
    if (match) {
      this.country = match;
      this.countryField.setValue(match.iso, false);
      digits = digits.slice(match.dial.length);
      this.numberField.placeholder = this.example();
      this.syncNumberLabel();
    }
    this.numberField.setValue(formatNational(digits, this.country.pattern), false);
    if (emit) {
      this.ui.announcer.announce(`${this.country.name}, +${this.country.dial}`);
      this.commitChange(true);
    }
    this.redraw();
  }

  private onChildBlur(): void {
    const cur = this.ui.focus.current;
    if (cur === this.countryField || cur === this.numberField) return; // focus moved inside
    this.focusInside = false;
    this.touched = true;
    this.reformat(true);
    if (this.validateOn === 'blur' || this._error) void this.validate();
    this.emit('blur', this);
  }

  // ------------------------------------------------------------------ layout
  protected bodyHeight(): number {
    if (!this.countryField) return this.theme.controlHeight;
    return Math.max(this.countryField.layoutHeight, this.numberField.layoutHeight);
  }

  protected drawBody(): void {
    if (!this.countryField || !this.numberField) return;
    if (this.width_ !== this._width) {
      this.width_ = this._width;
      const cw = Math.round(Math.max(104, Math.min(140, this._width * 0.32)));
      this.countryField.layout(cw);
      this.numberField.layout(this._width - cw - 8);
      this.numberField.x = cw + 8;
    }
  }

  override layout(width: number): void {
    this.width_ = 0;
    super.layout(width);
  }
}
