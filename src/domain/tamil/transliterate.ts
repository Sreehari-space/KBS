/**
 * Phonetic Latin -> Tamil script transliteration ("Tanglish").
 *
 * This is TRANSLITERATION, not translation: it converts sound, not meaning.
 * "arisi" -> "அரிசி" works because the shopkeeper already typed a Tamil word,
 * just in Latin letters. It is the fallback for anything the lexicon does not
 * know — including brand names, which shops routinely write in Tamil script
 * anyway ("Britannia" -> "பிரிட்டானியா").
 *
 * Runs entirely offline. A cloud translation API cannot be on this path: the
 * app has to work at a counter with no signal.
 *
 * Tanglish spelling is ambiguous ("thakkali" could be தக்கலி or தக்காளி), so
 * the lexicon is always consulted first and this only fills the gaps. Output
 * is always editable.
 */

/** Independent vowel, and the combining sign used after a consonant. */
const VOWELS: [latin: string, independent: string, sign: string][] = [
  // Longest first — 'aa' must win over 'a'.
  ['aai', 'ஐ', 'ை'],
  ['aa', 'ஆ', 'ா'],
  ['ai', 'ஐ', 'ை'],
  ['au', 'ஔ', 'ௌ'],
  ['ow', 'ஔ', 'ௌ'],
  ['ee', 'ஈ', 'ீ'],
  ['ii', 'ஈ', 'ீ'],
  ['ea', 'ஈ', 'ீ'],
  ['oo', 'ஊ', 'ூ'],
  ['uu', 'ஊ', 'ூ'],
  ['oa', 'ஓ', 'ோ'],
  ['oe', 'ஓ', 'ோ'],
  ['ae', 'ஏ', 'ே'],
  ['a', 'அ', ''],
  ['i', 'இ', 'ி'],
  ['u', 'உ', 'ு'],
  ['e', 'எ', 'ெ'],
  ['o', 'ஒ', 'ொ'],
];

/** Consonants, longest cluster first. */
const CONSONANTS: [latin: string, tamil: string][] = [
  ['zh', 'ழ'],
  ['ksh', 'க்ஷ'],
  ['sh', 'ஷ'],
  ['ch', 'ச'],
  ['th', 'த'],
  ['dh', 'த'],
  ['ng', 'ங'],
  ['ny', 'ஞ'],
  ['nj', 'ஞ'],
  ['ph', 'ப'],
  ['gh', 'க'],
  ['bh', 'ப'],
  ['kh', 'க'],
  ['ll', 'ள'],
  ['rr', 'ற'],
  ['nn', 'ண'],
  ['k', 'க'],
  ['g', 'க'],
  ['q', 'க'],
  ['s', 'ச'],
  ['j', 'ஜ'],
  ['t', 'ட'],
  ['d', 'ட'],
  ['p', 'ப'],
  ['b', 'ப'],
  ['m', 'ம'],
  ['y', 'ய'],
  ['r', 'ர'],
  ['l', 'ல'],
  ['v', 'வ'],
  ['w', 'வ'],
  ['h', 'ஹ'],
  ['f', 'ஃப'],
  ['n', 'ன'], // word-initial n is handled below
  ['c', 'க'],
  ['x', 'க்ஸ'],
];

const PULLI = '்';

const isLatinLetter = (ch: string) => /[a-z]/i.test(ch);

function matchAt(
  text: string,
  index: number,
  table: [string, ...string[]][],
): [string, ...string[]] | null {
  for (const row of table) {
    if (text.startsWith(row[0], index)) return row;
  }
  return null;
}

/**
 * Transliterate one Latin word into Tamil script.
 * Non-Latin characters (digits, punctuation) pass through unchanged.
 */
export function transliterateWord(word: string): string {
  const src = word.toLowerCase();
  let out = '';
  let i = 0;
  let atWordStart = true;
  // Tracks whether the previous output was a consonant carrying a vowel, so a
  // vowel-after-vowel can take a glide instead of standing on its own.
  let afterSyllable = false;

  while (i < src.length) {
    const ch = src[i]!;

    if (!isLatinLetter(ch)) {
      out += ch;
      i += 1;
      atWordStart = true;
      afterSyllable = false;
      continue;
    }

    const consonant = matchAt(src, i, CONSONANTS);
    if (consonant) {
      const [latin, tamilRaw] = consonant;
      // Tamil starts words with the dental ந, not the alveolar ன.
      const tamil = latin === 'n' && atWordStart ? 'ந' : tamilRaw!;
      const wasWordStart = atWordStart;
      i += latin.length;

      const vowel = matchAt(src, i, VOWELS);
      if (vowel) {
        const [vLatin, , sign] = vowel;
        i += vLatin.length;
        out += tamil + sign;
        afterSyllable = true;
      } else if (wasWordStart) {
        // A word-initial cluster ("br-", "tr-") is written with an inherent
        // short i in Tamil: "Britannia" reads பிரி…, not ப்ரி…
        out += tamil + 'ி';
        afterSyllable = true;
      } else {
        out += tamil + PULLI;
        afterSyllable = false;
      }
      atWordStart = false;
      continue;
    }

    const vowel = matchAt(src, i, VOWELS);
    if (vowel) {
      const [vLatin, independent, sign] = vowel;
      i += vLatin.length;
      if (afterSyllable) {
        // Two vowels in a row take a ய glide, as Tamil spelling requires.
        out += 'ய' + sign;
      } else {
        out += independent;
      }
      atWordStart = false;
      afterSyllable = false;
      continue;
    }

    out += ch;
    i += 1;
    atWordStart = false;
    afterSyllable = false;
  }

  return out;
}

/** Transliterate a phrase, preserving spacing. */
export const transliterate = (text: string): string =>
  text
    .split(/(\s+)/)
    .map((part) => (/\s/.test(part) ? part : transliterateWord(part)))
    .join('');

// ─── Script detection ───────────────────────────────────────────────────────

export type Script = 'tamil' | 'latin' | 'mixed' | 'other';

const TAMIL_RANGE = /[஀-௿]/;
const LATIN_RANGE = /[A-Za-z]/;

export function detectScript(text: string): Script {
  const hasTamil = TAMIL_RANGE.test(text);
  const hasLatin = LATIN_RANGE.test(text);
  if (hasTamil && hasLatin) return 'mixed';
  if (hasTamil) return 'tamil';
  if (hasLatin) return 'latin';
  return 'other';
}
