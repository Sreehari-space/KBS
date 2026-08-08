import { describe, expect, it } from 'vitest';
import { suggestNames, isTanglish } from './suggest';
import { detectScript, transliterateWord } from './transliterate';

describe('detectScript', () => {
  it('tells the three inputs apart', () => {
    expect(detectScript('Tomato')).toBe('latin');
    expect(detectScript('தக்காளி')).toBe('tamil');
    expect(detectScript('Aavin பால்')).toBe('mixed');
    expect(detectScript('500')).toBe('other');
  });
});

describe('transliterateWord', () => {
  it('renders Tanglish sounds in Tamil script', () => {
    expect(transliterateWord('arisi')).toBe('அரிசி');
    expect(transliterateWord('paal')).toBe('பால்');
    expect(transliterateWord('uppu')).toBe('உப்பு');
  });

  it('handles doubled consonants as consonant + pulli + consonant', () => {
    expect(transliterateWord('appalam')).toBe('அப்பளம்'.replace('ள', 'ல'));
  });

  it('starts words with the dental ந, not the alveolar ன', () => {
    expect(transliterateWord('nei').startsWith('ந')).toBe(true);
  });

  it('leaves digits alone', () => {
    expect(transliterateWord('500')).toBe('500');
  });
});

describe('suggestNames — English in', () => {
  it('fills Tamil from the lexicon', () => {
    const s = suggestNames('Tomato');
    expect(s.nameTa).toBe('தக்காளி');
    expect(s.nameEn).toBe('Tomato');
    expect(s.confidence).toBe('high');
  });

  it('handles multi-word names the lexicon knows', () => {
    expect(suggestNames('Chilli Powder').nameTa).toBe('மிளகாய் தூள்');
  });

  it('matches a listed multi-word phrase even when typed loosely', () => {
    const s = suggestNames('ponni rice');
    expect(s.nameTa).toBe('பொன்னி அரிசி');
    expect(s.source).toBe('lexicon');
  });

  it('resolves word by word when the phrase is not listed', () => {
    // "Aachi" is a brand and not in the lexicon; "rice" is.
    const s = suggestNames('Aachi rice');
    expect(s.nameTa).toContain('அரிசி');
    expect(s.source).toBe('mixed');
  });

  it('keeps sizes and units intact', () => {
    const s = suggestNames('Milk 500ml');
    expect(s.nameTa).toBe('பால் 500ml');
  });
});

describe('suggestNames — Tanglish in', () => {
  it('fills BOTH names from a Tanglish word', () => {
    const s = suggestNames('thakkali');
    expect(s.nameEn).toBe('Tomato');
    expect(s.nameTa).toBe('தக்காளி');
    expect(s.confidence).toBe('high');
  });

  it('tolerates spelling variation', () => {
    // Doubled letters and vowel length differ between typists.
    expect(suggestNames('takkali').nameTa).toBe('தக்காளி');
    expect(suggestNames('thakkaali').nameTa).toBe('தக்காளி');
    expect(suggestNames('sarkarai').nameEn).toBe('Sugar');
    expect(suggestNames('chakkarai').nameEn).toBe('Sugar');
  });

  it('handles common Tanglish staples', () => {
    expect(suggestNames('arisi').nameEn).toBe('Rice');
    expect(suggestNames('paruppu').nameTa).toBe('பருப்பு');
    expect(suggestNames('vengayam').nameEn).toBe('Onion');
    expect(suggestNames('ennai').nameTa).toBe('எண்ணெய்');
    expect(suggestNames('muttai').nameEn).toBe('Egg');
  });

  it('transliterates an unknown word rather than giving up', () => {
    const s = suggestNames('Britannia');
    expect(s.nameTa.length).toBeGreaterThan(0);
    expect(detectScript(s.nameTa)).toBe('tamil');
    // Sound-alike only, so the shopkeeper should glance at it.
    expect(s.confidence).toBe('low');
  });
});

describe('suggestNames — Tamil in', () => {
  it('fills English from a Tamil name', () => {
    const s = suggestNames('தக்காளி');
    expect(s.nameEn).toBe('Tomato');
    expect(s.nameTa).toBe('தக்காளி');
  });

  it('keeps the Tamil untouched when it is not in the lexicon', () => {
    const s = suggestNames('விநாயகர் மிக்சர்');
    expect(s.nameTa).toBe('விநாயகர் மிக்சர்');
  });
});

describe('isTanglish', () => {
  it('spots Tanglish so the English field can be corrected', () => {
    expect(isTanglish('thakkali')).toBe(true);
    expect(isTanglish('vengayam')).toBe(true);
  });

  it('does not treat plain English as Tanglish', () => {
    // Typing "Tomato" must not get the English field rewritten.
    expect(isTanglish('Tomato')).toBe(false);
    expect(isTanglish('Britannia')).toBe(false);
  });

  it('is false for Tamil script and for empty input', () => {
    expect(isTanglish('தக்காளி')).toBe(false);
    expect(isTanglish('')).toBe(false);
  });
});

describe('empty input', () => {
  it('suggests nothing', () => {
    expect(suggestNames('').nameTa).toBe('');
    expect(suggestNames('   ').source).toBe('none');
  });
});
