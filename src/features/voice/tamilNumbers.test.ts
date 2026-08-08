import { describe, expect, it } from 'vitest';
import { parseUtterance, scoreProduct } from './tamilNumbers';

describe('parseUtterance', () => {
  it('parses a spoken Tamil quantity, unit and item', () => {
    const parsed = parseUtterance('இரண்டு கிலோ அரிசி');
    expect(parsed.qty).toBe(2);
    expect(parsed.unit).toBe('kg');
    expect(parsed.term).toBe('அரிசி');
  });

  it('handles colloquial Tamil number forms', () => {
    expect(parseUtterance('ரெண்டு கிலோ சர்க்கரை').qty).toBe(2);
    expect(parseUtterance('மூணு பாக்கெட் பால்').qty).toBe(3);
    expect(parseUtterance('அஞ்சு முட்டை').qty).toBe(5);
  });

  it('handles Tamil fractions', () => {
    expect(parseUtterance('அரை கிலோ தக்காளி').qty).toBe(0.5);
    expect(parseUtterance('கால் கிலோ மிளகாய்').qty).toBe(0.25);
  });

  it('handles digits, which is what recognition returns for larger numbers', () => {
    const parsed = parseUtterance('12 முட்டை');
    expect(parsed.qty).toBe(12);
    expect(parsed.term).toBe('முட்டை');
  });

  it('handles English spoken into an English UI', () => {
    const parsed = parseUtterance('two kg rice');
    expect(parsed.qty).toBe(2);
    expect(parsed.unit).toBe('kg');
    expect(parsed.term).toBe('rice');
  });

  it('returns a null quantity when none was said', () => {
    const parsed = parseUtterance('அரிசி');
    expect(parsed.qty).toBeNull();
    expect(parsed.term).toBe('அரிசி');
  });
});

describe('scoreProduct', () => {
  const rice = { nameEn: 'Ponni Rice', nameTa: 'பொன்னி அரிசி' };

  it('scores an exact Tamil name highest', () => {
    expect(scoreProduct(rice, 'பொன்னி அரிசி')).toBe(100);
  });

  it('scores a substring match', () => {
    expect(scoreProduct(rice, 'அரிசி')).toBeGreaterThan(0);
    expect(scoreProduct(rice, 'rice')).toBeGreaterThan(0);
  });

  it('scores an unrelated term at zero', () => {
    expect(scoreProduct(rice, 'சோப்பு')).toBe(0);
  });

  it('scores an empty term at zero', () => {
    expect(scoreProduct(rice, '')).toBe(0);
  });
});
