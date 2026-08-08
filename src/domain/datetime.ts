/**
 * Date and time formatting.
 *
 * The default `toLocaleString()` rendered "8/8/2026, 8:02:58 PM" on printed
 * bills and the day-close screen — an ambiguous date order and seconds no
 * shopkeeper needs. Pinning the locale to India gives an unambiguous
 * day-first format in both languages.
 */

import type { Language } from './types';

const locale = (lang: Language) => (lang === 'ta' ? 'ta-IN' : 'en-IN');

export const formatDateTime = (iso: string, lang: Language): string =>
  new Date(iso).toLocaleString(locale(lang), { dateStyle: 'medium', timeStyle: 'short' });

export const formatDate = (iso: string, lang: Language): string =>
  new Date(iso).toLocaleDateString(locale(lang), { dateStyle: 'medium' });
