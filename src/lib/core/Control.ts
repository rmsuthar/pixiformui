import { Circle, Container, Graphics, Rectangle, Text, type FederatedPointerEvent, type TextStyleOptions } from '../render/canvas';
import { createTheme, type DeepPartial, type Theme } from '../theme';
import type { FormUI } from './FormUI';
import type { AutocompleteToken, KeyboardTarget } from './KeyboardProxy';
import type { Focusable } from './types';

export type ValidationResult = string | null | undefined;
export interface ValidationContext {
  control: Control<unknown>;
  /** Look up sibling values (e.g. "confirm password"). Provided by Form. */
  getField?: (name: string) => Control<unknown> | undefined;
}
export type Validator<V> = ((value: V, ctx: ValidationContext) => ValidationResult | Promise<ValidationResult>) & {
  /** Short, value-free code reported to analytics when this validator fails (e.g. 'pattern'). Default 'invalid'. */
  code?: string;
};

export interface ControlOptions<V> {
  /** Field name used in submitted data. Must be unique within a Form. */
  name: string;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  /** Message shown when a required field is empty. */
  requiredMessage?: string;
  /**
   * Extra explanation shown in a tooltip from an ⓘ icon next to the label
   * (hover, tap, or F1 while focused). Also read by screen readers.
   */
  info?: string;
  /** Keep the label for screen readers but don't draw it (used inside composite controls). */
  hideLabel?: boolean;
  validators?: Validator<V>[];
  /** When to run validation automatically. */
  validateOn?: 'blur' | 'change' | 'submit';
  theme?: DeepPartial<Theme>;
  width?: number;
  tabIndex?: number;
}

const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

/**
 * Base class for every PixiForm control.
 * Layout: [label] / [body] / [helper or error message]
 *
 * Events: 'change' (value), 'focus', 'blur', 'validate' (error|null), 'resize'.
 */
export abstract class Control<V> extends Container implements Focusable {
  readonly ui: FormUI;
  readonly fieldName: string;
  focusOrder: number;
  readonly validators: Validator<V>[];
  validateOn: 'blur' | 'change' | 'submit';
  readonly required: boolean;
  private readonly customRequiredMessage?: string;
  touched = false;
  /** Injected by Form so validators can reach sibling fields. */
  formContext: (() => Partial<ValidationContext>) | null = null;

  readonly acceptsText: boolean = false;
  readonly secure: boolean = false;
  /** Short-lived credential (e.g. OTP): wiped by Form.wipeSecrets() like secrets. */
  readonly sensitive: boolean = false;
  /** False for UI-only fields (e.g. the human check) that Form leaves out of values() and serialize(). */
  readonly submits: boolean = true;
  /** True for buttons: never validated, submitted or tracked as a field. */
  readonly isAction: boolean = false;
  /**
   * Hidden by a condition (showIf / setVisible): Form skips it when validating and leaves it out
   * of values() and serialize(). Its value is kept, so it comes back if the field is shown again.
   */
  excluded = false;
  readonly inputMode: KeyboardTarget['inputMode'] = 'none';
  /** Autofill / password-manager token (opt-in per field; 'off' keeps them away). */
  readonly autocomplete: AutocompleteToken = 'off';
  readonly enterKeyHint: KeyboardTarget['enterKeyHint'] = 'next';

  protected readonly body = new Container();
  protected readonly focusRing = new Graphics();
  protected labelText: Text | null = null;
  protected infoIcon: Graphics | null = null;
  protected _info: string;
  protected messageText: Text;
  protected _label: string;
  protected _helper: string;
  protected _error: string | null = null;
  protected _errorCode: string | null = null;
  protected _enabled: boolean;
  protected _focused = false;
  protected _focusVisible = false;
  protected _hovered = false;
  protected _width: number;
  /** Inline-label controls (checkbox, toggle) draw their own label. */
  protected labelAbove = true;
  private themeOverride?: DeepPartial<Theme>;
  private cachedTheme: Theme | null = null;
  private lastHeight = 0;
  private validationSeq = 0;

  constructor(ui: FormUI, opts: ControlOptions<V>) {
    super();
    if (!SAFE_NAME.test(opts.name)) throw new Error(`Invalid control name "${opts.name}"`);
    this.ui = ui;
    this.fieldName = opts.name;
    this.label = opts.name;
    this._label = opts.label ?? '';
    this._helper = opts.helperText ?? '';
    this._info = opts.info ?? '';
    if (opts.hideLabel) this.labelAbove = false;
    this._enabled = !opts.disabled;
    this.required = !!opts.required;
    this.customRequiredMessage = opts.requiredMessage;
    this.validators = [...(opts.validators ?? [])];
    this.validateOn = opts.validateOn ?? 'blur';
    this.themeOverride = opts.theme;
    this._width = opts.width ?? 320;
    this.focusOrder = opts.tabIndex ?? 0;

    this.messageText = new Text({ text: '', style: this.textStyle('helper') });
    this.addChild(this.body, this.messageText);
    this.body.addChild(this.focusRing);

    ui.focus.register(this);
    ui.on('themechange', this.onThemeChange, this);
  }

  // ---------------------------------------------------------------- abstract
  abstract getValue(): V;
  abstract setValue(value: V, emit?: boolean): void;
  /** Restores the initial/empty value. */
  abstract reset(): void;
  /** Height of the body area for the current width. */
  protected abstract bodyHeight(): number;
  /** Redraws the body for the current state. */
  protected abstract drawBody(): void;
  /** True when the control holds no meaningful value (for `required`). */
  abstract isEmpty(): boolean;

  // ---------------------------------------------------------------- accessors
  get view(): Container {
    return this;
  }

  get theme(): Theme {
    if (!this.cachedTheme) this.cachedTheme = createTheme(this.ui.theme, this.themeOverride);
    return this.cachedTheme;
  }

  setThemeOverride(override: DeepPartial<Theme> | undefined): void {
    this.themeOverride = override;
    this.onThemeChange();
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(v: boolean) {
    if (this._enabled === v) return;
    this._enabled = v;
    if (!v && this._focused) this.ui.focus.blur();
    this.cursor = v ? this.enabledCursor() : 'not-allowed';
    this.redraw();
  }

  get focused(): boolean {
    return this._focused;
  }

  get error(): string | null {
    return this._error;
  }

  /** Machine-readable reason for the current error: 'required', 'invalid', 'server' or a validator's `code`. */
  get errorCode(): string | null {
    return this._errorCode;
  }

  private _invalidMark = false;

  /** Red error styling without a message (a composite parent shows the message). */
  markInvalid(flag: boolean): void {
    if (flag === this._invalidMark) return;
    this._invalidMark = flag;
    this.redraw();
  }

  /** True when the control should be drawn in its error colour. */
  protected get hasErrorState(): boolean {
    return !!this._error || this._invalidMark;
  }

  get fieldLabel(): string {
    return this._label;
  }

  set fieldLabel(v: string) {
    this._label = v;
    this.redraw();
  }

  /** Tooltip text for the ⓘ icon ('' hides the icon). */
  get infoText(): string {
    return this._info;
  }

  set infoText(v: string) {
    this._info = v ?? '';
    if (!this._info && this.ui.tooltip.anchor === this.infoIcon) this.ui.tooltip.hide();
    this.redraw();
    this.ui.focus.sync(this);
  }

  /** What the tooltip points at (the icon, or the control itself). */
  get infoAnchor(): Container {
    return this.infoIcon?.visible ? this.infoIcon : this;
  }

  get helperText(): string {
    return this._helper;
  }

  set helperText(v: string) {
    this._helper = v;
    this.redraw();
  }

  get layoutWidth(): number {
    return this._width;
  }

  get layoutHeight(): number {
    return this.headerHeight() + this.bodyHeight() + this.footerHeight();
  }

  layout(width: number): void {
    this._width = Math.max(40, width);
    this.redraw();
  }

  focus(): void {
    this.ui.focus.focus(this, true);
  }

  blur(): void {
    if (this._focused) this.ui.focus.blur();
  }

  isFocusable(): boolean {
    if (!this._enabled || this.destroyed) return false;
    let node: Container | null = this;
    while (node) {
      if (!node.visible || node.renderable === false) return false;
      node = node.parent;
    }
    return true;
  }

  setFocused(focused: boolean, viaKeyboard: boolean): void {
    this._focused = focused;
    if (focused) this._focusVisible = viaKeyboard || this.acceptsText;
    this.onFocusChanged(focused);
    this.redraw();
    this.emit(focused ? 'focus' : 'blur', this);
    if (!focused) {
      this.touched = true;
      if (this.validateOn === 'blur') void this.validate();
    }
  }

  // ---------------------------------------------------------------- validation
  setError(message: string | null, code?: string): void {
    const msg = message ? String(message).slice(0, 300) : null;
    const errCode = msg ? (code ?? 'invalid').slice(0, 40) : null;
    if (msg === this._error && errCode === this._errorCode) return;
    this._error = msg;
    this._errorCode = errCode;
    this.redraw();
    this.ui.focus.sync(this);
    this.emit('validate', msg);
  }

  /** Runs `required` + validators. Stale async results are discarded. */
  async validate(ctx: Partial<ValidationContext> = {}): Promise<string | null> {
    const seq = ++this.validationSeq;
    let error: string | null = null;
    let code: string | undefined;
    if (this.required && this.isEmpty()) {
      error = this.requiredMessage();
      code = 'required';
    } else {
      for (const v of this.validators) {
        try {
          const r = await v(this.getValue(), {
            ...this.formContext?.(),
            ...ctx,
            control: this as Control<unknown>,
          });
          if (r) {
            error = r;
            code = v.code;
            break;
          }
        } catch {
          error = 'Could not validate this field.';
          code = 'validator-error';
          break;
        }
      }
    }
    if (seq !== this.validationSeq) return this._error;
    this.setError(error, code);
    return error;
  }

  /** Emits 'change' and re-validates when appropriate. */
  protected commitChange(emit = true): void {
    if (emit) this.emit('change', this.getValue(), this);
    if (this.validateOn === 'change' || (this.touched && this._error)) void this.validate();
  }

  protected requiredMessage(): string {
    return this.customRequiredMessage ?? `${this._label || 'This field'} is required.`;
  }

  /** Securely clears sensitive memory. Overridden by secret fields. */
  wipe(): void {}

  // ---------------------------------------------------------------- KeyboardTarget
  get autofillName(): string {
    return this.fieldName;
  }

  ariaRole(): string {
    return 'textbox';
  }

  /** Accessible name: the label (required/invalid are separate ARIA states; help and errors are descriptions). */
  ariaLabel(): string {
    return this._label || this.fieldName;
  }

  ariaDescription(): { help?: string; error?: string } {
    const help = [this._helper, this._info].filter(Boolean).join('. ');
    return { help: help || undefined, error: this._error ?? undefined };
  }

  /**
   * Activates the control as Enter/Space would (used when a screen reader
   * clicks its item in the accessibility outline). Text fields just focus.
   */
  activate(): void {
    if (this.acceptsText || !this._enabled) return;
    const role = this.ariaRole();
    const key = role === 'checkbox' || role === 'switch' ? ' ' : 'Enter';
    this.handleKeyDown(new KeyboardEvent('keydown', { key }));
  }

  ariaState(): Record<string, string | null> {
    return {
      'aria-invalid': this._error ? 'true' : null,
      'aria-required': this.required ? 'true' : null,
      'aria-disabled': this._enabled ? null : 'true',
    };
  }

  handleKeyDown(_e: KeyboardEvent): boolean {
    return false;
  }
  handleText(_text: string): void {}
  handleDelete(_direction: 'backward' | 'forward'): void {}
  handlePaste(_text: string): void {}
  handleCopy(_cut: boolean): string | null {
    return null;
  }

  // ---------------------------------------------------------------- rendering helpers
  /** Recomputes layout and redraws everything. */
  redraw(): void {
    if (this.destroyed) return;
    const t = this.theme;
    const hh = this.headerHeight();

    if (this.labelAbove && this._label) {
      if (!this.labelText) {
        this.labelText = new Text({ text: '', style: this.textStyle('label') });
        this.addChild(this.labelText);
      }
      this.labelText.text = this.required ? `${this._label} *` : this._label;
      this.labelText.style = this.textStyle('label', this._enabled ? t.colors.text : t.colors.textDisabled);
      this.labelText.visible = true;
    } else if (this.labelText) {
      this.labelText.visible = false;
    }
    if (this.labelAbove) {
      const lineH = Math.ceil(t.labelFontSize * t.lineHeight);
      const x = this.labelText?.visible ? this.labelText.x + this.labelText.width + 6 : 0;
      this.placeInfo(this, x, lineH / 2);
    }

    this.body.y = hh;
    this.drawBody();

    const msg = this._error ?? this.footerMessage();
    this.messageText.text = msg;
    this.messageText.style = this.textStyle(
      'helper',
      this._error ? t.colors.error : this._enabled ? (this.footerColor() ?? t.colors.textMuted) : t.colors.textDisabled,
      this._width,
    );
    this.messageText.visible = !!msg;
    this.messageText.y = hh + this.bodyHeight() + t.helperGap;

    const h = this.layoutHeight;
    // Everything a control draws (focus ring, thumbs, shake) stays within 12px of its box.
    this.cullArea = new Rectangle(-12, -12, this._width + 24, h + 24);
    if (h !== this.lastHeight) {
      this.lastHeight = h;
      this.emit('resize', this);
    }
  }

  protected footerMessage(): string {
    return this._helper;
  }

  /** Override to colour the helper line (e.g. warnings). */
  protected footerColor(): number | null {
    return null;
  }

  protected headerHeight(): number {
    if (!this.labelAbove || (!this._label && !this._info)) return 0;
    const t = this.theme;
    return Math.ceil(t.labelFontSize * t.lineHeight) + t.labelGap;
  }

  protected footerHeight(): number {
    const msg = this._error ?? this.footerMessage();
    if (!msg) return 0;
    const t = this.theme;
    this.messageText.style.wordWrapWidth = this._width;
    return t.helperGap + Math.ceil(Math.max(this.messageText.height, t.helperFontSize * t.lineHeight));
  }

  textStyle(kind: 'body' | 'label' | 'helper', fill?: number, wrapWidth?: number): TextStyleOptions {
    const t = this.theme;
    const size = kind === 'label' ? t.labelFontSize : kind === 'helper' ? t.helperFontSize : t.fontSize;
    return {
      fontFamily: t.fontFamily.join(','),
      fontSize: size,
      fontWeight: kind === 'label' ? t.labelFontWeight : t.fontWeight,
      fill: fill ?? (kind === 'helper' ? t.colors.textMuted : t.colors.text),
      lineHeight: Math.ceil(size * t.lineHeight),
      wordWrap: !!wrapWidth,
      wordWrapWidth: wrapWidth ?? 0,
      breakWords: !!wrapWidth,
    };
  }

  /** Width taken by the info icon when present (for inline-label layouts). */
  protected infoIconSpace(): number {
    return this._info ? 22 : 0;
  }

  /**
   * Places the ⓘ icon inside `parent` with its left edge at `x`, vertically
   * centred on `cy`. Built-in controls call this; custom inline-label controls can too.
   */
  protected placeInfo(parent: Container, x: number, cy: number): void {
    if (!this._info) {
      if (this.infoIcon) this.infoIcon.visible = false;
      return;
    }
    if (!this.infoIcon) this.infoIcon = this.createInfoIcon();
    if (this.infoIcon.parent !== parent) parent.addChild(this.infoIcon);
    const t = this.theme;
    const r = Math.round(Math.max(6.5, t.labelFontSize * 0.55));
    const hovered = this.ui.tooltip.isOpen && this.ui.tooltip.anchor === this.infoIcon;
    const color = !this._enabled ? t.colors.textDisabled : hovered ? t.colors.primary : t.colors.textMuted;
    const g = this.infoIcon.clear();
    g.circle(0, 0, r).stroke({ width: 1.4, color });
    g.circle(0, -r * 0.42, r * 0.14).fill(color);
    g.roundRect(-r * 0.11, -r * 0.12, r * 0.22, r * 0.62, r * 0.1).fill(color);
    g.position.set(Math.round(x + r), Math.round(cy));
    g.hitArea = new Circle(0, 0, r + 8);
    g.visible = true;
  }

  private createInfoIcon(): Graphics {
    const g = new Graphics();
    g.eventMode = 'static';
    g.cursor = 'help';
    const show = () => {
      this.ui.tooltip.show(g, this._info, g);
      this.redraw();
    };
    const hide = () => {
      this.ui.tooltip.hide(g);
      this.redraw();
    };
    g.on('pointerover', (e: FederatedPointerEvent) => e.pointerType === 'mouse' && show());
    g.on('pointerout', (e: FederatedPointerEvent) => e.pointerType === 'mouse' && hide());
    g.on('pointerdown', (e: FederatedPointerEvent) => {
      this.ui.focus.claimed = true; // don't blur the focused control
      e.stopPropagation();
    });
    g.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation(); // e.g. don't toggle a checkbox
      if (e.pointerType !== 'mouse') {
        this.ui.tooltip.toggle(g, this._info, g);
        this.redraw();
      }
    });
    return g;
  }

  /** Draws a rounded focus ring around a body-local rectangle. */
  protected drawFocus(x: number, y: number, w: number, h: number, r: number): void {
    const t = this.theme;
    const g = this.focusRing.clear();
    if (!this._focused || !this._focusVisible) return;
    const o = t.focusRingOffset + t.focusRingWidth / 2;
    g.roundRect(x - o, y - o, w + o * 2, h + o * 2, r + o).stroke({
      width: t.focusRingWidth,
      color: this._error ? t.colors.error : t.colors.focusRing,
      alpha: 0.85,
    });
  }

  protected enabledCursor(): string {
    return 'pointer';
  }

  /**
   * Flutter-style tap handling: fires `onTap` on pointer up, but not if the
   * touch turned into a scroll. Mouse focuses on press; touch focuses on tap
   * (so scrolling past a field never pops up the keyboard).
   */
  protected bindTap(target: Container, onTap: (e: FederatedPointerEvent) => void): void {
    target.on('pointerdown', (e: FederatedPointerEvent) => {
      this.ui.focus.claimed = true;
      if (e.pointerType === 'mouse' && this._enabled) this.ui.focus.focus(this, false);
    });
    target.on('pointertap', (e: FederatedPointerEvent) => {
      if (this.ui.focus.gestureMoved || !this._enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType !== 'mouse') this.ui.focus.focus(this, false);
      onTap(e);
    });
  }

  /** Call from pointerdown handlers so the stage doesn't blur this control. */
  protected claimFocus(): void {
    this.ui.focus.claimed = true;
    if (this._enabled) this.ui.focus.focus(this, false);
  }

  protected onFocusChanged(_focused: boolean): void {}

  private onThemeChange(): void {
    this.cachedTheme = null;
    this.redraw();
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.wipe();
    this.ui.focus.unregister(this);
    this.ui.off('themechange', this.onThemeChange, this);
    super.destroy(options ?? { children: true });
  }
}
