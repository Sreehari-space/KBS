/**
 * Turn whatever the shopkeeper typed into both an English and a Tamil name.
 *
 * Handles three inputs, decided by looking at the text rather than asking:
 *
 *   "Tomato"     English   -> Tamil from the lexicon
 *   "thakkali"   Tanglish  -> BOTH names from the lexicon
 *   "தக்காளி"     Tamil     -> English from the lexicon
 *
 * Multi-word names are resolved word by word and rejoined, so "ponni rice"
 * becomes "பொன்னி அரிசி" even though that exact phrase is not listed —
 * "ponni" transliterates and "rice" comes from the lexicon.
 *
 * Everything here is offline and synchronous. A cloud translator would fail
 * at a counter with no signal, which is the one place this is used.
 */

import { lookupEnglish, lookupRoman, lookupTamil, romanKey } from './lexicon';
import { detectScript, transliterateWord } from './transliterate';

export interface NameSuggestion {
  nameEn: string;
  nameTa: string;
  /** 'lexicon' = a real translation. 'transliteration' = sound-alike only. */
  source: 'lexicon' | 'transliteration' | 'mixed' | 'none';
  /** Low confidence means the shopkeeper should glance at it before saving. */
  confidence: 'high' | 'low';
}

const EMPTY: NameSuggestion = {
  nameEn: '',
  nameTa: '',
  source: 'none',
  confidence: 'low',
};

const titleCase = (word: string) =>
  word.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1).toLowerCase();

/** Split on whitespace, keeping the original tokens. */
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

/**
 * Numbers, units and sizes ("500ml", "1kg", "70g") should survive untouched
 * rather than being transliterated into nonsense.
 */
const isMeasurement = (word: string) => /^\d+(\.\d+)?\s*[a-z]*$/i.test(word);

export function suggestNames(input: string): NameSuggestion {
  const text = input.trim();
  if (!text) return EMPTY;

  const script = detectScript(text);

  // ── Tamil in, English out ────────────────────────────────────────────────
  if (script === 'tamil') {
    const tokens = words(text);
    let anyHit = false;
    const english = tokens.map((token) => {
      if (isMeasurement(token)) return token;
      const hit = lookupTamil(token);
      if (hit) {
        anyHit = true;
        return hit.en;
      }
      return token; // no reverse transliteration — it would be noise
    });
    const whole = lookupTamil(text);
    if (whole) {
      return { nameEn: whole.en, nameTa: whole.ta, source: 'lexicon', confidence: 'high' };
    }
    return {
      nameEn: anyHit ? english.join(' ') : '',
      nameTa: text,
      source: anyHit ? 'lexicon' : 'none',
      confidence: anyHit ? 'low' : 'low',
    };
  }

  if (script !== 'latin' && script !== 'mixed') return { ...EMPTY, nameEn: text };

  // ── Whole phrase in the lexicon: the best case ───────────────────────────
  const whole = lookupEnglish(text) ?? lookupRoman(text);
  if (whole) {
    return { nameEn: whole.en, nameTa: whole.ta, source: 'lexicon', confidence: 'high' };
  }

  // ── Word by word ─────────────────────────────────────────────────────────
  const tokens = words(text);
  let lexiconHits = 0;
  let transliterated = 0;

  const tamilParts: string[] = [];
  const englishParts: string[] = [];

  for (const token of tokens) {
    if (isMeasurement(token)) {
      tamilParts.push(token);
      englishParts.push(token);
      continue;
    }

    const hit = lookupEnglish(token) ?? lookupRoman(token);
    if (hit) {
      lexiconHits += 1;
      tamilParts.push(hit.ta);
      englishParts.push(hit.en);
      continue;
    }

    // Unknown word: render the sound in Tamil script, keep the Latin spelling
    // as the English name. This is what a shop does with brand names anyway.
    transliterated += 1;
    tamilParts.push(transliterateWord(token));
    englishParts.push(titleCase(token));
  }

  const source =
    lexiconHits > 0 && transliterated > 0
      ? 'mixed'
      : lexiconHits > 0
        ? 'lexicon'
        : 'transliteration';

  return {
    nameEn: englishParts.join(' '),
    nameTa: tamilParts.join(' '),
    source,
    // Only a full lexicon match is trustworthy without a second look.
    confidence: source === 'lexicon' ? 'high' : 'low',
  };
}

/**
 * Was the input Tanglish rather than English?
 *
 * Used to decide whether to also correct the English field: someone typing
 * "thakkali" wants "Tomato" there, but someone typing "Tomato" does not want
 * it rewritten.
 */
export function isTanglish(input: string): boolean {
  const text = input.trim();
  if (!text || detectScript(text) !== 'latin') return false;
  return words(text).some((token) => {
    if (isMeasurement(token)) return false;
    const entry = lookupRoman(token);
    if (!entry) return false;
    // Matched the lexicon, but the token is NOT that entry's English name —
    // so it came in as Tanglish. (lookupEnglish can't be used to decide this:
    // it falls back to the same roman index and would match either way.)
    return romanKey(token) !== romanKey(entry.en);
  });
}
