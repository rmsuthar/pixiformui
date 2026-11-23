import { Container, Graphics, Rectangle, Text, type FederatedPointerEvent, type Ticker } from '../render/canvas';
import { Control, type ControlOptions } from '../core/Control';
import type { FormUI } from '../core/FormUI';
import { Icons } from '../core/icons';
import {
  addDays,
  addMonths,
  daysInMonth,
  formatTime,
  formatters,
  key,
  localeFirstDay,
  localeUses12h,
  parseISO,
  resolveDate,
  sameDay,
  toISO,
  today,
  weekday,
  type DateTimeParts,
  type YMD,
} from './dateUtils';

export interface DatePickerTimeOptions {
  /** Minute step. Default 15. */
  step?: number;
  /** 12-hour clock with AM/PM. Default: from the locale. */
  hour12?: boolean;
  /** Time used when a date is picked first. Default '09:00'. */
  defaultTime?: string;
}

export interface DatePickerOptions extends ControlOptions<string | null> {
  /** Initial value: 'YYYY-MM-DD' (or 'YYYY-MM-DDTHH:mm' with time). */
  value?: string | null;
  /** Earliest selectable date: ISO date, 'today', or 'today±N' (days). */
  min?: string;
  /** Latest selectable date: ISO date, 'today', or 'today±N' (days). */
  max?: string;
  /** Return true to disable a date (e.g. weekends, holidays). Receives 'YYYY-MM-DD'. */
  isDateDisabled?: (isoDate: string) => boolean;
  /** Add a time picker. Value becomes 'YYYY-MM-DDTHH:mm' (local time, no timezone). */
  time?: boolean | DatePickerTimeOptions;
  /** BCP 47 locale for month/day names and formats. Default: the browser's. */
  locale?: string;
  /** 0 = Sunday, 1 = Monday… Default: from the locale. */
  firstDayOfWeek?: number;
  placeholder?: string;
  /** Show a clear (×) button. Default: true unless `required`. */
  clearable?: boolean;
}

type View = 'days' | 'months' | 'years';
type Zone = 'grid' | 'hour' | 'minute' | 'ampm';
type Hit =
  | { kind: 'prev' | 'next' | 'title' | 'today' | 'clear' | 'done' }
  | { kind: 'cell'; index: number }
  | { kind: 'time'; zone: Exclude<Zone, 'grid'>; dir: 1 | -1 };

const PAD = 12;
const HEADER = 36;
const WEEKDAYS_H = 24;
const CELL_H = 38;
const TIME_H = 64;
const FOOTER_H = 36;

/**
 * Custom calendar with optional time. Value: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm'
 * (plain local values, so no timezone shifts), or null when empty.
 *
 * Keyboard, closed: Enter/Space/Alt+↓ open · Delete clears.
 * Open (calendar): arrows move by day/week · PageUp/PageDown month (Shift: year) ·
 * Home/End week start/end · T today · Enter choose · click the title for month/year views.
 * Open (time): Tab into hour → minute → AM/PM · ↑↓ change · digits type · Enter done · Esc close.
 */
export class DatePicker extends Control<string | null> {
  readonly withTime: boolean;
  readonly step: number;
  readonly hour12: boolean;
  readonly firstDay: number;
  placeholder: string;
  clearable: boolean;

  private value: DateTimeParts | null;
  private readonly initial: string | null;
  private readonly minD: YMD | null;
  private readonly maxD: YMD | null;
  private readonly isDateDisabledFn?: (iso: string) => boolean;
  private readonly defaultTime: { hh: number; mm: number };
  private readonly fmt: ReturnType<typeof formatters>;

  // closed field
  private readonly box = new Graphics();
  private readonly icons = new Graphics();
  private readonly valueText: Text;

  // popup
  private open = false;
  private calView: View = 'days';
  private zone: Zone = 'grid';
  private viewYear = 2000;
  private viewMonth = 0;
  private active: YMD = today();
  private hover: Hit | null = null;
  private typed = '';
  private typedTimer = 0;
  private readonly popup = new Container();
  private readonly catcher = new Graphics();
  private readonly panel = new Graphics();
  private readonly marks = new Graphics();
  private readonly titleText: Text;
  private readonly weekdayTexts: Text[] = [];
  private readonly cellTexts: Text[] = [];
  private readonly timeTexts: Text[] = [];
  private readonly footerTexts: Text[] = [];

  constructor(ui: FormUI, opts: DatePickerOptions) {
    super(ui, opts);
    const t = typeof opts.time === 'object' ? opts.time : {};
    this.withTime = !!opts.time;
    this.step = Math.max(1, Math.min(60, Math.round(t.step ?? 15)));
    this.hour12 = t.hour12 ?? localeUses12h(opts.locale);
    const dt = /^(\d{2}):(\d{2})$/.exec(t.defaultTime ?? '09:00');
    this.defaultTime = dt ? { hh: Math.min(23, +dt[1]), mm: Math.min(59, +dt[2]) } : { hh: 9, mm: 0 };
    this.firstDay = ((opts.firstDayOfWeek ?? localeFirstDay(opts.locale)) % 7 + 7) % 7;
    this.fmt = formatters(opts.locale);
    this.placeholder = opts.placeholder ?? (this.withTime ? 'Select date and time' : 'Select a date');
    this.clearable = opts.clearable ?? !opts.required;
    this.minD = resolveDate(opts.min);
    this.maxD = resolveDate(opts.max);
    this.isDateDisabledFn = opts.isDateDisabled;
    this.value = this.normalize(parseISO(opts.value ?? null));
    this.initial = this.value ? toISO(this.value, this.withTime) : null;

    const style = this.textStyle('body');
    this.valueText = new Text({ text: '', style });
    this.titleText = new Text({ text: '', style });
    for (let i = 0; i < 7; i++) this.weekdayTexts.push(new Text({ text: '', style }));
    for (let i = 0; i < 42; i++) this.cellTexts.push(new Text({ text: '', style }));
    for (let i = 0; i < 5; i++) this.timeTexts.push(new Text({ text: '', style }));
    for (let i = 0; i < 3; i++) this.footerTexts.push(new Text({ text: '', style }));
    for (const txt of [this.titleText, ...this.weekdayTexts, ...this.cellTexts, ...this.timeTexts, ...this.footerTexts]) txt.anchor.set(0.5);

    this.body.addChildAt(this.box, 0);
    this.body.addChild(this.valueText, this.icons);
    this.body.eventMode = 'static';
    this.body.cursor = 'pointer';
    this.bindTap(this.body, (e) => this.onFieldTap(e));
    this.body.on('pointerover', () => ((this._hovered = true), this.drawBody()));
    this.body.on('pointerout', () => ((this._hovered = false), this.drawBody()));

    this.catcher.eventMode = 'static';
    this.catcher.on('pointerdown', () => {
      this.ui.focus.claimed = true;
      this.setOpen(false);
    });
    this.panel.eventMode = 'static';
    this.panel.cursor = 'pointer';
    this.panel.on('pointerdown', (e: FederatedPointerEvent) => {
      this.ui.focus.claimed = true;
      e.stopPropagation();
    });
    this.panel.on('pointertap', (e: FederatedPointerEvent) => this.onPanelTap(e));
    this.panel.on('pointermove', (e: FederatedPointerEvent) => {
      const h = this.hitTest(e);
      if (JSON.stringify(h) !== JSON.stringify(this.hover)) {
        this.hover = h;
        this.drawPopup();
      }
    });
    this.panel.on('pointerout', () => ((this.hover = null), this.drawPopup()));
    this.popup.addChild(this.catcher, this.panel, this.marks, this.titleText, ...this.weekdayTexts, ...this.cellTexts, ...this.timeTexts, ...this.footerTexts);
    this.marks.eventMode = 'none';
    this.redraw();
  }

  // ------------------------------------------------------------------ value
  getValue(): string | null {
    return this.value ? toISO(this.value, this.withTime) : null;
  }

  setValue(v: string | null, emit = true): void {
    const next = this.normalize(parseISO(v));
    if ((next ? toISO(next, this.withTime) : null) === this.getValue()) return;
    this.value = next;
    this.changed(emit);
  }

  /** The value as a JS Date in local time (null when empty). */
  getDate(): Date | null {
    const v = this.value;
    return v ? new Date(v.y, v.m, v.d, this.withTime ? v.hh : 0, this.withTime ? v.mm : 0) : null;
  }

  isEmpty(): boolean {
    return this.value === null;
  }

  reset(): void {
    this.setOpen(false);
    this.value = this.normalize(parseISO(this.initial));
    this.touched = false;
    this.setError(null);
    this.redraw();
  }

  get isOpen(): boolean {
    return this.open;
  }

  private normalize(v: DateTimeParts | null): DateTimeParts | null {
    if (!v) return null;
    if (!this.withTime) return { ...v, hh: 0, mm: 0 };
    return { ...v, mm: Math.round(v.mm / this.step) * this.step >= 60 ? 60 - this.step : Math.round(v.mm / this.step) * this.step };
  }

  private changed(emit: boolean): void {
    this.drawBody();
    if (this.open) this.drawPopup();
    this.ui.focus.sync(this);
    if (emit) this.commitChange(true);
  }

  isDisabledDate(v: YMD): boolean {
    const k = key(v);
    if (this.minD && k < key(this.minD)) return true;
    if (this.maxD && k > key(this.maxD)) return true;
    return !!this.isDateDisabledFn?.(toISO({ ...v, hh: 0, mm: 0 }, false));
  }

  private clampToRange(v: YMD): YMD {
    if (this.minD && key(v) < key(this.minD)) return { ...this.minD };
    if (this.maxD && key(v) > key(this.maxD)) return { ...this.maxD };
    return v;
  }

  private selectDate(v: YMD): void {
    if (this.isDisabledDate(v)) {
      this.ui.announcer.announce('That date is not available.');
      return;
    }
    const time = this.value ?? { ...this.defaultTime };
    this.value = { ...v, hh: this.withTime ? time.hh : 0, mm: this.withTime ? time.mm : 0 };
    this.active = { ...v };
    this.viewYear = v.y;
    this.viewMonth = v.m;
    this.changed(true);
    if (!this.withTime) this.setOpen(false);
    else this.ui.announcer.announce(`${this.fmt.long(v)} selected. Press Tab to set the time.`);
  }

  private adjustTime(zone: Exclude<Zone, 'grid'>, dir: 1 | -1): void {
    const base = this.value ?? { ...this.clampToRange(today()), ...this.defaultTime };
    let { hh, mm } = base;
    if (zone === 'hour') hh = (hh + dir + 24) % 24;
    else if (zone === 'minute') mm = (mm + dir * this.step + 60) % 60;
    else hh = (hh + 12) % 24;
    this.value = { ...base, hh, mm };
    this.changed(true);
    this.ui.announcer.announce(formatTime(hh, mm, this.hour12));
  }

  private typeTime(digit: string): void {
    if (this.zone !== 'hour' && this.zone !== 'minute') return;
    window.clearTimeout(this.typedTimer);
    this.typed = (this.typed + digit).slice(-2);
    this.typedTimer = window.setTimeout(() => (this.typed = ''), 900);
    const n = parseInt(this.typed, 10);
    const base = this.value ?? { ...this.clampToRange(today()), ...this.defaultTime };
    let { hh, mm } = base;
    if (this.zone === 'hour') {
      if (this.hour12) {
        const h12 = Math.min(12, Math.max(1, n || 12));
        hh = (h12 % 12) + (hh >= 12 ? 12 : 0);
      } else hh = Math.min(23, n);
    } else {
      mm = Math.min(59, Math.round(n / this.step) * this.step) % 60;
    }
    this.value = { ...base, hh, mm };
    this.changed(true);
  }

  // ------------------------------------------------------------------ open / close
  setOpen(v: boolean): void {
    if (v === this.open || (v && !this._enabled)) return;
    this.open = v;
    if (v) {
      this.active = this.clampToRange(this.value ? { ...this.value } : today());
      this.viewYear = this.active.y;
      this.viewMonth = this.active.m;
      this.calView = 'days';
      this.zone = 'grid';
      this.hover = null;
      this.ui.overlay.addChild(this.popup);
      this.ui.focus.keyInterceptor = this.popupKeys;
      this.ui.ticker.add(this.follow, this);
      this.drawPopup();
      this.ui.announcer.announce(`Calendar open. ${this.fmt.long(this.active)}. Use arrow keys to choose.`);
    } else {
      this.popup.parent?.removeChild(this.popup);
      if (this.ui.focus.keyInterceptor === this.popupKeys) this.ui.focus.keyInterceptor = null;
      this.ui.ticker.remove(this.follow, this);
    }
    this.ui.focus.sync(this);
    this.drawBody();
  }

  protected override onFocusChanged(focused: boolean): void {
    if (!focused) this.setOpen(false);
  }

  private follow(_t: Ticker): void {
    if (!this.open) return;
    if (!this.isFocusable()) return this.setOpen(false);
    this.positionPopup();
  }

  // ------------------------------------------------------------------ keyboard
  override ariaRole(): string {
    return 'combobox';
  }

  override ariaLabel(): string {
    const v = this.value;
    const text = v ? `${this.fmt.long(v)}${this.withTime ? `, ${formatTime(v.hh, v.mm, this.hour12)}` : ''}` : 'no date selected';
    return `${super.ariaLabel()}, ${text}`;
  }

  override ariaState(): Record<string, string | null> {
    return { ...super.ariaState(), 'aria-expanded': String(this.open), 'aria-haspopup': 'dialog' };
  }

  override handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'F4' || (e.key === 'ArrowDown' && e.altKey)) {
      this.setOpen(true);
      return true;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.clearable && this.value) {
      this.setValue(null);
      this.ui.announcer.announce('Date cleared');
      return true;
    }
    return false;
  }

  private popupKeys = (e: KeyboardEvent): boolean => {
    if (!this.open) return false;
    if (e.key === 'Escape') {
      if (this.calView !== 'days' && this.zone === 'grid') {
        this.calView = this.calView === 'years' ? 'months' : 'days';
        this.drawPopup();
      } else this.setOpen(false);
      return true;
    }
    if (e.key === 'Tab') {
      if (!this.withTime) {
        this.setOpen(false);
        return false; // let focus move on
      }
      const zones: Zone[] = this.hour12 ? ['grid', 'hour', 'minute', 'ampm'] : ['grid', 'hour', 'minute'];
      const i = zones.indexOf(this.zone);
      this.zone = zones[(i + (e.shiftKey ? -1 : 1) + zones.length) % zones.length];
      this.typed = '';
      this.drawPopup();
      this.ui.announcer.announce(this.zone === 'grid' ? 'Calendar' : this.zone === 'ampm' ? 'AM or PM' : this.zone);
      return true;
    }
    if (this.zone !== 'grid') return this.timeKeys(e);
    if (this.calView === 'days') return this.dayKeys(e);
    return this.pickerKeys(e);
  };

  private moveActive(next: YMD): void {
    this.active = next;
    this.viewYear = next.y;
    this.viewMonth = next.m;
    this.drawPopup();
    const v = this.value;
    this.ui.announcer.announce(
      `${this.fmt.long(next)}${this.isDisabledDate(next) ? ', unavailable' : ''}${v && sameDay(v, next) ? ', selected' : ''}`,
    );
  }

  private dayKeys(e: KeyboardEvent): boolean {
    const a = this.active;
    switch (e.key) {
      case 'ArrowLeft':
        this.moveActive(addDays(a, -1));
        return true;
      case 'ArrowRight':
        this.moveActive(addDays(a, 1));
        return true;
      case 'ArrowUp':
        this.moveActive(addDays(a, -7));
        return true;
      case 'ArrowDown':
        this.moveActive(addDays(a, 7));
        return true;
      case 'PageUp':
        this.moveActive(addMonths(a, e.shiftKey ? -12 : -1));
        return true;
      case 'PageDown':
        this.moveActive(addMonths(a, e.shiftKey ? 12 : 1));
        return true;
      case 'Home':
        this.moveActive(addDays(a, -((weekday(a.y, a.m, a.d) - this.firstDay + 7) % 7)));
        return true;
      case 'End':
        this.moveActive(addDays(a, 6 - ((weekday(a.y, a.m, a.d) - this.firstDay + 7) % 7)));
        return true;
      case 't':
      case 'T':
        this.moveActive(today());
        return true;
      case 'Enter':
      case ' ':
        this.selectDate(a);
        return true;
    }
    return e.key.length === 1; // swallow other printable keys
  }

  private pickerKeys(e: KeyboardEvent): boolean {
    const months = this.calView === 'months';
    const i = months ? this.viewMonth : this.viewYear;
    // Months view: PageUp/Down = ±1 year (12 months). Years view: ±12 years (one page).
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3, PageUp: -12, PageDown: 12 } as Record<string, number>)[e.key];
    if (step !== undefined) {
      if (months) {
        const total = this.viewYear * 12 + i + step;
        this.viewYear = Math.floor(total / 12);
        this.viewMonth = ((total % 12) + 12) % 12;
      } else {
        this.viewYear = i + step;
      }
      this.drawPopup();
      this.ui.announcer.announce(months ? this.fmt.monthYear(this.viewYear, this.viewMonth) : String(this.viewYear));
      return true;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (months) {
        this.calView = 'days';
        this.active = this.clampToRange({ y: this.viewYear, m: this.viewMonth, d: Math.min(this.active.d, daysInMonth(this.viewYear, this.viewMonth)) });
      } else {
        this.calView = 'months';
      }
      this.drawPopup();
      return true;
    }
    return e.key.length === 1;
  }

  private timeKeys(e: KeyboardEvent): boolean {
    const z = this.zone as Exclude<Zone, 'grid'>;
    switch (e.key) {
      case 'ArrowUp':
        this.adjustTime(z, 1);
        return true;
      case 'ArrowDown':
        this.adjustTime(z, -1);
        return true;
      case 'ArrowLeft':
      case 'ArrowRight': {
        const zones: Zone[] = this.hour12 ? ['hour', 'minute', 'ampm'] : ['hour', 'minute'];
        const i = zones.indexOf(z) + (e.key === 'ArrowRight' ? 1 : -1);
        this.zone = zones[Math.max(0, Math.min(zones.length - 1, i))];
        this.typed = '';
        this.drawPopup();
        return true;
      }
      case 'Enter':
        this.setOpen(false);
        return true;
    }
    if (/^[0-9]$/.test(e.key)) {
      this.typeTime(e.key);
      return true;
    }
    if (z === 'ampm' && /^[aApP]$/.test(e.key)) {
      const pm = /p/i.test(e.key);
      const v = this.value;
      if (v && pm !== v.hh >= 12) this.adjustTime('ampm', 1);
      return true;
    }
    return e.key.length === 1;
  }

  // ------------------------------------------------------------------ pointer
  private onFieldTap(e: FederatedPointerEvent): void {
    const p = e.getLocalPosition(this.body);
    if (this.clearable && this.value && p.x > this._width - 64 && p.x < this._width - 36) {
      this.setValue(null);
      this.ui.announcer.announce('Date cleared');
      return;
    }
    this.setOpen(!this.open);
  }

  private onPanelTap(e: FederatedPointerEvent): void {
    this.ui.focus.claimed = true;
    if (this.ui.focus.gestureMoved) return;
    const h = this.hitTest(e);
    if (!h) return;
    switch (h.kind) {
      case 'prev':
      case 'next': {
        const d = h.kind === 'prev' ? -1 : 1;
        if (this.calView === 'days') {
          const t = addMonths({ y: this.viewYear, m: this.viewMonth, d: 1 }, d);
          this.viewYear = t.y;
          this.viewMonth = t.m;
        } else this.viewYear += this.calView === 'months' ? d : d * 12;
        break;
      }
      case 'title':
        this.calView = this.calView === 'days' ? 'months' : this.calView === 'months' ? 'years' : 'days';
        break;
      case 'cell':
        if (this.calView === 'days') {
          const date = this.cellDate(h.index);
          return this.selectDate(date);
        }
        if (this.calView === 'months') {
          this.viewMonth = h.index;
          this.calView = 'days';
        } else {
          this.viewYear = this.yearPageStart() + h.index;
          this.calView = 'months';
        }
        break;
      case 'time':
        this.zone = h.zone;
        this.adjustTime(h.zone, h.dir);
        return;
      case 'today': {
        const t = this.clampToRange(today());
        this.calView = 'days';
        return this.selectDate(t);
      }
      case 'clear':
        this.setValue(null);
        this.setOpen(false);
        return;
      case 'done':
        this.setOpen(false);
        return;
    }
    this.drawPopup();
  }

  // ------------------------------------------------------------------ geometry
  private popupWidth(): number {
    return Math.min(328, this.ui.app.screen.width - 16);
  }

  private gridTop(): number {
    return PAD + HEADER + 6;
  }

  private gridHeight(): number {
    return WEEKDAYS_H + CELL_H * 6;
  }

  private timeTop(): number {
    return this.gridTop() + this.gridHeight() + 8;
  }

  private footerTop(): number {
    return this.withTime ? this.timeTop() + TIME_H + 8 : this.gridTop() + this.gridHeight() + 8;
  }

  private popupHeight(): number {
    return this.footerTop() + FOOTER_H + PAD;
  }

  private gridOffset(): number {
    return (weekday(this.viewYear, this.viewMonth, 1) - this.firstDay + 7) % 7;
  }

  private cellDate(i: number): YMD {
    return addDays({ y: this.viewYear, m: this.viewMonth, d: 1 }, i - this.gridOffset());
  }

  private yearPageStart(): number {
    return Math.floor(this.viewYear / 12) * 12;
  }

  private timeBoxes(): { zone: Exclude<Zone, 'grid'>; x: number; w: number }[] {
    const W = this.popupWidth();
    const w = 56;
    const gap = 10;
    const zones: Exclude<Zone, 'grid'>[] = this.hour12 ? ['hour', 'minute', 'ampm'] : ['hour', 'minute'];
    const total = zones.length * w + (zones.length - 1) * gap + 14;
    let x = W - PAD - total;
    return zones.map((zone, i) => {
      const box = { zone, x, w };
      x += w + gap + (i === 0 ? 14 : 0); // room for the ':'
      return box;
    });
  }

  private hitTest(e: FederatedPointerEvent): Hit | null {
    const p = e.getLocalPosition(this.panel);
    const W = this.popupWidth();
    if (p.y >= PAD && p.y <= PAD + HEADER) {
      if (p.x < PAD + HEADER) return { kind: 'prev' };
      if (p.x > W - PAD - HEADER) return { kind: 'next' };
      return { kind: 'title' };
    }
    const gt = this.gridTop();
    const gw = W - PAD * 2;
    if (p.y >= gt && p.y < gt + this.gridHeight() && p.x >= PAD && p.x < W - PAD) {
      if (this.calView === 'days') {
        if (p.y < gt + WEEKDAYS_H) return null;
        const col = Math.floor(((p.x - PAD) / gw) * 7);
        const row = Math.floor((p.y - gt - WEEKDAYS_H) / CELL_H);
        return { kind: 'cell', index: row * 7 + col };
      }
      const col = Math.floor(((p.x - PAD) / gw) * 3);
      const row = Math.floor(((p.y - gt) / this.gridHeight()) * 4);
      return { kind: 'cell', index: row * 3 + col };
    }
    if (this.withTime) {
      const tt = this.timeTop() + 8;
      if (p.y >= tt && p.y <= tt + 48) {
        for (const b of this.timeBoxes()) {
          if (p.x >= b.x && p.x <= b.x + b.w) {
            if (b.zone === 'ampm') return { kind: 'time', zone: 'ampm', dir: 1 };
            return { kind: 'time', zone: b.zone, dir: p.y < tt + 24 ? 1 : -1 };
          }
        }
      }
    }
    const ft = this.footerTop();
    if (p.y >= ft && p.y <= ft + FOOTER_H) {
      if (p.x < PAD + 76) return { kind: 'today' };
      if (this.clearable && this.value && p.x < PAD + 152) return { kind: 'clear' };
      if (this.withTime && p.x > W - PAD - 80) return { kind: 'done' };
    }
    return null;
  }

  private positionPopup(): void {
    const b = this.body.getBounds();
    const screen = this.ui.app.screen;
    const W = this.popupWidth();
    const H = this.popupHeight();
    const below = b.y + b.height + 6;
    let y: number;
    if (below + H <= screen.height - 8) y = below;
    else if (b.y - H - 6 >= 8) y = b.y - H - 6;
    else y = Math.max(8, screen.height - H - 8);
    const x = Math.max(8, Math.min(b.x, screen.width - W - 8));
    const local = this.ui.overlay.toLocal({ x, y });
    this.popup.position.set(local.x, local.y);
    const origin = this.popup.toLocal({ x: 0, y: 0 });
    this.catcher.clear().rect(origin.x, origin.y, screen.width, screen.height).fill({ color: 0x000000, alpha: 0.001 });
  }

  // ------------------------------------------------------------------ drawing: popup
  private drawPopup(): void {
    if (!this.open) return;
    this.positionPopup();
    const t = this.theme;
    const c = t.colors;
    const W = this.popupWidth();
    const H = this.popupHeight();
    const g = this.marks.clear();
    this.panel
      .clear()
      .roundRect(0, 6, W, H, t.radius + 4)
      .fill({ color: c.shadow, alpha: 0.14 })
      .roundRect(0, 0, W, H, t.radius + 4)
      .fill(c.surface)
      .stroke({ width: 1, color: c.border, alignment: 1 });
    this.panel.hitArea = new Rectangle(0, 0, W, H);
    const hov = (h: Hit) => JSON.stringify(h) === JSON.stringify(this.hover);
    const style = (size: number, fill: number, weight: string = t.fontWeight) => ({
      fontFamily: t.fontFamily.join(','),
      fontSize: size,
      fill,
      fontWeight: weight as typeof t.fontWeight,
    });

    // header
    for (const [kind, cx, dir] of [['prev', PAD + HEADER / 2, 'left'], ['next', W - PAD - HEADER / 2, 'right']] as const) {
      if (hov({ kind })) g.circle(cx, PAD + HEADER / 2, 16).fill({ color: c.text, alpha: 0.07 });
      Icons.arrow(g, cx, PAD + HEADER / 2, 20, c.text, dir);
    }
    const title =
      this.calView === 'days'
        ? this.fmt.monthYear(this.viewYear, this.viewMonth)
        : this.calView === 'months'
          ? String(this.viewYear)
          : `${this.yearPageStart()} – ${this.yearPageStart() + 11}`;
    this.titleText.text = title;
    this.titleText.style = style(t.fontSize, c.text, '600');
    this.titleText.position.set(W / 2 - 8, PAD + HEADER / 2);
    if (hov({ kind: 'title' })) g.roundRect(W / 2 - this.titleText.width / 2 - 14, PAD + 4, this.titleText.width + 36, HEADER - 8, 8).fill({ color: c.text, alpha: 0.07 });
    Icons.chevron(g, W / 2 + this.titleText.width / 2 + 4, PAD + HEADER / 2, 16, c.textMuted, this.calView !== 'days');

    // grid
    const gt = this.gridTop();
    const gw = W - PAD * 2;
    const todayD = today();
    for (const txt of [...this.weekdayTexts, ...this.cellTexts]) txt.visible = false;
    const focusRing = (x: number, y: number, w: number, h: number, r: number) =>
      g.roundRect(x - 2, y - 2, w + 4, h + 4, r + 2).stroke({ width: 2, color: c.focusRing });
    if (this.calView === 'days') {
      const cw = gw / 7;
      for (let i = 0; i < 7; i++) {
        const wt = this.weekdayTexts[i];
        wt.visible = true;
        wt.text = this.fmt.weekdayShort((this.firstDay + i) % 7).slice(0, 2);
        wt.style = style(t.helperFontSize, c.textMuted, '600');
        wt.position.set(PAD + cw * i + cw / 2, gt + WEEKDAYS_H / 2);
      }
      for (let i = 0; i < 42; i++) {
        const d = this.cellDate(i);
        const x = PAD + (i % 7) * cw;
        const y = gt + WEEKDAYS_H + Math.floor(i / 7) * CELL_H;
        const inMonth = d.m === this.viewMonth;
        const disabled = this.isDisabledDate(d);
        const selected = sameDay(this.value, d);
        const isToday = sameDay(todayD, d);
        const isActive = sameDay(this.active, d) && this.zone === 'grid';
        const r = Math.min(cw, CELL_H) / 2 - 3;
        const cx = x + cw / 2;
        const cy = y + CELL_H / 2;
        if (selected) g.circle(cx, cy, r).fill(disabled ? c.textDisabled : c.primary);
        else if (hov({ kind: 'cell', index: i }) && !disabled) g.circle(cx, cy, r).fill({ color: c.primary, alpha: 0.1 });
        if (isToday && !selected) g.circle(cx, cy, r).stroke({ width: 1.5, color: c.primary });
        if (isActive) g.circle(cx, cy, r + 3).stroke({ width: 2, color: c.focusRing });
        const txt = this.cellTexts[i];
        txt.visible = true;
        txt.text = String(d.d);
        txt.style = style(t.fontSize - 1, selected ? c.primaryText : disabled ? c.textDisabled : inMonth ? c.text : c.textMuted, selected || isToday ? '600' : t.fontWeight);
        txt.alpha = inMonth || selected ? 1 : 0.55;
        txt.position.set(cx, cy);
        if (disabled && inMonth) g.moveTo(cx - 7, cy + 1).lineTo(cx + 7, cy + 1).stroke({ width: 1, color: c.textDisabled });
      }
    } else {
      const cw = gw / 3;
      const ch = this.gridHeight() / 4;
      for (let i = 0; i < 12; i++) {
        const x = PAD + (i % 3) * cw;
        const y = gt + Math.floor(i / 3) * ch;
        const months = this.calView === 'months';
        const label = months ? this.fmt.monthShort(i) : String(this.yearPageStart() + i);
        const isSel = months
          ? !!this.value && this.value.y === this.viewYear && this.value.m === i
          : !!this.value && this.value.y === this.yearPageStart() + i;
        const isCur = months ? this.viewMonth === i : this.viewYear === this.yearPageStart() + i;
        const bx = x + 6;
        const by = y + 8;
        const bw = cw - 12;
        const bh = ch - 16;
        if (isSel) g.roundRect(bx, by, bw, bh, 10).fill(c.primary);
        else if (hov({ kind: 'cell', index: i })) g.roundRect(bx, by, bw, bh, 10).fill({ color: c.primary, alpha: 0.1 });
        if (isCur && this.zone === 'grid') focusRing(bx, by, bw, bh, 10);
        const txt = this.cellTexts[i];
        txt.visible = true;
        txt.alpha = 1;
        txt.text = label;
        txt.style = style(t.fontSize, isSel ? c.primaryText : c.text, isSel ? '600' : t.fontWeight);
        txt.position.set(x + cw / 2, y + ch / 2);
      }
    }

    // time row
    for (const txt of this.timeTexts) txt.visible = false;
    if (this.withTime) {
      const tt = this.timeTop();
      g.moveTo(PAD, tt).lineTo(W - PAD, tt).stroke({ width: 1, color: c.border, alpha: 0.6 });
      const v = this.value ?? { ...this.clampToRange(today()), ...this.defaultTime };
      const label = this.timeTexts[0];
      label.visible = true;
      label.text = 'Time';
      label.style = style(t.fontSize - 1, c.textMuted, '500');
      label.position.set(PAD + label.width / 2, tt + 8 + 24);
      const boxes = this.timeBoxes();
      boxes.forEach((b, i) => {
        const by = tt + 8;
        const focused = this.zone === b.zone;
        g.roundRect(b.x, by, b.w, 48, 10).fill(c.surface).stroke({ width: focused ? 2 : 1, color: focused ? c.borderFocus : c.border, alignment: 1 });
        if (b.zone !== 'ampm') {
          const up = hov({ kind: 'time', zone: b.zone, dir: 1 });
          const down = hov({ kind: 'time', zone: b.zone, dir: -1 });
          Icons.arrow(g, b.x + b.w / 2, by + 7, 12, up ? c.primary : c.textMuted, 'up');
          Icons.arrow(g, b.x + b.w / 2, by + 41, 12, down ? c.primary : c.textMuted, 'down');
        }
        const txt = this.timeTexts[i + 1];
        txt.visible = true;
        const h12 = v.hh % 12 === 0 ? 12 : v.hh % 12;
        txt.text = b.zone === 'hour' ? String(this.hour12 ? h12 : v.hh).padStart(2, '0') : b.zone === 'minute' ? String(v.mm).padStart(2, '0') : v.hh < 12 ? 'AM' : 'PM';
        txt.style = style(t.fontSize + 1, this.value ? c.text : c.placeholder, '600');
        txt.position.set(b.x + b.w / 2, by + 24);
        if (i === 0) {
          const colon = this.timeTexts[4];
          colon.visible = true;
          colon.text = ':';
          colon.style = style(t.fontSize + 2, c.textMuted, '600');
          colon.position.set(b.x + b.w + 12, by + 23);
        }
      });
    }

    // footer
    const ft = this.footerTop();
    const items: { kind: 'today' | 'clear' | 'done'; label: string; x: number; strong?: boolean }[] = [{ kind: 'today', label: 'Today', x: PAD + 38 }];
    if (this.clearable && this.value) items.push({ kind: 'clear', label: 'Clear', x: PAD + 114 });
    if (this.withTime) items.push({ kind: 'done', label: 'Done', x: W - PAD - 40, strong: true });
    this.footerTexts.forEach((txt) => (txt.visible = false));
    items.forEach((it, i) => {
      const txt = this.footerTexts[i];
      txt.visible = true;
      txt.text = it.label;
      txt.style = style(t.fontSize - 1, it.strong ? c.primaryText : c.primary, '600');
      txt.position.set(it.x, ft + FOOTER_H / 2);
      const bw = Math.max(64, txt.width + 24);
      if (it.strong) g.roundRect(it.x - bw / 2, ft + 2, bw, FOOTER_H - 4, 9).fill(hov({ kind: it.kind }) ? c.primaryHover : c.primary);
      else if (hov({ kind: it.kind })) g.roundRect(it.x - bw / 2, ft + 2, bw, FOOTER_H - 4, 9).fill({ color: c.primary, alpha: 0.1 });
    });
  }

  // ------------------------------------------------------------------ drawing: field
  protected bodyHeight(): number {
    return this.theme.controlHeight;
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
    const v = this.value;
    this.valueText.text = v ? `${this.fmt.medium(v)}${this.withTime ? ` · ${formatTime(v.hh, v.mm, this.hour12)}` : ''}` : this.placeholder;
    this.valueText.style = this.textStyle('body', !this._enabled ? c.textDisabled : v ? c.text : c.placeholder);
    this.valueText.position.set(t.paddingX, Math.round((h - this.valueText.height) / 2));
    const ic = this.icons.clear();
    Icons.calendar(ic, w - 22, h / 2, 22, this._enabled ? (this.open ? c.primary : c.textMuted) : c.textDisabled);
    if (this.clearable && v && this._enabled) Icons.close(ic, w - 50, h / 2, 16, c.textMuted);
    this.drawFocus(0, 0, w, h, t.radius);
    this.body.hitArea = new Rectangle(0, 0, w, h);
    if (this.open) this.drawPopup();
  }

  override destroy(options?: Parameters<Control<string | null>['destroy']>[0]): void {
    this.setOpen(false);
    window.clearTimeout(this.typedTimer);
    this.popup.destroy({ children: true });
    super.destroy(options);
  }
}
