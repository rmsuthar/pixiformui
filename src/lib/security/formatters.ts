/**
 * Flutter-style input formatters. Each formatter receives the text being
 * inserted (typed, pasted or IME-committed) and returns what should actually
 * be inserted. They run before sanitisation, which always runs last.
 */
export interface FormatterContext {
  /** Text before the insertion point (empty for secret fields). */
  before: string;
  /** Text after the insertion point (empty for secret fields). */
  after: string;
}
export type TextInputFormatter = (inserted: string, ctx: FormatterContext) => string;

const perChar = (re: RegExp, keep: boolean): TextInputFormatter => {
  const r = new RegExp(re.source, re.flags.replace(/[gy]/g, ''));
  return (s) => {
    let out = '';
    for (const ch of s) if (r.test(ch) === keep) out += ch;
    return out;
  };
};

export const Formatters = {
  /** Keep only characters matching `re` (like FilteringTextInputFormatter.allow). */
  allow: (re: RegExp): TextInputFormatter => perChar(re, true),
  /** Drop characters matching `re` (like FilteringTextInputFormatter.deny). */
  deny: (re: RegExp): TextInputFormatter => perChar(re, false),
  digitsOnly: (): TextInputFormatter => perChar(/[0-9]/, true),
  upperCase: (): TextInputFormatter => (s) => s.toUpperCase(),
  lowerCase: (): TextInputFormatter => (s) => s.toLowerCase(),
  /** No leading spaces and no runs of spaces. */
  singleSpaces: (): TextInputFormatter => (s, ctx) => {
    let out = s.replace(/[ \t]{2,}/g, ' ');
    if (out.startsWith(' ') && (ctx.before === '' || ctx.before.endsWith(' '))) out = out.slice(1);
    if (out.endsWith(' ') && ctx.after.startsWith(' ')) out = out.slice(0, -1);
    return out;
  },
  /** Strips anything that looks like markup, as defence in depth for values echoed elsewhere. */
  noMarkup: (): TextInputFormatter => perChar(/[<>`]/, false),
};
