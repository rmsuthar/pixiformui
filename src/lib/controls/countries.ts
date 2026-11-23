/**
 * Country calling codes with national number formats.
 * `pattern`: '#' = digit (display only). `min`/`max`: national significant digits
 * (without the trunk prefix). `trunk`: domestic prefix dropped in international format.
 */
export interface Country {
  iso: string;
  name: string;
  dial: string;
  pattern: string;
  min: number;
  max: number;
  trunk?: string;
}

export const COUNTRIES: Country[] = [
  { iso: 'IN', name: 'India', dial: '91', pattern: '##### #####', min: 10, max: 10, trunk: '0' },
  { iso: 'US', name: 'United States', dial: '1', pattern: '(###) ###-####', min: 10, max: 10 },
  { iso: 'CA', name: 'Canada', dial: '1', pattern: '(###) ###-####', min: 10, max: 10 },
  { iso: 'GB', name: 'United Kingdom', dial: '44', pattern: '#### ######', min: 9, max: 10, trunk: '0' },
  { iso: 'AU', name: 'Australia', dial: '61', pattern: '### ### ###', min: 9, max: 9, trunk: '0' },
  { iso: 'DE', name: 'Germany', dial: '49', pattern: '### ########', min: 6, max: 11, trunk: '0' },
  { iso: 'FR', name: 'France', dial: '33', pattern: '# ## ## ## ##', min: 9, max: 9, trunk: '0' },
  { iso: 'ES', name: 'Spain', dial: '34', pattern: '### ## ## ##', min: 9, max: 9 },
  { iso: 'IT', name: 'Italy', dial: '39', pattern: '### ### ####', min: 6, max: 11 },
  { iso: 'NL', name: 'Netherlands', dial: '31', pattern: '# ########', min: 9, max: 9, trunk: '0' },
  { iso: 'IE', name: 'Ireland', dial: '353', pattern: '## ### ####', min: 7, max: 9, trunk: '0' },
  { iso: 'SE', name: 'Sweden', dial: '46', pattern: '##-### ## ##', min: 7, max: 9, trunk: '0' },
  { iso: 'CH', name: 'Switzerland', dial: '41', pattern: '## ### ## ##', min: 9, max: 9, trunk: '0' },
  { iso: 'TR', name: 'Turkey', dial: '90', pattern: '### ### ## ##', min: 10, max: 10, trunk: '0' },
  { iso: 'RU', name: 'Russia', dial: '7', pattern: '### ###-##-##', min: 10, max: 10, trunk: '8' },
  { iso: 'IL', name: 'Israel', dial: '972', pattern: '##-###-####', min: 8, max: 9, trunk: '0' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971', pattern: '## ### ####', min: 8, max: 9, trunk: '0' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966', pattern: '## ### ####', min: 9, max: 9, trunk: '0' },
  { iso: 'EG', name: 'Egypt', dial: '20', pattern: '### ### ####', min: 10, max: 10, trunk: '0' },
  { iso: 'ZA', name: 'South Africa', dial: '27', pattern: '## ### ####', min: 9, max: 9, trunk: '0' },
  { iso: 'NG', name: 'Nigeria', dial: '234', pattern: '### ### ####', min: 10, max: 10, trunk: '0' },
  { iso: 'KE', name: 'Kenya', dial: '254', pattern: '### ######', min: 9, max: 9, trunk: '0' },
  { iso: 'PK', name: 'Pakistan', dial: '92', pattern: '### #######', min: 10, max: 10, trunk: '0' },
  { iso: 'BD', name: 'Bangladesh', dial: '880', pattern: '####-######', min: 10, max: 10, trunk: '0' },
  { iso: 'LK', name: 'Sri Lanka', dial: '94', pattern: '## ### ####', min: 9, max: 9, trunk: '0' },
  { iso: 'NP', name: 'Nepal', dial: '977', pattern: '###-#######', min: 8, max: 10, trunk: '0' },
  { iso: 'CN', name: 'China', dial: '86', pattern: '### #### ####', min: 11, max: 11, trunk: '0' },
  { iso: 'HK', name: 'Hong Kong', dial: '852', pattern: '#### ####', min: 8, max: 8 },
  { iso: 'JP', name: 'Japan', dial: '81', pattern: '##-####-####', min: 9, max: 10, trunk: '0' },
  { iso: 'KR', name: 'South Korea', dial: '82', pattern: '##-####-####', min: 9, max: 10, trunk: '0' },
  { iso: 'SG', name: 'Singapore', dial: '65', pattern: '#### ####', min: 8, max: 8 },
  { iso: 'MY', name: 'Malaysia', dial: '60', pattern: '##-### ####', min: 9, max: 10, trunk: '0' },
  { iso: 'ID', name: 'Indonesia', dial: '62', pattern: '###-####-####', min: 9, max: 12, trunk: '0' },
  { iso: 'PH', name: 'Philippines', dial: '63', pattern: '### ### ####', min: 10, max: 10, trunk: '0' },
  { iso: 'TH', name: 'Thailand', dial: '66', pattern: '## ### ####', min: 9, max: 9, trunk: '0' },
  { iso: 'VN', name: 'Vietnam', dial: '84', pattern: '### ### ####', min: 9, max: 10, trunk: '0' },
  { iso: 'NZ', name: 'New Zealand', dial: '64', pattern: '## ### ####', min: 8, max: 10, trunk: '0' },
  { iso: 'BR', name: 'Brazil', dial: '55', pattern: '(##) #####-####', min: 10, max: 11 },
  { iso: 'MX', name: 'Mexico', dial: '52', pattern: '## #### ####', min: 10, max: 10 },
  { iso: 'AR', name: 'Argentina', dial: '54', pattern: '## ####-####', min: 10, max: 11, trunk: '0' },
];

/** Regional-indicator flag emoji for an ISO code (falls back to the code where unsupported). */
export function flagEmoji(iso: string): string {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Applies a '#' pattern to digits; extra digits are appended after a space. */
export function formatNational(digits: string, pattern: string): string {
  let out = '';
  let i = 0;
  for (const ch of pattern) {
    if (i >= digits.length) break;
    if (ch === '#') out += digits[i++];
    else out += ch;
  }
  if (i < digits.length) out += (out ? ' ' : '') + digits.slice(i);
  return out.replace(/[\s\-–(]+$/, '');
}
