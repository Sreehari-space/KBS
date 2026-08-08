import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatINR,
  formatQty,
  lineAmount,
  parseRupeeInput,
  percentOf,
  roundOffDelta,
  rupeesToPaise,
  sumPaise,
} from './money';

describe('rupeesToPaise', () => {
  it('converts without float drift', () => {
    expect(rupeesToPaise(0.1)).toBe(10);
    expect(rupeesToPaise(58)).toBe(5800);
    expect(rupeesToPaise(3.49)).toBe(349);
  });

  it('always yields an integer, even on float-unrepresentable input', () => {
    // 1.005 is stored as 1.00499999... so this lands on 100, not 101. That is
    // acceptable: rupee input is captured to 2 decimals, so a half-paise value
    // never reaches this function. What matters is that the result is an
    // integer and never drifts.
    expect(rupeesToPaise(1.005)).toBe(100);
    expect(Number.isInteger(rupeesToPaise(1.005))).toBe(true);
    expect(Number.isInteger(rupeesToPaise(19.99))).toBe(true);
  });

  it('survives the case that broke the old float code', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in floats.
    const total = sumPaise([rupeesToPaise(0.1), rupeesToPaise(0.2)]);
    expect(total).toBe(30);
  });
});

describe('parseRupeeInput', () => {
  it('accepts plain and decorated numbers', () => {
    expect(parseRupeeInput('45')).toBe(4500);
    expect(parseRupeeInput('45.50')).toBe(4550);
    expect(parseRupeeInput('₹1,234.5')).toBe(123450);
    expect(parseRupeeInput('  60 ')).toBe(6000);
  });

  it('distinguishes empty from zero', () => {
    expect(parseRupeeInput('')).toBeNull();
    expect(parseRupeeInput('.')).toBeNull();
    expect(parseRupeeInput('0')).toBe(0);
  });

  it('rejects junk rather than coercing it', () => {
    expect(parseRupeeInput('abc')).toBeNull();
    expect(parseRupeeInput('12.3.4')).toBeNull();
  });
});

describe('formatINR', () => {
  it('uses Indian lakh grouping', () => {
    // ₹1,25,000.50 — the point of this test is that it is NOT "125,000.50".
    expect(formatINR(12500050)).toContain('1,25,000.50');
    expect(formatINR(100000)).toContain('1,000.00');
    // A crore groups as 1,00,00,000 rather than 10,000,000.
    expect(formatINR(100000000000)).toContain('1,00,00,00,000');
  });

  it('formats plain amounts for bill columns', () => {
    expect(formatAmount(44540)).toBe('445.40');
    expect(formatAmount(0)).toBe('0.00');
  });
});

describe('roundOffDelta', () => {
  it('rounds down below 50 paise', () => {
    expect(roundOffDelta(44540)).toBe(-40); // 445.40 -> 445.00
    expect(roundOffDelta(44510)).toBe(-10);
  });

  it('rounds up at or above 50 paise', () => {
    expect(roundOffDelta(44580)).toBe(20); // 445.80 -> 446.00
    expect(roundOffDelta(44550)).toBe(50); // .50 goes up, matching shop practice
  });

  it('is a no-op on whole rupees', () => {
    expect(roundOffDelta(44500)).toBe(0);
  });

  it('always lands on a whole rupee', () => {
    for (let p = 40000; p < 40100; p++) {
      expect((p + roundOffDelta(p)) % 100).toBe(0);
    }
  });
});

describe('lineAmount', () => {
  it('handles whole quantities', () => {
    expect(lineAmount(4, 1400)).toBe(5600);
  });

  it('handles weight quantities without fractional paise', () => {
    expect(lineAmount(2.5, 4000)).toBe(10000); // 2.5 kg @ ₹40 = ₹100
    expect(lineAmount(0.25, 5800)).toBe(1450); // 250 g @ ₹58/kg = ₹14.50
    // 0.333 kg @ ₹58/kg = ₹19.314 -> must round to whole paise
    expect(lineAmount(0.333, 5800)).toBe(1931);
    expect(Number.isInteger(lineAmount(0.333, 5800))).toBe(true);
  });
});

describe('percentOf', () => {
  it('rounds to whole paise', () => {
    expect(percentOf(10000, 5)).toBe(500);
    expect(percentOf(3333, 18)).toBe(600);
  });
});

describe('formatQty', () => {
  it('drops trailing zeros but keeps real decimals', () => {
    expect(formatQty(3)).toBe('3');
    expect(formatQty(2.5)).toBe('2.5');
    expect(formatQty(0.25)).toBe('0.25');
    expect(formatQty(0.3330001)).toBe('0.333');
  });
});
