import { Key, en } from './en';
import { hi } from './hi';
import { ta } from './ta';
import { te } from './te';

export type Lang = 'en' | 'hi' | 'te' | 'ta';
export type { Key };

export const LANGUAGES: { code: Lang; native: string; english: string }[] = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
];

export const DICTS: Record<Lang, Record<Key, string>> = { en, hi, te, ta };

export type Vars = Record<string, string | number>;

/** Translate a key, filling {placeholders}. Falls back to English if a value is somehow missing. */
export function translate(lang: Lang, key: Key, vars?: Vars): string {
  const raw = DICTS[lang]?.[key] ?? en[key];
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`)) : raw;
}

/** Keys named `<base>.one` / `<base>.other`: picks by count. */
export function translatePlural(lang: Lang, base: string, n: number, vars?: Vars): string {
  return translate(lang, `${base}.${n === 1 ? 'one' : 'other'}` as Key, { n, ...vars });
}

export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'hi' || v === 'te' || v === 'ta';

/** Language name to give the AI coach so it answers in the user's language. */
export const coachLanguageName = (lang: Lang): string | null => (lang === 'en' ? null : LANGUAGES.find((l) => l.code === lang)!.english);
