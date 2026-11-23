/**
 * Calendar math on plain numbers (year, month 0–11, day). All conversions go
 * through UTC so the user's timezone and DST can never shift a date.
 */
export interface YMD {
  y: number;
  m: number; // 0–11
  d: number;
}

export interface DateTimeParts extends YMD {
  hh: number;
  mm: number;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export const weekday = (y: number, m: number, d: number): number => new Date(Date.UTC(y, m, d)).getUTCDay();
export const key = (v: YMD): number => v.y * 10000 + (v.m + 1) * 100 + v.d;

export function addDays(v: YMD, n: number): YMD {
  const t = new Date(Date.UTC(v.y, v.m, v.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}

/** Adds months, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(v: YMD, n: number): YMD {
  const total = v.y * 12 + v.m + n;
  const y = Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  return { y, m, d: Math.min(v.d, daysInMonth(y, m)) };
}

export function today(): YMD {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
}

export const sameDay = (a: YMD | null, b: YMD | null): boolean => !!a && !!b && key(a) === key(b);

export const toISODate = (v: YMD): string => `${pad(v.y, 4)}-${pad(v.m + 1)}-${pad(v.d)}`;
export const toISO = (v: DateTimeParts, withTime: boolean): string =>
  withTime ? `${toISODate(v)}T${pad(v.hh)}:${pad(v.mm)}` : toISODate(v);

/** Parses `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`; returns null for invalid dates (e.g. 2026-02-30). */
export function parseISO(s: string | null | undefined): DateTimeParts | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2] - 1;
  const d = +m[3];
  const hh = m[4] ? +m[4] : 0;
  const mm = m[5] ? +m[5] : 0;
  if (mo < 0 || mo > 11 || d < 1 || d > daysInMonth(y, mo) || hh > 23 || mm > 59) return null;
  return { y, m: mo, d, hh, mm };
}

/** `'today'`, `'today+30'`, `'today-6570'` or an ISO date → YMD. */
export function resolveDate(s: string | undefined): YMD | null {
  if (!s) return null;
  const rel = /^today([+-]\d+)?$/.exec(s.trim());
  if (rel) return addDays(today(), rel[1] ? +rel[1] : 0);
  return parseISO(s);
}

const utcDate = (v: YMD, hh = 0, mm = 0) => new Date(Date.UTC(v.y, v.m, v.d, hh, mm));

export function formatters(locale: string | undefined) {
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const medium = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const monthShort = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  const weekdayNarrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  return {
    long: (v: YMD) => long.format(utcDate(v)),
    medium: (v: YMD) => medium.format(utcDate(v)),
    monthYear: (y: number, m: number) => monthYear.format(utcDate({ y, m, d: 1 })),
    monthShort: (m: number) => monthShort.format(utcDate({ y: 2024, m, d: 1 })),
    // 2023-01-01 was a Sunday.
    weekdayNarrow: (wd: number) => weekdayNarrow.format(utcDate({ y: 2023, m: 0, d: 1 + wd })),
    weekdayShort: (wd: number) => weekdayShort.format(utcDate({ y: 2023, m: 0, d: 1 + wd })),
  };
}

/** Whether the locale uses a 12-hour clock. */
export function localeUses12h(locale: string | undefined): boolean {
  return !!new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12;
}

/** First day of week for a locale (0 = Sunday, 1 = Monday…), falling back to Monday. */
export function localeFirstDay(locale: string | undefined): number {
  try {
    const loc = new Intl.Locale(locale ?? navigator.language) as Intl.Locale & {
      weekInfo?: { firstDay: number };
      getWeekInfo?: () => { firstDay: number };
    };
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info?.firstDay) return info.firstDay % 7;
  } catch {
    /* unsupported */
  }
  return 1;
}

export function formatTime(hh: number, mm: number, hour12: boolean): string {
  if (!hour12) return `${pad(hh)}:${pad(mm)}`;
  const h = hh % 12 === 0 ? 12 : hh % 12;
  return `${h}:${pad(mm)} ${hh < 12 ? 'AM' : 'PM'}`;
}
