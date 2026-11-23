import { Container, Graphics, Rectangle, Text } from './render/canvas';
import { Control, type ControlOptions } from './core/Control';
import type { FormUI } from './core/FormUI';
import { Icons } from './core/icons';
import type { A11yGroupSource } from './core/A11yTree';
import type { Focusable } from './core/types';
import { Column, type Layoutable } from './layout';

export type FieldGroupVariant = 'outline' | 'card' | 'plain';

export interface FieldGroupOptions
  extends Pick<ControlOptions<null>, 'info' | 'theme' | 'tabIndex' | 'width'> {
  /** Identifier (letters, digits, _ . -). Auto-generated when omitted. */
  name?: string;
  /** Heading shown above the fields (the fieldset legend). */
  title: string;
  /** Optional secondary line under the title. */
  description?: string;
  /** Show a chevron and let the user fold the group away. Default false. */
  collapsible?: boolean;
  /** Start folded (only with `collapsible`). Default false. */
  collapsed?: boolean;
  /** 'outline' (bordered box, default), 'card' (filled with shadow), 'plain' (heading + divider). */
  variant?: FieldGroupVariant;
  /** Vertical gap between the fields. Default 18. */
  gap?: number;
  /** Disable every control inside the group. */
  disabled?: boolean;
}

let autoId = 0;

/**
 * Groups related fields under a heading, like an HTML <fieldset> with <legend>.
 *
 *   const contact = new FieldGroup(ui, { title: 'Contact', collapsible: true });
 *   contact.add(email, phone);
 *   column.add(contact);
 *
 * Grouping is visual and for accessibility only: the fields still belong to
 * the Form directly (form.add(email, phone)) and submit with flat names.
 *
 * Behaviour:
 * - Collapsible groups get a header button (Enter/Space toggle, ←/→ fold/unfold).
 *   Folded fields are skipped by Tab.
 * - A badge shows how many fields inside need attention, and a folded group
 *   opens by itself when one of its fields fails validation, so an error is
 *   never hidden from the user.
 * - Screen readers hear the group title when focus moves into the group.
 *
 * Events: 'toggle' (expanded: boolean), 'resize'.
 */
export class FieldGroup extends Control<null> {
  readonly content: Column;
  readonly variant: FieldGroupVariant;
  readonly collapsible: boolean;
  private readonly bg = new Graphics();
  private readonly header = new Container();
  private readonly chevron = new Graphics();
  private readonly badge = new Graphics();
  private readonly titleText: Text;
  private readonly descText: Text;
  private readonly badgeText: Text;
  private _title: string;
  private _description: string;
  private _expanded: boolean;
  private laying = false;
  private watched = new Set<Control<unknown>>();
  private focusInside = false;

  constructor(ui: FormUI, opts: FieldGroupOptions) {
    super(ui, { ...opts, name: opts.name ?? `group${++autoId}`, label: opts.title, hideLabel: true });
    this.labelAbove = false;
    this.variant = opts.variant ?? 'outline';
    this.collapsible = !!opts.collapsible;
    this._expanded = !(this.collapsible && opts.collapsed);
    this._title = opts.title;
    this._description = opts.description ?? '';
    this.titleText = new Text({ text: '' });
    this.descText = new Text({ text: '' });
    this.badgeText = new Text({ text: '' });
    this.content = new Column([], opts.gap ?? 18);
    this.content.visible = this._expanded;
    this.badge.addChild(this.badgeText);
    this.header.addChild(this.titleText, this.descText, this.badge, this.chevron);
    this.body.addChildAt(this.bg, 0);
    this.body.addChild(this.header, this.content);
    this.content.on('resize', () => {
      if (!this.laying) this.redraw();
    });
    if (this.collapsible) {
      this.header.eventMode = 'static';
      this.header.cursor = 'pointer';
      this.bindTap(this.header, () => this.toggle());
      this.header.on('pointerover', () => ((this._hovered = true), this.drawBody()));
      this.header.on('pointerout', () => ((this._hovered = false), this.drawBody()));
    }
    ui.on('focuschange', this.onFocusChange, this);
    if (opts.disabled) queueMicrotask(() => this.setDisabled(true));
    this.redraw();
  }

  // ---------------------------------------------------------------- API
  /** Adds fields (or rows, labels, nested groups). */
  add(...items: Layoutable[]): this {
    this.laying = true;
    this.content.add(...items);
    this.laying = false;
    for (const it of items) this.watch(it);
    if (this._width) this.layout(this._width);
    return this;
  }

  get title(): string {
    return this._title;
  }
  set title(v: string) {
    this._title = v;
    this._label = v;
    this.redraw();
    this.ui.focus.sync(this);
  }

  get description(): string {
    return this._description;
  }
  set description(v: string) {
    this._description = v ?? '';
    this.redraw();
  }

  get expanded(): boolean {
    return this._expanded;
  }

  /** Opens or folds the group (no-op for non-collapsible groups when folding). */
  setExpanded(expanded: boolean): void {
    if (!this.collapsible && !expanded) return;
    if (expanded === this._expanded) return;
    this._expanded = expanded;
    this.content.visible = expanded;
    // Don't leave keyboard focus on a field that just disappeared.
    const cur = this.ui.focus.current;
    if (!expanded && cur && cur !== this && this.containsView(cur.view)) {
      if (this.isFocusable()) this.ui.focus.focus(this, true);
      else this.ui.focus.blur();
    }
    this.redraw();
    this.ui.focus.sync(this);
    this.ui.announcer.announce(`${this._title} ${expanded ? 'expanded' : 'collapsed'}`);
    this.emit('toggle', expanded);
  }

  toggle(): void {
    this.setExpanded(!this._expanded);
  }

  /** Every control inside the group (including nested groups' fields). */
  controls(): Control<unknown>[] {
    const out: Control<unknown>[] = [];
    const walk = (n: Container) => {
      for (const c of n.children) {
        if (c instanceof FieldGroup) walk(c.content);
        else if (c instanceof Control) out.push(c as Control<unknown>);
        else walk(c);
      }
    };
    walk(this.content);
    return out;
  }

  /** Number of fields inside that currently show an error. */
  get errorCount(): number {
    return this.controls().filter((c) => !!c.error).length;
  }

  /** Enables/disables every control inside the group. */
  setDisabled(disabled: boolean): void {
    for (const c of this.controls()) c.enabled = !disabled;
  }

  // ---------------------------------------------------------------- Control
  getValue(): null {
    return null;
  }
  setValue(): void {}
  reset(): void {}
  isEmpty(): boolean {
    return false;
  }

  override isFocusable(): boolean {
    return this.collapsible && super.isFocusable();
  }

  override layout(width: number): void {
    this._width = Math.max(120, width);
    this.laying = true;
    this.content.layout(this.innerWidth());
    this.laying = false;
    this.redraw();
  }

  override ariaRole(): string {
    return 'button';
  }

  override ariaLabel(): string {
    return this._title;
  }

  override ariaDescription(): { help?: string; error?: string } {
    const n = this.errorCount;
    const help = [this._description, this._info].filter(Boolean).join('. ');
    return {
      help: help || undefined,
      error: n ? `${n} field${n > 1 ? 's need' : ' needs'} attention` : undefined,
    };
  }

  override activate(): void {
    if (this.collapsible) this.toggle();
  }

  /** Accessibility outline: a labelled group, with the header as a button when collapsible. */
  a11yGroup(): ReturnType<A11yGroupSource['a11yGroup']> {
    return {
      title: this._title,
      description: [this._description, this._info].filter(Boolean).join('. ') || undefined,
      expanded: this._expanded,
      content: this.content,
      header: this.collapsible ? this : null,
      headerView: this.header,
    };
  }

  override ariaState(): Record<string, string | null> {
    return { 'aria-expanded': this.collapsible ? String(this._expanded) : null };
  }

  override handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.collapsible) return false;
    if (e.key === 'Enter' || e.key === ' ') {
      if (!e.repeat) this.toggle();
      return true;
    }
    if (e.key === 'ArrowRight' && !this._expanded) return this.setExpanded(true), true;
    if (e.key === 'ArrowLeft' && this._expanded) return this.setExpanded(false), true;
    return false;
  }

  // ---------------------------------------------------------------- layout + drawing
  private pad(): { x: number; y: number } {
    if (this.variant === 'plain') return { x: 0, y: 0 };
    return { x: this._width < 440 ? 14 : 20, y: this._width < 440 ? 14 : 18 };
  }

  private innerWidth(): number {
    return Math.max(80, this._width - this.pad().x * 2);
  }

  private headerHeightPx(): number {
    const t = this.theme;
    const titleH = Math.ceil((t.fontSize + 1) * t.lineHeight);
    const descH = this._description ? Math.ceil(this.descText.height) + 2 : 0;
    return Math.max(titleH + descH, 24);
  }

  private sectionGap(): number {
    return this.variant === 'plain' ? 14 : 16;
  }

  protected bodyHeight(): number {
    const p = this.pad();
    const content = this._expanded ? this.sectionGap() + this.content.layoutHeight : 0;
    return p.y + this.headerHeightPx() + content + p.y;
  }

  protected drawBody(): void {
    if (!this.content) return; // called by the base constructor before fields exist
    const t = this.theme;
    const c = t.colors;
    const p = this.pad();
    const w = this._width;
    const inner = this.innerWidth();
    const errors = this.errorCount;

    // Right side of the header: [badge] [chevron]
    const chevronW = this.collapsible ? 28 : 0;
    this.badgeText.text = errors ? `${errors} to fix` : '';
    this.badgeText.style = {
      fontFamily: t.fontFamily.join(','),
      fontSize: t.helperFontSize,
      fontWeight: '600',
      fill: c.error,
      lineHeight: Math.ceil(t.helperFontSize * t.lineHeight),
    };
    const badgeW = errors ? Math.ceil(this.badgeText.width) + 16 : 0;
    const reserve = chevronW + (badgeW ? badgeW + 8 : 0);
    const textW = Math.max(60, inner - reserve - this.infoIconSpace());

    this.titleText.style = {
      fontFamily: t.fontFamily.join(','),
      fontSize: t.fontSize + 1,
      fontWeight: '650',
      fill: this._enabled ? c.text : c.textDisabled,
      lineHeight: Math.ceil((t.fontSize + 1) * t.lineHeight),
      wordWrap: true,
      wordWrapWidth: textW,
    };
    this.titleText.text = this._title;
    this.descText.style = {
      fontFamily: t.fontFamily.join(','),
      fontSize: t.helperFontSize,
      fill: c.textMuted,
      lineHeight: Math.ceil(t.helperFontSize * t.lineHeight),
      wordWrap: true,
      wordWrapWidth: textW + this.infoIconSpace(),
    };
    this.descText.text = this._description;
    this.descText.visible = !!this._description;

    const hh = this.headerHeightPx();
    this.header.position.set(p.x, p.y);
    this.titleText.position.set(0, 0);
    const titleLine = Math.ceil((t.fontSize + 1) * t.lineHeight);
    this.descText.position.set(0, Math.ceil(this.titleText.height) + 2);
    this.placeInfo(this.header, Math.ceil(Math.min(this.titleText.width, textW)) + 8, titleLine / 2);

    this.badge.clear();
    this.badge.visible = !!errors;
    if (errors) {
      const bh = Math.ceil(t.helperFontSize * t.lineHeight) + 4;
      const bx = inner - chevronW - badgeW;
      const by = Math.round((titleLine - bh) / 2);
      this.badge.position.set(bx, by);
      this.badge.roundRect(0, 0, badgeW, bh, bh / 2).fill({ color: c.error, alpha: 0.12 });
      this.badgeText.position.set(8, 2);
    }

    this.chevron.clear();
    if (this.collapsible) {
      const color = this._hovered ? c.text : c.textMuted;
      Icons.chevron(this.chevron, inner - 12, titleLine / 2, 22, color, this._expanded);
    }
    this.header.hitArea = this.collapsible ? new Rectangle(-p.x, -p.y, w, hh + p.y * 2) : null;

    this.content.position.set(p.x, p.y + hh + this.sectionGap());

    // Background
    const h = this.bodyHeight();
    const r = t.radius + 4;
    const border = errors ? c.error : c.border;
    this.bg.clear();
    if (this.variant === 'card') {
      this.bg
        .roundRect(0, 3, w, h, r)
        .fill({ color: c.shadow, alpha: 0.05 })
        .roundRect(0, 0, w, h, r)
        .fill(c.surface)
        .stroke({ width: 1, color: border, alpha: errors ? 0.9 : 0.6, alignment: 1 });
    } else if (this.variant === 'outline') {
      if (this.collapsible && this._hovered && !this._expanded) this.bg.roundRect(0, 0, w, h, r).fill(c.surfaceHover);
      this.bg.roundRect(0, 0, w, h, r).stroke({ width: 1, color: border, alpha: errors ? 0.9 : 0.75, alignment: 1 });
    } else {
      this.bg.rect(0, hh + 6, w, 1).fill({ color: border, alpha: errors ? 0.9 : 0.6 });
    }

    // Focus ring around the header button
    if (this.variant === 'plain') this.drawFocus(0, 0, w, hh, 6);
    else this.drawFocus(0, 0, w, this._expanded ? p.y + hh + Math.round(p.y / 2) : h, r);
  }

  // ---------------------------------------------------------------- internals
  private watch(item: Container): void {
    const controls: Control<unknown>[] = [];
    if (item instanceof FieldGroup) controls.push(...item.controls());
    else if (item instanceof Control) controls.push(item as Control<unknown>);
    else {
      const walk = (n: Container) => n.children.forEach((ch) => (ch instanceof Control ? controls.push(ch as Control<unknown>) : walk(ch)));
      walk(item);
    }
    for (const ctl of controls) {
      if (this.watched.has(ctl)) continue;
      this.watched.add(ctl);
      ctl.on('validate', this.onChildValidate, this);
    }
  }

  private onChildValidate(error: string | null): void {
    // Open synchronously so Form.submit() can focus the first invalid field right after.
    if (error && !this._expanded) this.setExpanded(true);
    this.redraw();
    this.ui.focus.sync(this);
  }

  private containsView(view: Container): boolean {
    for (let n: Container | null = view; n; n = n.parent) if (n === this.content) return true;
    return false;
  }

  private onFocusChange(cur: Focusable | null): void {
    const inside = !!cur && (cur === this || this.containsView(cur.view));
    // Like a <fieldset> legend: announce the group once when focus enters a field in it.
    if (inside && !this.focusInside && cur !== this) this.ui.announcer.announce(`${this._title} group`);
    this.focusInside = inside;
  }

  override destroy(options?: Parameters<Control<null>['destroy']>[0]): void {
    this.ui.off('focuschange', this.onFocusChange, this);
    for (const c of this.watched) c.off('validate', this.onChildValidate, this);
    this.watched.clear();
    super.destroy(options);
  }
}
