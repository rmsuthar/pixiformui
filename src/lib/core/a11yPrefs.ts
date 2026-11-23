import { createTheme, mix, type Theme } from '../theme';

/** Accessibility preferences for a FormUI. 'auto' follows the operating system. */
export interface A11yOptions {
  /** Accessible name of the form (screen readers announce it). Default: the first heading, else "Form". */
  label?: string;
  /** Windows High Contrast / forced colors: repaint with the user's system colours. Default 'auto'. */
  forcedColors?: 'auto' | 'off';
  /** Stronger borders and text when the user asks for more contrast. Default 'auto'. */
  highContrast?: 'auto' | 'on' | 'off';
  /** Snap animations, steady caret, no shake. Default 'auto' (prefers-reduced-motion). */
  reducedMotion?: 'auto' | 'on' | 'off';
  /** Multiplies text and control sizes (1 = default, e.g. 1.25 for larger text). */
  textScale?: number;
  /** Re-render sharply when the browser zoom / device pixel ratio changes. Default true. */
  followZoom?: boolean;
  /** Hidden DOM outline of the form for screen readers (structure, roles, states; never values). Default true. */
  outline?: boolean;
}

export interface ActivePrefs {
  forcedColors: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  textScale: number;
}

const mq = (q: string): MediaQueryList | null => (typeof matchMedia === 'function' ? matchMedia(q) : null);

export const MEDIA = {
  forcedColors: '(forced-colors: active)',
  moreContrast: '(prefers-contrast: more)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
} as const;

export function readPrefs(o: A11yOptions): ActivePrefs {
  const pick = (setting: 'auto' | 'on' | 'off' | undefined, query: string) =>
    setting === 'on' ? true : setting === 'off' ? false : !!mq(query)?.matches;
  return {
    forcedColors: o.forcedColors === 'off' ? false : !!mq(MEDIA.forcedColors)?.matches,
    highContrast: pick(o.highContrast, MEDIA.moreContrast),
    reducedMotion: pick(o.reducedMotion, MEDIA.reducedMotion),
    textScale: Math.min(2, Math.max(0.75, o.textScale ?? 1)),
  };
}

/** Subscribes to every media query that affects the preferences. Returns an unsubscribe function. */
export function watchPrefs(onChange: () => void): () => void {
  const lists = Object.values(MEDIA).map(mq).filter((m): m is MediaQueryList => !!m);
  for (const m of lists) m.addEventListener('change', onChange);
  return () => lists.forEach((m) => m.removeEventListener('change', onChange));
}

/** Applies the active preferences to a base theme. */
export function adaptTheme(base: Theme, p: ActivePrefs): Theme {
  let t = base;
  if (p.textScale !== 1) t = scaleTheme(t, p.textScale);
  if (p.forcedColors) t = systemColorTheme(t) ?? t;
  else if (p.highContrast) t = increaseContrast(t);
  if (p.reducedMotion) t = createTheme(t, { animationSpeed: 0.99, caretBlinkMs: 1e9 });
  return t;
}

/** Larger (or smaller) text and controls, keeping proportions. */
export function scaleTheme(t: Theme, k: number): Theme {
  const r = (v: number) => Math.round(v * k);
  return createTheme(t, {
    fontSize: r(t.fontSize),
    labelFontSize: r(t.labelFontSize),
    helperFontSize: r(t.helperFontSize),
    titleFontSize: r(t.titleFontSize),
    controlHeight: r(t.controlHeight),
    buttonHeight: r(t.buttonHeight),
    paddingX: r(t.paddingX),
    paddingY: r(t.paddingY),
    checkboxSize: r(t.checkboxSize),
    toggleWidth: r(t.toggleWidth),
    toggleHeight: r(t.toggleHeight),
    sliderThumbSize: r(t.sliderThumbSize),
    dropdownItemHeight: r(t.dropdownItemHeight),
  });
}

/** prefers-contrast: more. Solid borders and secondary text at full strength. */
export function increaseContrast(t: Theme): Theme {
  const c = t.colors;
  return createTheme(t, {
    borderWidth: Math.max(2, t.borderWidth),
    focusRingWidth: Math.max(3, t.focusRingWidth),
    colors: {
      textMuted: mix(c.textMuted, c.text, 0.7),
      placeholder: mix(c.placeholder, c.text, 0.45),
      border: mix(c.border, c.text, 0.65),
      borderHover: c.text,
      focusRing: c.primary,
      track: mix(c.track, c.text, 0.45),
    },
  });
}

/**
 * Forced colors (Windows High Contrast). Canvas pixels aren't recoloured by the
 * browser, so read the user's actual system colours and paint with them.
 */
export function systemColorTheme(t: Theme): Theme | null {
  if (typeof document === 'undefined') return null;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;forced-color-adjust:auto';
  document.body.appendChild(probe);
  const read = (keyword: string): number | null => {
    probe.style.color = '';
    probe.style.color = keyword;
    const m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return null;
    return (Math.round(+m[0]) << 16) | (Math.round(+m[1]) << 8) | Math.round(+m[2]);
  };
  const canvas = read('Canvas');
  const text = read('CanvasText');
  const gray = read('GrayText');
  const hl = read('Highlight');
  const hlText = read('HighlightText');
  const btnFace = read('ButtonFace');
  const btnText = read('ButtonText');
  const link = read('LinkText');
  probe.remove();
  if (canvas === null || text === null || hl === null || hlText === null) return null;
  return createTheme(t, {
    borderWidth: Math.max(2, t.borderWidth),
    focusRingWidth: Math.max(3, t.focusRingWidth),
    focusRingOffset: Math.max(2, t.focusRingOffset),
    colors: {
      background: canvas,
      surface: canvas,
      surfaceHover: canvas,
      surfaceDisabled: canvas,
      border: text,
      borderHover: hl,
      borderFocus: hl,
      text,
      textMuted: text,
      textDisabled: gray ?? text,
      placeholder: gray ?? text,
      primary: hl,
      primaryHover: hl,
      primaryPressed: hl,
      primaryText: hlText,
      secondary: btnFace ?? canvas,
      secondaryHover: btnFace ?? canvas,
      secondaryText: btnText ?? text,
      error: link ?? text,
      warning: text,
      success: text,
      selection: hl,
      caret: text,
      focusRing: hl,
      track: gray ?? text,
      thumb: btnText ?? text,
      inverseSurface: text,
      inverseText: canvas,
      overlay: canvas,
      shadow: canvas,
    },
  });
}
