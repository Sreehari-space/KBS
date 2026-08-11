/**
 * Minimal i18n. Two languages, no plural rules, no runtime locale loading —
 * so a ~60-line hook does the job that i18next would charge ~40 KB for.
 */

import { createContext, useContext } from 'react';
import { en, type TranslationKey } from './en';
import { ta } from './ta';
import type { Language } from '@/domain/types';

const dictionaries = { en, ta } as const;

export interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
}

export const I18nContext = createContext<I18nContextValue>({
  lang: 'ta',
  setLang: () => {},
});

export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** `t('backup.reminder', { days: 7 })` fills {days} in the string. */
export function translate(
  lang: Language,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const text = dictionaries[lang][key] ?? en[key] ?? key;
  if (!vars) return text;
  return Object.entries(vars).reduce(
    (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
    text,
  );
}

export function useT(): { t: TFunction; lang: Language; setLang: (l: Language) => void } {
  const { lang, setLang } = useContext(I18nContext);
  return {
    t: (key, vars) => translate(lang, key, vars),
    lang,
    setLang,
  };
}

/**
 * Product names carry both scripts. Tamil is preferred when the UI is in
 * Tamil, but an empty nameTa must never render as a blank row on a bill.
 */
export const productName = (p: { nameEn: string; nameTa: string }, lang: Language): string =>
  lang === 'ta' && p.nameTa.trim() ? p.nameTa : p.nameEn;

/** Unit labels are short enough to inline rather than living in the dictionary. */
export const unitLabel = (unit: string, lang: Language): string => {
  const map: Record<string, [string, string]> = {
    piece: ['pc', 'எண்'],
    packet: ['pkt', 'பாக்'],
    kg: ['kg', 'கிலோ'],
    g: ['g', 'கிராம்'],
    litre: ['L', 'லிட்டர்'],
    ml: ['ml', 'மி.லி'],
  };
  const pair = map[unit];
  if (!pair) return unit;
  return lang === 'ta' ? pair[1] : pair[0];
};
