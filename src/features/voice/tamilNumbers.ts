/**
 * Parsing spoken Tamil quantities. See docs/06 §4.2.
 *
 * "இரண்டு கிலோ அரிசி" -> { qty: 2, unit: 'kg', term: 'அரிசி' }
 *
 * Speech recognition returns Tamil words for small numbers but usually digits
 * for larger ones, so both paths are handled.
 */

export const TAMIL_NUMBERS: Record<string, number> = {
  ஒன்னு: 1, ஒன்று: 1, ஒரு: 1,
  ரெண்டு: 2, இரண்டு: 2,
  மூணு: 3, மூன்று: 3,
  நாலு: 4, நான்கு: 4,
  அஞ்சு: 5, ஐந்து: 5,
  ஆறு: 6,
  ஏழு: 7,
  எட்டு: 8,
  ஒன்பது: 9, ஒம்பது: 9,
  பத்து: 10,
  கால்: 0.25,
  அரை: 0.5,
  முக்கால்: 0.75,
};

const ENGLISH_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, quarter: 0.25,
};

const UNIT_WORDS: { words: string[]; unit: string; multiplier: number }[] = [
  { words: ['கிலோ', 'கிலோகிராம்', 'kilo', 'kg', 'kilogram'], unit: 'kg', multiplier: 1 },
  { words: ['கிராம்', 'gram', 'grams', 'g'], unit: 'g', multiplier: 1 },
  { words: ['லிட்டர்', 'litre', 'liter', 'l'], unit: 'litre', multiplier: 1 },
  { words: ['மில்லி', 'ml', 'millilitre'], unit: 'ml', multiplier: 1 },
  { words: ['பாக்கெட்', 'packet', 'pack'], unit: 'packet', multiplier: 1 },
  { words: ['எண்ணிக்கை', 'piece', 'pieces', 'nos'], unit: 'piece', multiplier: 1 },
];

export interface ParsedUtterance {
  qty: number | null;
  unit: string | null;
  /** What's left over — used to search the catalogue. */
  term: string;
}

export function parseUtterance(transcript: string): ParsedUtterance {
  const cleaned = transcript.trim().toLowerCase();
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  let qty: number | null = null;
  let unit: string | null = null;
  const remaining: string[] = [];

  for (const token of tokens) {
    const asDigits = Number(token.replace(/[^\d.]/g, ''));
    const numeric =
      TAMIL_NUMBERS[token] ??
      ENGLISH_NUMBERS[token] ??
      (Number.isFinite(asDigits) && /\d/.test(token) ? asDigits : undefined);

    if (numeric !== undefined && qty === null) {
      qty = numeric;
      continue;
    }

    const unitMatch = UNIT_WORDS.find((u) => u.words.includes(token));
    if (unitMatch && unit === null) {
      unit = unitMatch.unit;
      continue;
    }

    remaining.push(token);
  }

  return { qty, unit, term: remaining.join(' ').trim() };
}

/**
 * Score a product against the leftover words. Deliberately simple substring
 * matching in both scripts — speech transcripts are noisy, and a fuzzy library
 * would be more confident than the input deserves.
 */
export function scoreProduct(
  product: { nameEn: string; nameTa: string },
  term: string,
): number {
  if (!term) return 0;
  const needle = term.toLowerCase();
  const en = product.nameEn.toLowerCase();
  const ta = product.nameTa;

  if (en === needle || ta === term) return 100;
  if (en.startsWith(needle) || ta.startsWith(term)) return 80;
  if (en.includes(needle) || ta.includes(term)) return 60;

  // Any single word matching is a weak but usable signal.
  const words = needle.split(/\s+/);
  if (words.some((w) => w.length > 2 && (en.includes(w) || ta.includes(w)))) return 30;
  return 0;
}
