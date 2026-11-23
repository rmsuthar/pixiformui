/**
 * Design tokens for every PixiForm control. Pass a partial override to
 * `createTheme` (globally) or to any control's `theme` option (per instance).
 */
export interface ThemeColors {
  background: number;
  surface: number;
  surfaceHover: number;
  surfaceDisabled: number;
  border: number;
  borderHover: number;
  borderFocus: number;
  text: number;
  textMuted: number;
  textDisabled: number;
  placeholder: number;
  primary: number;
  primaryHover: number;
  primaryPressed: number;
  primaryText: number;
  secondary: number;
  secondaryHover: number;
  secondaryText: number;
  error: number;
  warning: number;
  success: number;
  selection: number;
  caret: number;
  focusRing: number;
  track: number;
  thumb: number;
  /** Toasts / privacy screen. */
  inverseSurface: number;
  inverseText: number;
  overlay: number;
  shadow: number;
}

export interface Theme {
  /** Font families, in priority order. Generic families are left unquoted. */
  fontFamily: string[];
  fontSize: number;
  fontWeight: 'normal' | 'bold' | '400' | '500' | '600' | '700';
  labelFontSize: number;
  labelFontWeight: 'normal' | 'bold' | '400' | '500' | '600' | '700';
  helperFontSize: number;
  titleFontSize: number;
  lineHeight: number;
  radius: number;
  borderWidth: number;
  controlHeight: number;
  paddingX: number;
  paddingY: number;
  labelGap: number;
  helperGap: number;
  focusRingWidth: number;
  focusRingOffset: number;
  buttonHeight: number;
  buttonRadius: number;
  checkboxSize: number;
  toggleWidth: number;
  toggleHeight: number;
  sliderTrackHeight: number;
  sliderThumbSize: number;
  caretWidth: number;
  caretBlinkMs: number;
  dropdownMaxVisible: number;
  dropdownItemHeight: number;
  /** 0..1 approach factor per 60fps frame for state animations. */
  animationSpeed: number;
  colors: ThemeColors;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const baseTokens: Omit<Theme, 'colors'> = {
  fontFamily: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
  fontSize: 15,
  fontWeight: '400',
  labelFontSize: 13,
  labelFontWeight: '600',
  helperFontSize: 12,
  titleFontSize: 22,
  lineHeight: 1.45,
  radius: 10,
  borderWidth: 1.5,
  controlHeight: 44,
  paddingX: 14,
  paddingY: 10,
  labelGap: 7,
  helperGap: 6,
  focusRingWidth: 3,
  focusRingOffset: 2,
  buttonHeight: 44,
  buttonRadius: 10,
  checkboxSize: 20,
  toggleWidth: 44,
  toggleHeight: 26,
  sliderTrackHeight: 6,
  sliderThumbSize: 22,
  caretWidth: 1.5,
  caretBlinkMs: 530,
  dropdownMaxVisible: 6,
  dropdownItemHeight: 38,
  animationSpeed: 0.25,
};

export const lightTheme: Theme = deepFreeze({
  ...baseTokens,
  colors: {
    background: 0xeef1f6,
    surface: 0xffffff,
    surfaceHover: 0xf7f9fc,
    surfaceDisabled: 0xeef0f4,
    border: 0xc9d1dd,
    borderHover: 0x9aa7ba,
    borderFocus: 0x4f46e5,
    text: 0x111827,
    textMuted: 0x5b6577,
    textDisabled: 0x9aa3b2,
    placeholder: 0x98a2b3,
    primary: 0x4f46e5,
    primaryHover: 0x4338ca,
    primaryPressed: 0x3730a3,
    primaryText: 0xffffff,
    secondary: 0xe8eaf2,
    secondaryHover: 0xdcdfea,
    secondaryText: 0x1f2937,
    error: 0xd92d20,
    warning: 0xb54708,
    success: 0x079455,
    selection: 0xc7d2fe,
    caret: 0x4f46e5,
    focusRing: 0xa5b4fc,
    track: 0xdde2ea,
    thumb: 0xffffff,
    inverseSurface: 0x1f2433,
    inverseText: 0xf3f4f6,
    overlay: 0x0b1020,
    shadow: 0x0b1020,
  },
});

export const darkTheme: Theme = deepFreeze({
  ...baseTokens,
  colors: {
    background: 0x0f1218,
    surface: 0x1a1f29,
    surfaceHover: 0x212734,
    surfaceDisabled: 0x161a22,
    border: 0x343c4c,
    borderHover: 0x4c566a,
    borderFocus: 0x818cf8,
    text: 0xeef1f6,
    textMuted: 0xa3acbb,
    textDisabled: 0x5d6678,
    placeholder: 0x6b7487,
    primary: 0x6366f1,
    primaryHover: 0x7477f5,
    primaryPressed: 0x5458e0,
    primaryText: 0xffffff,
    secondary: 0x2a3140,
    secondaryHover: 0x343c4e,
    secondaryText: 0xe5e7eb,
    error: 0xf97066,
    warning: 0xfdb022,
    success: 0x47cd89,
    selection: 0x3730a3,
    caret: 0xa5b4fc,
    focusRing: 0x6366f1,
    track: 0x2c3342,
    thumb: 0xffffff,
    inverseSurface: 0xeef1f6,
    inverseText: 0x111827,
    overlay: 0x000000,
    shadow: 0x000000,
  },
});

/** Derives a theme from one brand colour (similar in spirit to Flutter's ColorScheme.fromSeed). */
export function themeFromSeed(seed: number, dark = false): Theme {
  const base = dark ? darkTheme : lightTheme;
  const primary = dark ? mix(seed, 0xffffff, 0.15) : seed;
  return createTheme(base, {
    colors: {
      primary,
      primaryHover: mix(primary, dark ? 0xffffff : 0x000000, 0.12),
      primaryPressed: mix(primary, 0x000000, 0.22),
      borderFocus: primary,
      caret: primary,
      focusRing: mix(primary, dark ? 0x000000 : 0xffffff, 0.45),
      selection: mix(primary, dark ? 0x000000 : 0xffffff, dark ? 0.45 : 0.72),
    },
  });
}

/** Linear RGB mix: t=0 -> a, t=1 -> b. */
export function mix(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return m(16) | m(8) | m(0);
}

/** Deep-merges overrides onto a base theme. The result is frozen. */
export function createTheme(base: Theme, overrides?: DeepPartial<Theme>): Theme {
  if (!overrides) return base;
  return deepFreeze(deepMerge(base, overrides) as Theme);
}

function deepMerge(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (Array.isArray(over) || typeof over !== 'object' || over === null) return over;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(over)) {
    // Guard against prototype pollution from untrusted theme JSON.
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    out[key] = deepMerge((base as Record<string, unknown>)?.[key], (over as Record<string, unknown>)[key]);
  }
  return out;
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj)) deepFreeze(v);
  }
  return obj;
}

const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji',
]);

/** CSS font shorthand that matches how the renderer builds its font strings. */
export function cssFont(theme: Theme, size = theme.fontSize, weight: string = theme.fontWeight): string {
  const families = theme.fontFamily
    .map((f) => {
      const name = f.trim();
      if (GENERIC_FAMILIES.has(name) || /^["']/.test(name)) return name;
      return `"${name.replace(/["\\]/g, '')}"`;
    })
    .join(',');
  return `normal normal ${weight} ${size}px ${families}`;
}

// =====================================================================================
// Palette API: describe a form with three colour groups, derive every token.
// =====================================================================================

/** Surfaces and lines ("theme colors"). */
export interface ThemeColorGroup {
  /** Page / canvas background. */
  background?: number;
  /** Field, card and menu background. */
  surface?: number;
  /** Default field border. */
  border?: number;
  /** Border on hover. Derived from border + text if omitted. */
  borderHover?: number;
  shadow?: number;
}

/** Text colours. */
export interface TextColorGroup {
  /** Main text: values, labels. */
  primary?: number;
  /** Helper text, descriptions, icons. */
  secondary?: number;
  disabled?: number;
  placeholder?: number;
  /** Text drawn on the accent colour (primary buttons). Auto-picked for contrast if omitted. */
  onAccent?: number;
}

/** Accent ("brand") colours. Pass a number for just the base colour. */
export interface AccentColorGroup {
  base: number;
  hover?: number;
  pressed?: number;
  /** Keyboard focus ring. */
  focusRing?: number;
  /** Text selection highlight. */
  selection?: number;
  caret?: number;
}

export interface StatusColorGroup {
  error?: number;
  warning?: number;
  success?: number;
}

export interface FormPalette {
  /** Base defaults for anything not given. Default 'light'. */
  mode?: 'light' | 'dark';
  theme?: ThemeColorGroup;
  text?: TextColorGroup;
  accent?: AccentColorGroup | number;
  status?: StatusColorGroup;
}

/**
 * Builds a complete theme from a palette, deriving hover/pressed shades,
 * focus ring, selection, tracks and contrast-safe text on the accent.
 *
 *   createFormTheme({
 *     mode: 'light',
 *     theme:  { background: 0xf5f7fb, surface: 0xffffff, border: 0xd0d7e2 },
 *     text:   { primary: 0x0f172a, secondary: 0x475569 },
 *     accent: { base: 0x0f766e },
 *   }, { radius: 12 })
 */
export function createFormTheme(palette: FormPalette, tokens?: DeepPartial<Omit<Theme, 'colors'>>): Theme {
  const dark = palette.mode === 'dark';
  const base = dark ? darkTheme : lightTheme;
  const b = base.colors;
  const th = palette.theme ?? {};
  const tx = palette.text ?? {};
  const ac: AccentColorGroup = typeof palette.accent === 'number' ? { base: palette.accent } : (palette.accent ?? { base: b.primary });
  const st = palette.status ?? {};

  const background = th.background ?? b.background;
  const surface = th.surface ?? b.surface;
  const text = tx.primary ?? b.text;
  const textMuted = tx.secondary ?? mix(text, surface, 0.4);
  const border = th.border ?? mix(surface, text, dark ? 0.22 : 0.2);
  const accent = ac.base;
  const towards = dark ? 0xffffff : 0x000000;

  return createTheme(base, {
    ...(tokens ?? {}),
    colors: {
      background,
      surface,
      surfaceHover: mix(surface, text, dark ? 0.05 : 0.025),
      surfaceDisabled: mix(surface, background, 0.6),
      border,
      borderHover: th.borderHover ?? mix(border, text, 0.35),
      borderFocus: accent,
      text,
      textMuted,
      textDisabled: tx.disabled ?? mix(text, surface, 0.62),
      placeholder: tx.placeholder ?? mix(textMuted, surface, 0.3),
      primary: accent,
      primaryHover: ac.hover ?? mix(accent, towards, 0.12),
      primaryPressed: ac.pressed ?? mix(accent, 0x000000, 0.22),
      primaryText: tx.onAccent ?? readableOn(accent),
      secondary: mix(surface, text, dark ? 0.1 : 0.07),
      secondaryHover: mix(surface, text, dark ? 0.15 : 0.11),
      secondaryText: text,
      error: st.error ?? b.error,
      warning: st.warning ?? b.warning,
      success: st.success ?? b.success,
      selection: ac.selection ?? mix(accent, surface, dark ? 0.55 : 0.72),
      caret: ac.caret ?? accent,
      focusRing: ac.focusRing ?? mix(accent, surface, 0.45),
      track: mix(border, surface, 0.35),
      thumb: 0xffffff,
      inverseSurface: text,
      inverseText: surface,
      overlay: 0x000000,
      shadow: th.shadow ?? 0x000000,
    },
  });
}

/** Ready-made accent palettes (light and dark variants). */
export const accentPalettes = {
  indigo: { light: 0x4f46e5, dark: 0x818cf8 },
  teal: { light: 0x0f766e, dark: 0x2dd4bf },
  rose: { light: 0xe11d48, dark: 0xfb7185 },
  amber: { light: 0xb45309, dark: 0xfbbf24 },
  violet: { light: 0x7c3aed, dark: 0xa78bfa },
  slate: { light: 0x334155, dark: 0xcbd5e1 },
} as const;
export type AccentName = keyof typeof accentPalettes;

/** Shorthand: a light/dark theme with one of the preset accents. */
export function presetTheme(accentName: AccentName, mode: 'light' | 'dark' = 'light'): Theme {
  return createFormTheme({ mode, accent: accentPalettes[accentName][mode] });
}

// ----------------------------------------------------------------- contrast helpers
function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0–1). */
export function luminance(color: number): number {
  return 0.2126 * channel((color >> 16) & 0xff) + 0.7152 * channel((color >> 8) & 0xff) + 0.0722 * channel(color & 0xff);
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrastRatio(a: number, b: number): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White or near-black, whichever reads better on `bg`. */
export function readableOn(bg: number): number {
  return contrastRatio(bg, 0xffffff) >= contrastRatio(bg, 0x111827) ? 0xffffff : 0x111827;
}

/** Lists colour pairs below WCAG AA (4.5:1 for text, 3:1 for UI parts). */
export function checkContrast(theme: Theme): string[] {
  const c = theme.colors;
  const pairs: [string, number, number, number][] = [
    ['text on surface', c.text, c.surface, 4.5],
    ['helper text on surface', c.textMuted, c.surface, 4.5],
    ['button text on accent', c.primaryText, c.primary, 4.5],
    ['error text on surface', c.error, c.surface, 4.5],
    ['focus border on surface', c.borderFocus, c.surface, 3],
  ];
  return pairs
    .filter(([, a, b, min]) => contrastRatio(a, b) < min)
    .map(([name, a, b, min]) => `${name}: ${contrastRatio(a, b).toFixed(2)}:1 (needs ${min}:1)`);
}
