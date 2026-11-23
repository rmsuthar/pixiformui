import { Graphics, type FederatedPointerEvent } from '../render/canvas';
import type { FormUI } from '../core/FormUI';
import { Icons } from '../core/icons';
import { Secret } from '../security/Secret';
import { TextField, type TextFieldOptions } from './TextField';

export interface PasswordInputOptions extends Omit<TextFieldOptions<Secret>, 'multiline' | 'rows'> {
  /** Show the eye button that toggles visibility. Default true. */
  showVisibilityToggle?: boolean;
  /** Automatically re-obscure after this many ms of being visible. Default 10s, 0 = never. */
  revealTimeoutMs?: number;
  /**
   * Briefly show the last typed character, like Flutter's obscureText on mobile.
   * 'auto' = only on touch devices. Default 'auto'.
   */
  revealLastChar?: boolean | 'auto';
  revealLastCharMs?: number;
  /** Like Flutter's obscuringCharacter. Default '•'. */
  obscuringCharacter?: string;
  /** Allow pasting (recommended so password managers work). Default true. */
  allowPaste?: boolean;
  /** Warn when Caps Lock is on. Default true. */
  capsLockWarning?: boolean;
}

/**
 * Obscured text field for secrets.
 *
 * - Value is held in a wipeable SecureBuffer and exposed only as a `Secret`.
 * - Copy/cut are blocked, selection highlight is shown but never exportable.
 * - No undo history (it would retain old secrets).
 * - The keyboard proxy switches to type=password so OS keyboards don't learn it.
 * - Re-obscures on blur, on tab hide, and after `revealTimeoutMs`.
 */
export class PasswordInput extends TextField<Secret> {
  override readonly secure = true;
  private readonly secret: Secret;
  private readonly eye = new Graphics();
  private readonly showToggle: boolean;
  private readonly revealTimeoutMs: number;
  private readonly revealLast: boolean;
  private readonly revealLastMs: number;
  private readonly allowPaste: boolean;
  private readonly capsWarning: boolean;
  private revealed = false;
  private revealTimer = 0;
  private lastCharTimer = 0;
  private capsLock = false;

  constructor(ui: FormUI, opts: PasswordInputOptions) {
    super(ui, { maxLength: 128, ...opts, multiline: false, normalize: opts.normalize ?? 'NFKC' });
    this.secret = new Secret(this.buf);
    this.masked = true;
    this.showToggle = opts.showVisibilityToggle ?? true;
    this.revealTimeoutMs = opts.revealTimeoutMs ?? 10_000;
    const auto = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.revealLast = opts.revealLastChar === 'auto' || opts.revealLastChar === undefined ? auto : opts.revealLastChar;
    this.revealLastMs = opts.revealLastCharMs ?? 1000;
    const oc = [...(opts.obscuringCharacter ?? '•')][0] ?? '•';
    this.obscuringCharacter = oc;
    this.allowPaste = opts.allowPaste ?? true;
    this.capsWarning = opts.capsLockWarning ?? true;
    this.trailingWidth = this.showToggle ? 36 : 0;
    this.body.addChild(this.eye);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.redraw();
  }

  /** Opaque handle; call `secret.use(plain => ...)` only when submitting. */
  getValue(): Secret {
    return this.secret;
  }

  setValue(value: Secret, emit = true): void {
    if (value === this.secret) return;
    if (value.isEmpty) {
      this.wipe();
      this.contentChanged(emit);
      return;
    }
    value.use((plain) => this.setText(plain, emit));
  }

  get isRevealed(): boolean {
    return this.revealed;
  }

  setRevealed(v: boolean): void {
    if (v === this.revealed) return;
    this.revealed = v;
    this.masked = !v;
    this.revealIndex = -1;
    window.clearTimeout(this.revealTimer);
    if (v && this.revealTimeoutMs > 0) {
      this.revealTimer = window.setTimeout(() => this.setRevealed(false), this.revealTimeoutMs);
    }
    this.layoutDirty = true;
    this.drawBody();
    this.ui.announcer.announce(v ? 'Password visible' : 'Password hidden');
  }

  override wipe(): void {
    window.clearTimeout(this.lastCharTimer);
    this.revealIndex = -1;
    super.wipe();
    if (this.revealed) this.setRevealed(false);
  }

  override reset(): void {
    this.wipe();
    super.reset();
  }

  // -------------------------------------------------------- input overrides
  override handleCopy(_cut: boolean): string | null {
    this.ui.announcer.announce('Copying is disabled for this field.');
    return null;
  }

  override handlePaste(text: string): void {
    if (!this.allowPaste) {
      this.ui.announcer.announce('Pasting is disabled for this field.');
      return;
    }
    super.handlePaste(text);
  }

  override handleKeyDown(e: KeyboardEvent): boolean {
    if (this.capsWarning && typeof e.getModifierState === 'function') {
      const caps = e.getModifierState('CapsLock');
      if (caps !== this.capsLock) {
        this.capsLock = caps;
        this.redraw();
        if (caps) this.ui.announcer.announce('Caps Lock is on');
      }
    }
    return super.handleKeyDown(e);
  }

  protected override onInserted(index: number, count: number): void {
    window.clearTimeout(this.lastCharTimer);
    if (!this.revealLast || this.revealed || count !== 1) {
      this.revealIndex = -1;
      return;
    }
    this.revealIndex = index;
    this.lastCharTimer = window.setTimeout(() => {
      this.revealIndex = -1;
      this.layoutDirty = true;
      this.drawBody();
    }, this.revealLastMs);
  }

  override ariaState(): Record<string, string | null> {
    return { ...super.ariaState(), 'aria-roledescription': 'password' };
  }

  protected override onFocusChanged(focused: boolean): void {
    super.onFocusChanged(focused);
    if (!focused) {
      this.setRevealed(false);
      this.revealIndex = -1;
      this.layoutDirty = true;
    }
  }

  protected override footerMessage(): string {
    if (this.capsLock && this._focused) return 'Caps Lock is on';
    return super.footerMessage();
  }

  protected override footerColor(): number | null {
    return this.capsLock && this._focused ? this.theme.colors.warning : null;
  }

  // -------------------------------------------------------- drawing
  protected override handleTrailingClick(e: FederatedPointerEvent): boolean {
    if (!this.showToggle) return false;
    const p = e.getLocalPosition(this.body);
    if (p.x < this._width - this.trailingWidth - 4) return false;
    this.setRevealed(!this.revealed);
    return true;
  }

  protected override drawTrailing(w: number, h: number): void {
    if (!this.eye) return;
    const g = this.eye.clear();
    if (!this.showToggle) return;
    const c = this.theme.colors;
    Icons.eye(g, w - 22, h / 2, 20, this._enabled ? c.textMuted : c.textDisabled, !this.revealed);
  }

  override destroy(options?: Parameters<TextField<Secret>['destroy']>[0]): void {
    window.clearTimeout(this.revealTimer);
    window.clearTimeout(this.lastCharTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    super.destroy(options);
  }

  private onVisibility = (): void => {
    if (document.hidden) this.setRevealed(false);
  };
}
