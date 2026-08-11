import { describe, expect, it } from 'vitest';
import {
  dailySeries,
  dayKey,
  grossMargin,
  hourHistogram,
  paymentMix,
  percentChange,
  periodBounds,
  productTotals,
  summarise,
} from './analytics';
import type { Sale, SaleLine } from '@/domain/types';

const line = (over: Partial<SaleLine> = {}): SaleLine => ({
  productId: 'p1',
  nameEn: 'Rice',
  nameTa: 'அரிசி',
  unit: 'kg',
  qty: 1,
  unitPricePaise: 5000,
  lineDiscountPaise: 0,
  lineTotalPaise: 5000,
  ...over,
});

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: 's1',
  billNo: '010126-001',
  createdAt: '2026-01-01T10:00:00.000Z',
  lines: [line()],
  subtotalPaise: 5000,
  billDiscountPaise: 0,
  taxPaise: 0,
  roundOffPaise: 0,
  totalPaise: 5000,
  payments: [{ mode: 'cash', amountPaise: 5000 }],
  creditPaise: 0,
  status: 'completed',
  ...over,
});

describe('summarise', () => {
  it('is all zeros for no sales, never NaN', () => {
    expect(summarise([])).toEqual({
      billCount: 0,
      revenuePaise: 0,
      creditPaise: 0,
      averagePaise: 0,
    });
  });

  it('averages in whole paise', () => {
    // 10000 over 3 bills is 3333.33… paise, which must not reach the display
    // as a fraction of a paisa.
    const sales = [
      sale({ id: 'a', totalPaise: 3000 }),
      sale({ id: 'b', totalPaise: 3000 }),
      sale({ id: 'c', totalPaise: 4000 }),
    ];
    const result = summarise(sales);
    expect(result.revenuePaise).toBe(10000);
    expect(result.averagePaise).toBe(3333);
    expect(Number.isInteger(result.averagePaise)).toBe(true);
  });

  it('sums credit separately from revenue', () => {
    const sales = [sale({ totalPaise: 5000, creditPaise: 2000 })];
    expect(summarise(sales)).toMatchObject({ revenuePaise: 5000, creditPaise: 2000 });
  });

  it('nets refunds off revenue without counting them as bills', () => {
    // A sale and its return used to read as "Bills: 2", which also halved the
    // average bill. The refund still has to reduce the takings.
    const sales = [
      sale({ id: 'a', totalPaise: 5000 }),
      sale({ id: 'a-return', totalPaise: -2000, returnOfSaleId: 'a' }),
    ];
    expect(summarise(sales)).toMatchObject({
      billCount: 1,
      revenuePaise: 3000,
      averagePaise: 3000,
    });
  });

  it('does not count refunds in the daily bill count either', () => {
    const now = new Date(2026, 0, 10, 12, 0);
    const buckets = dailySeries(
      [
        sale({ id: 'a', createdAt: now.toISOString(), totalPaise: 5000 }),
        sale({ id: 'r', createdAt: now.toISOString(), totalPaise: -2000, returnOfSaleId: 'a' }),
      ],
      7,
      now,
    );
    expect(buckets[6]).toMatchObject({ totalPaise: 3000, billCount: 1 });
  });
});

describe('percentChange', () => {
  it('reports growth and decline', () => {
    expect(percentChange(150, 100)).toBeCloseTo(50);
    expect(percentChange(50, 100)).toBeCloseTo(-50);
  });

  it('refuses to invent a baseline', () => {
    // Growing from nothing is not "infinity percent"; there is simply no
    // comparison to make, and the UI says so instead of printing a number.
    expect(percentChange(1000, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});

describe('dailySeries', () => {
  const now = new Date(2026, 0, 10, 14, 30);

  it('emits one bucket per day including days with no sales', () => {
    const buckets = dailySeries([], 7, now);
    expect(buckets).toHaveLength(7);
    expect(dayKey(buckets[6]!.date)).toBe(dayKey(now));
    expect(buckets.every((b) => b.totalPaise === 0)).toBe(true);
  });

  it('buckets by local calendar day, oldest first', () => {
    const today = new Date(2026, 0, 10, 9, 0);
    const twoDaysAgo = new Date(2026, 0, 8, 21, 0);
    const buckets = dailySeries(
      [
        sale({ id: 'a', createdAt: today.toISOString(), totalPaise: 1000 }),
        sale({ id: 'b', createdAt: today.toISOString(), totalPaise: 500 }),
        sale({ id: 'c', createdAt: twoDaysAgo.toISOString(), totalPaise: 700 }),
      ],
      7,
      now,
    );
    expect(buckets[6]).toMatchObject({ totalPaise: 1500, billCount: 2 });
    expect(buckets[4]).toMatchObject({ totalPaise: 700, billCount: 1 });
  });

  it('ignores sales outside the window', () => {
    const old = new Date(2025, 11, 1, 12, 0);
    const buckets = dailySeries([sale({ createdAt: old.toISOString() })], 7, now);
    expect(buckets.reduce((sum, b) => sum + b.totalPaise, 0)).toBe(0);
  });
});

describe('hourHistogram', () => {
  it('always has 24 slots', () => {
    expect(hourHistogram([])).toHaveLength(24);
  });

  it('sums into the local hour of the sale', () => {
    const evening = new Date(2026, 0, 10, 19, 45);
    const hours = hourHistogram([sale({ createdAt: evening.toISOString(), totalPaise: 2500 })]);
    expect(hours[19]).toBe(2500);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(2500);
  });
});

describe('paymentMix', () => {
  it('splits a split payment and sorts by size', () => {
    const mixed = sale({
      payments: [
        { mode: 'cash', amountPaise: 1000 },
        { mode: 'upi', amountPaise: 4000 },
      ],
    });
    expect(paymentMix([mixed])).toEqual([
      ['upi', 4000],
      ['cash', 1000],
    ]);
  });
});

describe('productTotals', () => {
  it('accumulates quantity and revenue per product, best first', () => {
    const sales = [
      sale({
        id: 'a',
        lines: [
          line({ productId: 'rice', qty: 2, lineTotalPaise: 10000 }),
          line({ productId: 'dal', nameEn: 'Dal', qty: 1, lineTotalPaise: 12000 }),
        ],
      }),
      sale({ id: 'b', lines: [line({ productId: 'rice', qty: 0.5, lineTotalPaise: 2500 })] }),
    ];
    const totals = productTotals(sales);
    // Rice wins on TOTAL revenue across both bills (10000 + 2500), even though
    // dal's single line was the biggest one — which is the whole point of
    // ranking on the accumulated figure rather than the largest line.
    expect(totals[0]).toMatchObject({ productId: 'rice', qty: 2.5, revenuePaise: 12500 });
    expect(totals[1]).toMatchObject({ productId: 'dal', revenuePaise: 12000 });
  });
});

describe('grossMargin', () => {
  it('only counts lines that have a cost price', () => {
    const sales = [
      sale({
        lines: [
          line({ productId: 'rice', qty: 2, lineTotalPaise: 10000 }),
          line({ productId: 'mystery', qty: 1, lineTotalPaise: 4000 }),
        ],
      }),
    ];
    const result = grossMargin(sales, new Map([['rice', 4000]]));
    // 10000 sold − (2 kg × 4000 cost) = 2000 profit on the costed line only.
    expect(result).toEqual({
      profitPaise: 2000,
      costedRevenuePaise: 10000,
      uncostedRevenuePaise: 4000,
    });
  });

  it('rounds fractional-quantity costs to whole paise', () => {
    // 0.333 kg at 999 paise/kg is 332.667 paise of cost.
    const sales = [sale({ lines: [line({ productId: 'x', qty: 0.333, lineTotalPaise: 500 })] })];
    const result = grossMargin(sales, new Map([['x', 999]]));
    expect(result.profitPaise).toBe(500 - 333);
    expect(Number.isInteger(result.profitPaise)).toBe(true);
  });

  it('treats a zero or missing cost as unknown, not as free stock', () => {
    const sales = [sale({ lines: [line({ productId: 'x', lineTotalPaise: 500 })] })];
    expect(grossMargin(sales, new Map([['x', 0]]))).toEqual({
      profitPaise: 0,
      costedRevenuePaise: 0,
      uncostedRevenuePaise: 500,
    });
  });
});

describe('periodBounds', () => {
  it('puts the previous window immediately before the current one', () => {
    const now = new Date(2026, 0, 10, 16, 0);
    const { from, previousFrom } = periodBounds(7, now);
    expect(dayKey(from)).toBe(dayKey(new Date(2026, 0, 4)));
    expect(dayKey(previousFrom)).toBe(dayKey(new Date(2025, 11, 28)));
    // Both windows are exactly `days` long and do not overlap.
    const dayMs = 24 * 60 * 60 * 1000;
    expect(Math.round((from.getTime() - previousFrom.getTime()) / dayMs)).toBe(7);
  });
});
