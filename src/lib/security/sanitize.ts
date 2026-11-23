/** Characters that must never enter a field. */
// C0/C1 control characters except TAB (\t) and LF (\n), which are handled separately.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
// Bidirectional overrides/isolates: used in "Trojan Source" and filename/URL spoofing.
const BIDI_CONTROLS = /[؜‎‏‪-‮⁦-⁩]/g;
// Invisible / zero-width characters used to smuggle or spoof text.
// ZWJ (U+200D) is kept so emoji sequences survive.
const INVISIBLE_CHARS = /[­᠎​‌⁠-⁤﻿￹-￻]/g;
// Unpaired surrogates.
const LONE_SURROGATES = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Hard ceiling on any single chunk of input (e.g. a huge paste). */
export const MAX_RAW_INPUT = 20_000;

export interface SanitizeOptions {
  /** Keep line breaks (textarea). Otherwise they become spaces. */
  multiline?: boolean;
  /** Only characters matching this pattern are kept (tested per character). */
  allow?: RegExp;
  /** Maximum number of code points to return. */
  maxCodePoints?: number;
  /** Unicode normalisation form. Default NFC. Use false to disable. */
  normalize?: 'NFC' | 'NFKC' | false;
}

/**
 * Cleans untrusted text before it reaches a field's buffer.
 * Order: truncate -> strip dangerous characters -> normalise -> filter -> clamp.
 */
export function sanitizeInput(raw: string, opts: SanitizeOptions = {}): string {
  if (typeof raw !== 'string' || raw.length === 0) return '';
  let s = raw.length > MAX_RAW_INPUT ? raw.slice(0, MAX_RAW_INPUT) : raw;

  s = s.replace(/\r\n?/g, '\n');
  s = s.replace(LONE_SURROGATES, '');
  s = s.replace(CONTROL_CHARS, '');
  s = s.replace(BIDI_CONTROLS, '');
  s = s.replace(INVISIBLE_CHARS, '');
  s = s.replace(/\t/g, opts.multiline ? '    ' : ' ');
  if (!opts.multiline) s = s.replace(/\n+/g, ' ');

  const form = opts.normalize ?? 'NFC';
  if (form) s = s.normalize(form);

  if (opts.allow) {
    const re = new RegExp(opts.allow.source, opts.allow.flags.replace(/[gy]/g, ''));
    let filtered = '';
    for (const ch of s) if (ch === '\n' || re.test(ch)) filtered += ch;
    s = filtered;
  }

  if (opts.maxCodePoints !== undefined) {
    if (opts.maxCodePoints <= 0) return '';
    let count = 0;
    let end = 0;
    for (const ch of s) {
      if (count === opts.maxCodePoints) break;
      count++;
      end += ch.length;
    }
    s = s.slice(0, end);
  }
  return s;
}
