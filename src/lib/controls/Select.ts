import { Container, Graphics, Rectangle, Text, type FederatedPointerEvent, type FederatedWheelEvent, type Ticker } from '../render/canvas';
import { Control, type ControlOptions } from '../core/Control';
import type { FormUI } from '../core/FormUI';
import { Icons } from '../core/icons';
import type { Choice } from './RadioGroup';

export interface SelectOptions<T extends string> extends ControlOptions<T | null> {
  options: Choice<T>[];
  value?: T | null;
  placeholder?: string;
  /** Text shown in the closed field for the selected option (default: its label). */
  formatSelected?: (option: Choice<T>) => string;
  /** Menu width in px when it should be wider than the field (clamped to the screen). */
  menuWidth?: number;
  /** Display-only text for menu rows (labels stay plain for type-ahead and screen readers). */
  formatOption?: (option: Choice<T>) => string;
}

/**
 * Dropdown select. The menu renders in `ui.overlay` above everything else.
 * Keyboard: Enter/Space/Alt+ArrowDown open; arrows, Home/End, type-ahead,
 * Enter to choose, Escape to close. Only declared option values are accepted.
 */
export class Select<T extends string = string> extends Control<T | null> {
  private readonly options: Choice<T>[];
  private readonly initial: T | null;
  private value: T | null;
  placeholder: string;
  private readonly formatSelected?: (option: Choice<T>) => string;
  private readonly menuWidth?: number;
  private readonly formatOption?: (option: Choice<T>) => string;
  private readonly box = new Graphics();
  private readonly chevron = new Graphics();
  private readonly valueText: Text;

  private open = false;
  private highlight = -1;
  private scrollTop = 0;
  private readonly menu = new Container();
  private releaseTouch: (() => void) | null = null;
  private readonly catcher = new Graphics();
  private readonly panel = new Graphics();
  private readonly list = new Container();
  private readonly listMask = new Graphics();
  private readonly itemTexts: Text[] = [];
  private readonly itemBg = new Graphics();
  private typeahead = '';
  private typeaheadTimer = 0;
  private menuAbove = false;
  private menuDrag: { y: number; moved: boolean } | null = null;

  constructor(ui: FormUI, opts: SelectOptions<T>) {
    super(ui, opts);
    this.options = opts.options.map((o) => ({ ...o }));
    this.placeholder = opts.placeholder ?? 'Select…';
    this.formatSelected = opts.formatSelected;
    this.menuWidth = opts.menuWidth;
    this.formatOption = opts.formatOption;
    this.value = this.initial = this.isValid(opts.value) ? opts.value! : null;
    this.valueText = new Text({ text: '', style: this.textStyle('body') });
    this.body.addChildAt(this.box, 0);
    this.body.addChild(this.valueText, this.chevron);
    this.body.eventMode = 'static';
    this.body.cursor = 'pointer';
    this.bindTap(this.body, () => this.setOpen(!this.open));
    this.body.on('pointerover', () => ((this._hovered = true), this.drawBody()));
    this.body.on('pointerout', () => ((this._hovered = false), this.drawBody()));

    // Menu (lives in the overlay while open)
    this.catcher.eventMode = 'static';
    this.catcher.on('pointerdown', () => {
      this.ui.focus.claimed = true;
      this.setOpen(false);
    });
    this.list.mask = this.listMask;
    this.list.addChild(this.itemBg);
    this.menu.addChild(this.catcher, this.panel, this.listMask, this.list);
    this.panel.eventMode = 'static';
    this.panel.on('pointerdown', (e: FederatedPointerEvent) => {
      this.ui.focus.claimed = true;
      e.stopPropagation();
    });
    this.list.eventMode = 'static';
    this.list.on('pointermove', (e: FederatedPointerEvent) => this.hoverAt(e));
    this.list.on('pointertap', (e: FederatedPointerEvent) => {
      this.ui.focus.claimed = true;
      if (this.menuDrag?.moved) return;
      const i = this.indexAt(e);
      if (i >= 0) this.choose(i);
    });
    this.list.on('pointerdown', (e: FederatedPointerEvent) => {
      this.ui.focus.claimed = true;
      this.menuDrag = { y: e.global.y, moved: false };
      e.stopPropagation();
    });
    // Touch-drag scrolling inside the menu (mobile).
    this.list.on('globalpointermove', (e: FederatedPointerEvent) => {
      const d = this.menuDrag;
      if (!d || !this.open || e.pointerType === 'mouse') return;
      const dy = e.global.y - d.y;
      if (!d.moved && Math.abs(dy) < 6) return;
      d.moved = true;
      d.y = e.global.y;
      this.scrollBy(-dy);
    });
    this.list.on('pointerup', () => setTimeout(() => (this.menuDrag = null)));
    this.list.on('pointerupoutside', () => (this.menuDrag = null));
    this.menu.on('wheel', (e: FederatedWheelEvent) => {
      this.scrollBy(e.deltaY);
      e.preventDefault(); // an open menu owns the wheel
      e.stopPropagation();
    });
    this.menu.eventMode = 'static';
    this.redraw();
  }

  getValue(): T | null {
    return this.value;
  }

  setValue(v: T | null, emit = true): void {
    if (v !== null && !this.isValid(v)) return;
    if (v === this.value) return;
    this.value = v;
    this.drawBody();
    this.ui.focus.sync(this);
    this.commitChange(emit);
  }

  isEmpty(): boolean {
    return this.value === null;
  }

  reset(): void {
    this.setOpen(false);
    this.value = this.initial;
    this.touched = false;
    this.setError(null);
    this.redraw();
  }

  get isOpen(): boolean {
    return this.open;
  }

  private isValid(v: unknown): v is T {
    return this.options.some((o) => o.value === v && !o.disabled);
  }

  // ------------------------------------------------------------ open / close
  setOpen(v: boolean): void {
    if (v === this.open || (v && !this._enabled)) return;
    this.open = v;
    if (v) {
      this.highlight = Math.max(0, this.options.findIndex((o) => o.value === this.value));
      this.ensureVisible(this.highlight, true);
      this.ui.overlay.addChild(this.menu);
      this.releaseTouch = this.ui.ownTouch(this.panel); // swipes on the visible menu scroll the list, not the page
      this.ui.focus.keyInterceptor = this.menuKeys;
      this.ui.ticker.add(this.followAnchor, this);
      this.drawMenu();
    } else {
      this.menu.parent?.removeChild(this.menu);
      this.releaseTouch?.();
      this.releaseTouch = null;
      if (this.ui.focus.keyInterceptor === this.menuKeys) this.ui.focus.keyInterceptor = null;
      this.ui.ticker.remove(this.followAnchor, this);
    }
    this.ui.focus.sync(this);
    this.drawBody();
  }

  private choose(i: number): void {
    const o = this.options[i];
    if (!o || o.disabled) return;
    this.setValue(o.value);
    this.setOpen(false);
  }

  // ------------------------------------------------------------ keyboard
  override ariaRole(): string {
    return 'combobox';
  }

  override ariaLabel(): string {
    const cur = this.options.find((o) => o.value === this.value);
    return `${super.ariaLabel()}, ${cur ? cur.label : 'nothing selected'}`;
  }

  override ariaState(): Record<string, string | null> {
    return { ...super.ariaState(), 'aria-expanded': String(this.open), 'aria-haspopup': 'listbox' };
  }

  override handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (e.key.startsWith('Arrow') && !e.altKey) {
        this.stepValue(e.key === 'ArrowDown' ? 1 : -1);
        return true;
      }
      this.setOpen(true);
      return true;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const i = this.findTypeahead(e.key);
      if (i >= 0) this.setValue(this.options[i].value);
      return true;
    }
    return false;
  }

  private stepValue(dir: number): void {
    const n = this.options.length;
    let i = this.options.findIndex((o) => o.value === this.value);
    for (let k = 0; k < n; k++) {
      i = Math.min(n - 1, Math.max(0, i + dir));
      if (!this.options[i].disabled) return this.setValue(this.options[i].value);
    }
  }

  private menuKeys = (e: KeyboardEvent): boolean => {
    if (!this.open) return false;
    const n = this.options.length;
    const move = (to: number, dir: number) => {
      let i = to;
      for (let k = 0; k < n && this.options[i]?.disabled; k++) i = Math.min(n - 1, Math.max(0, i + dir));
      this.highlight = i;
      this.ensureVisible(i);
      this.drawMenu();
    };
    switch (e.key) {
      case 'ArrowDown':
        move(Math.min(n - 1, this.highlight + 1), 1);
        return true;
      case 'ArrowUp':
        move(Math.max(0, this.highlight - 1), -1);
        return true;
      case 'Home':
        move(0, 1);
        return true;
      case 'End':
        move(n - 1, -1);
        return true;
      case 'Enter':
      case ' ':
        this.choose(this.highlight);
        return true;
      case 'Escape':
        this.setOpen(false);
        return true;
      case 'Tab':
        this.setOpen(false);
        return false;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const i = this.findTypeahead(e.key);
      if (i >= 0) move(i, 1);
      return true;
    }
    return false;
  };

  private findTypeahead(ch: string): number {
    window.clearTimeout(this.typeaheadTimer);
    this.typeahead += ch.toLowerCase();
    this.typeaheadTimer = window.setTimeout(() => (this.typeahead = ''), 700);
    return this.options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(this.typeahead));
  }

  // ------------------------------------------------------------ menu geometry
  private visibleCount(): number {
    return Math.min(this.options.length, this.theme.dropdownMaxVisible);
  }

  private menuHeight(): number {
    return this.visibleCount() * this.theme.dropdownItemHeight + 8;
  }

  private maxScroll(): number {
    return Math.max(0, this.options.length * this.theme.dropdownItemHeight - (this.menuHeight() - 8));
  }

  private scrollBy(dy: number): void {
    this.scrollTop = Math.min(this.maxScroll(), Math.max(0, this.scrollTop + dy));
    this.drawMenu();
  }

  private ensureVisible(i: number, center = false): void {
    const ih = this.theme.dropdownItemHeight;
    const vh = this.menuHeight() - 8;
    if (center) this.scrollTop = i * ih - vh / 2 + ih / 2;
    else if (i * ih < this.scrollTop) this.scrollTop = i * ih;
    else if ((i + 1) * ih > this.scrollTop + vh) this.scrollTop = (i + 1) * ih - vh;
    this.scrollTop = Math.min(this.maxScroll(), Math.max(0, this.scrollTop));
  }

  private indexAt(e: FederatedPointerEvent): number {
    const p = e.getLocalPosition(this.list);
    const i = Math.floor((p.y + this.scrollTop - 4) / this.theme.dropdownItemHeight);
    return i >= 0 && i < this.options.length ? i : -1;
  }

  private hoverAt(e: FederatedPointerEvent): void {
    const i = this.indexAt(e);
    if (i !== this.highlight && i >= 0) {
      this.highlight = i;
      this.drawMenu();
    }
  }

  private followAnchor(_t: Ticker): void {
    if (!this.open) return;
    if (!this.isFocusable()) return this.setOpen(false);
    this.positionMenu();
  }

  private positionMenu(): void {
    const b = this.body.getBounds();
    const screen = this.ui.app.screen;
    const mh = this.menuHeight();
    const below = b.y + b.height + 4;
    this.menuAbove = below + mh > screen.height - 8 && b.y - mh - 4 > 8;
    const mx = Math.max(8, Math.min(b.x, screen.width - this.menuW() - 8));
    const local = this.ui.overlay.toLocal({ x: mx, y: this.menuAbove ? b.y - mh - 4 : below });
    this.panel.position.set(local.x, local.y);
    this.list.position.set(local.x, local.y);
    this.listMask.position.set(local.x, local.y);
    const origin = this.ui.overlay.toLocal({ x: 0, y: 0 });
    this.catcher.clear().rect(origin.x, origin.y, screen.width, screen.height).fill({ color: 0x000000, alpha: 0.001 });
  }

  private menuW(): number {
    return Math.min(Math.max(this._width, this.menuWidth ?? 0), this.ui.app.screen.width - 16);
  }

  private drawMenu(): void {
    const t = this.theme;
    const c = t.colors;
    const w = this.menuW();
    const mh = this.menuHeight();
    const ih = t.dropdownItemHeight;
    this.positionMenu();
    this.panel
      .clear()
      .roundRect(0, 6, w, mh, t.radius)
      .fill({ color: c.shadow, alpha: 0.12 })
      .roundRect(0, 0, w, mh, t.radius)
      .fill(c.surface)
      .stroke({ width: 1, color: c.border, alignment: 1 });
    this.listMask.clear().roundRect(0, 4, w, mh - 8, 2).fill(0xffffff);
    this.list.hitArea = new Rectangle(0, 4, w, mh - 8);

    this.itemBg.clear();
    while (this.itemTexts.length < this.options.length) {
      const tx = new Text({ text: '', style: this.textStyle('body') });
      this.itemTexts.push(tx);
      this.list.addChild(tx);
    }
    this.options.forEach((o, i) => {
      const y = 4 + i * ih - this.scrollTop;
      const selected = o.value === this.value;
      if (i === this.highlight && !o.disabled) this.itemBg.rect(4, y, w - 8, ih).fill({ color: c.primary, alpha: 0.1 });
      if (selected) this.itemBg.rect(4, y + 8, 3, ih - 16).fill(c.primary);
      const tx = this.itemTexts[i];
      tx.text = this.formatOption ? this.formatOption(o) : o.label;
      tx.style = { ...this.textStyle('body', o.disabled ? c.textDisabled : selected ? c.primary : c.text), fontWeight: selected ? '600' : t.fontWeight };
      tx.position.set(t.paddingX, y + (ih - tx.height) / 2);
      tx.visible = y + ih > 0 && y < mh;
    });
    if (this.maxScroll() > 0) {
      const vh = mh - 8;
      const total = this.options.length * ih;
      const barH = Math.max(24, (vh * vh) / total);
      const barY = 4 + (this.scrollTop / this.maxScroll()) * (vh - barH);
      this.itemBg.roundRect(w - 6, barY, 3, barH, 1.5).fill({ color: c.textMuted, alpha: 0.5 });
    }
  }

  // ------------------------------------------------------------ closed state
  protected bodyHeight(): number {
    return this.theme.controlHeight;
  }

  protected override onFocusChanged(focused: boolean): void {
    if (!focused) this.setOpen(false);
  }

  protected drawBody(): void {
    if (!this.valueText) return;
    const t = this.theme;
    const c = t.colors;
    const w = this._width;
    const h = this.bodyHeight();
    const border = !this._enabled ? c.border : this.hasErrorState ? c.error : this._focused || this.open ? c.borderFocus : this._hovered ? c.borderHover : c.border;
    this.box
      .clear()
      .roundRect(0, 0, w, h, t.radius)
      .fill(!this._enabled ? c.surfaceDisabled : this._hovered && !this._focused ? c.surfaceHover : c.surface)
      .stroke({ width: this._focused ? t.borderWidth + 0.5 : t.borderWidth, color: border, alignment: 1 });
    const cur = this.options.find((o) => o.value === this.value);
    this.valueText.text = cur ? (this.formatSelected ? this.formatSelected(cur) : cur.label) : this.placeholder;
    this.valueText.style = this.textStyle('body', !this._enabled ? c.textDisabled : cur ? c.text : c.placeholder);
    this.valueText.position.set(t.paddingX, Math.round((h - this.valueText.height) / 2));
    this.chevron.clear();
    Icons.chevron(this.chevron, w - 22, h / 2, 22, this._enabled ? c.textMuted : c.textDisabled, this.open !== this.menuAbove && this.open);
    this.drawFocus(0, 0, w, h, t.radius);
    this.body.hitArea = new Rectangle(0, 0, w, h);
    if (this.open) this.drawMenu();
  }

  override destroy(options?: Parameters<Control<T | null>['destroy']>[0]): void {
    this.setOpen(false);
    window.clearTimeout(this.typeaheadTimer);
    this.menu.destroy({ children: true });
    super.destroy(options);
  }
}
