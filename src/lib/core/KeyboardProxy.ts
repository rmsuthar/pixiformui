/**
 * What the focused control must implement to receive keyboard input.
 */
export interface KeyboardTarget {
  /** True for text fields (shows the virtual keyboard). */
  readonly acceptsText: boolean;
  /** Secret fields switch the proxy to type=password (no OS keyboard learning). */
  readonly secure: boolean;
  readonly inputMode: 'none' | 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'url' | 'search';
  readonly enterKeyHint: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
  /** Optional autocomplete token for the proxy, e.g. 'one-time-code' (SMS code autofill). Default 'off'. */
  readonly autocomplete?: 'off' | 'one-time-code';
  ariaRole(): string;
  ariaLabel(): string;
  ariaState(): Record<string, string | null>;
  /** Help and error text, exposed via aria-describedby / aria-errormessage (not packed into the label). */
  ariaDescription?(): { help?: string; error?: string };
  handleKeyDown(e: KeyboardEvent): boolean;
  handleText(text: string): void;
  handleDelete(direction: 'backward' | 'forward'): void;
  handlePaste(text: string): void;
  /** Return the text to put on the clipboard, or null to block. */
  handleCopy(cut: boolean): string | null;
}

export interface KeyboardProxyHooks {
  onBlur(): void;
  onKeyDown(e: KeyboardEvent): boolean;
  onTrustedInteraction(e: Event): void;
}

/**
 * A single off-screen <input> used purely as a keyboard/IME/clipboard bridge.
 *
 * Security properties:
 * - The element never holds field content: after every input event its value is
 *   reset to a single zero-width sentinel. Field values live in SecureBuffers.
 * - Untrusted (script-dispatched) events are ignored.
 * - Autofill, autocorrect, spellcheck (which can send text to cloud services),
 *   and password-manager heuristics are disabled.
 */
export class KeyboardProxy {
  readonly element: HTMLInputElement;
  private target: KeyboardTarget | null = null;
  private composing = false;
  private suppressBlur = false;
  private static readonly SENTINEL = '​';
  private static seq = 0;
  private readonly helpEl: HTMLElement;
  private readonly errorEl: HTMLElement;

  constructor(
    host: HTMLElement,
    private readonly hooks: KeyboardProxyHooks,
    /** Element whose top-left is the origin of control coordinates (the canvas). Defaults to the host. */
    private readonly origin: () => DOMRect = () => host.getBoundingClientRect(),
  ) {
    const el = document.createElement('input');
    el.type = 'text';
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('data-lpignore', 'true');
    el.setAttribute('data-1p-ignore', 'true');
    el.setAttribute('data-bwignore', 'true');
    el.setAttribute('data-form-type', 'other');
    el.setAttribute('aria-autocomplete', 'none');
    el.tabIndex = -1;
    const s = el.style;
    s.position = 'fixed';
    s.left = '0px';
    s.top = '0px';
    s.width = '1px';
    s.height = '1px';
    s.padding = '0';
    s.border = '0';
    s.margin = '0';
    s.opacity = '0';
    s.pointerEvents = 'none';
    s.fontSize = '16px'; // prevents iOS zoom-on-focus
    s.color = 'transparent';
    s.background = 'transparent';
    s.caretColor = 'transparent';
    s.outline = 'none';
    s.zIndex = '-1';
    host.appendChild(el);
    this.element = el;
    // Hidden description targets (aria-describedby works with hidden elements).
    const id = `pixiform-proxy-${++KeyboardProxy.seq}`;
    this.helpEl = document.createElement('span');
    this.errorEl = document.createElement('span');
    this.helpEl.id = `${id}-help`;
    this.errorEl.id = `${id}-error`;
    this.helpEl.hidden = this.errorEl.hidden = true;
    host.appendChild(this.helpEl);
    host.appendChild(this.errorEl);
    this.reset();

    el.addEventListener('keydown', this.onKeyDown);
    el.addEventListener('input', this.onInput as EventListener);
    el.addEventListener('compositionstart', this.onCompositionStart);
    el.addEventListener('compositionend', this.onCompositionEnd);
    el.addEventListener('paste', this.onPaste);
    el.addEventListener('copy', this.onCopy);
    el.addEventListener('cut', this.onCut);
    el.addEventListener('drop', this.block);
    el.addEventListener('dragover', this.block);
    el.addEventListener('blur', this.onBlur);
  }

  get current(): KeyboardTarget | null {
    return this.target;
  }

  attach(target: KeyboardTarget, screenRect?: { x: number; y: number; width: number; height: number }): void {
    this.target = target;
    const el = this.element;
    const wantType = target.secure ? 'password' : 'text';
    if (el.type !== wantType) el.type = wantType;
    el.inputMode = target.acceptsText ? target.inputMode : 'none';
    el.enterKeyHint = target.enterKeyHint;
    el.readOnly = !target.acceptsText;
    el.setAttribute('autocomplete', target.autocomplete ?? 'off');
    this.syncAria();
    if (screenRect) this.position(screenRect);
    this.reset();
    if (document.activeElement !== el) {
      this.suppressBlur = true;
      el.focus({ preventScroll: true });
      this.suppressBlur = false;
    }
  }

  detach(): void {
    this.target = null;
    this.reset();
    this.element.type = 'text';
    this.element.setAttribute('autocomplete', 'off');
    for (const a of ['aria-label', 'aria-describedby', 'aria-errormessage']) this.element.removeAttribute(a);
    this.helpEl.textContent = this.errorEl.textContent = '';
    if (document.activeElement === this.element) {
      this.suppressBlur = true;
      this.element.blur();
      this.suppressBlur = false;
    }
  }

  /** Re-reads ARIA info from the target (call after state changes). */
  syncAria(): void {
    const t = this.target;
    const el = this.element;
    if (!t) return;
    el.setAttribute('role', t.ariaRole());
    el.setAttribute('aria-label', t.ariaLabel());
    for (const [k, v] of Object.entries(t.ariaState())) {
      if (v === null) el.removeAttribute(k);
      else el.setAttribute(k, v);
    }
    const d = t.ariaDescription?.() ?? {};
    this.helpEl.textContent = d.help ?? '';
    this.errorEl.textContent = d.error ?? '';
    const ids = [d.error ? this.errorEl.id : '', d.help ? this.helpEl.id : ''].filter(Boolean).join(' ');
    if (ids) el.setAttribute('aria-describedby', ids);
    else el.removeAttribute('aria-describedby');
    if (d.error) el.setAttribute('aria-errormessage', this.errorEl.id);
    else el.removeAttribute('aria-errormessage');
  }

  /** Keeps the IME candidate window / mobile scroll anchored at the control. */
  position(rect: { x: number; y: number; width: number; height: number }): void {
    const o = this.origin();
    this.element.style.left = `${Math.round(o.left + rect.x)}px`;
    this.element.style.top = `${Math.round(o.top + rect.y + rect.height - 1)}px`;
  }

  destroy(): void {
    this.target = null;
    this.element.remove();
    this.helpEl.remove();
    this.errorEl.remove();
  }

  private reset(): void {
    const el = this.element;
    el.value = KeyboardProxy.SENTINEL;
    try {
      el.setSelectionRange(1, 1);
    } catch {
      /* not focusable yet */
    }
  }

  private takeValue(): string {
    const v = this.element.value.split(KeyboardProxy.SENTINEL).join('');
    this.reset();
    return v;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!e.isTrusted) {
      e.preventDefault();
      return;
    }
    this.hooks.onTrustedInteraction(e);
    if (this.composing || e.isComposing || e.keyCode === 229) return;
    if (this.hooks.onKeyDown(e)) {
      e.preventDefault();
      return;
    }
    if (this.target?.handleKeyDown(e)) e.preventDefault();
  };

  private onInput = (e: InputEvent): void => {
    if (!e.isTrusted) {
      this.reset();
      return;
    }
    if (this.composing || e.isComposing) return;
    const t = this.target;
    const type = e.inputType || '';
    if (!t || !t.acceptsText) {
      this.reset();
      return;
    }
    if (type.startsWith('delete')) {
      this.reset();
      t.handleDelete(type.includes('Forward') ? 'forward' : 'backward');
      return;
    }
    if (type === 'insertLineBreak' || type === 'insertParagraph') {
      this.reset();
      t.handleText('\n');
      return;
    }
    const text = this.takeValue();
    if (text) t.handleText(text);
  };

  private onCompositionStart = (e: CompositionEvent): void => {
    if (!e.isTrusted) return;
    this.composing = true;
  };

  private onCompositionEnd = (e: CompositionEvent): void => {
    this.composing = false;
    if (!e.isTrusted) {
      this.reset();
      return;
    }
    // Read from the element (not e.data) so a trailing input event is idempotent.
    const text = this.takeValue();
    if (text && this.target?.acceptsText) this.target.handleText(text);
  };

  private onPaste = (e: ClipboardEvent): void => {
    e.preventDefault();
    if (!e.isTrusted || !this.target?.acceptsText) return;
    this.hooks.onTrustedInteraction(e);
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (text) this.target.handlePaste(text);
  };

  private onCopy = (e: ClipboardEvent): void => this.clipboardOut(e, false);
  private onCut = (e: ClipboardEvent): void => this.clipboardOut(e, true);

  private clipboardOut(e: ClipboardEvent, cut: boolean): void {
    e.preventDefault();
    if (!e.isTrusted || !this.target) return;
    const text = this.target.handleCopy(cut);
    if (text !== null && e.clipboardData) e.clipboardData.setData('text/plain', text);
  }

  private block = (e: Event): void => e.preventDefault();

  private onBlur = (): void => {
    if (this.suppressBlur) return;
    // Window/tab switches blur the element too; keep logical focus in that case.
    if (!document.hasFocus()) return;
    this.hooks.onBlur();
  };
}
