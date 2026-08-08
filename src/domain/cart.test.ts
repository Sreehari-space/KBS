import { describe, expect, it } from 'vitest';
import {
  addToCart,
  assertBalances,
  buildLine,
  changeDue,
  computeTotals,
  creditRemaining,
} from './cart';
import type { Payment, Product, SaleLine } from './types';

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1',
  nameEn: 'Ponni Rice',
  nameTa: 'பொன்னி அரிசி',
  barcodes: [],
  category: 'Rice',
  unit: 'kg',
  sellPricePaise: 5800,
  stockQty: 100,
  lowStockThreshold: 10,
  trackStock: true,
  isQuickTile: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

const noGst = { enabled: false, pricesIncludeTax: true };

describe('buildLine', () => {
  it('snapshots name and price so later edits cannot rewrite history', () => {
    const line = buildLine(product(), 2);
    expect(line.nameTa).toBe('பொன்னி அரிசி');
    expect(line.unitPricePaise).toBe(5800);
    expect(line.lineTotalPaise).toBe(11600);
  });

  it('computes weight lines to whole paise', () => {
    expect(buildLine(product({ sellPricePaise: 4000 }), 2.5).lineTotalPaise).toBe(10000);
  });
});

describe('computeTotals', () => {
  it('sums lines', () => {
    const lines = [buildLine(product(), 5), buildLine(product({ id: 'p2', sellPricePaise: 1400, unit: 'piece' }), 4)];
    const t = computeTotals({ lines, billDiscountPaise: 0, gst: noGst, roundOffEnabled: false });
    expect(t.subtotalPaise).toBe(29000 + 5600);
    expect(t.totalPaise).toBe(34600);
  });

  it('rounds up past 50 paise and lands on a whole rupee', () => {
    // ₹44.53 -> ₹45.00, so the round-off is +47 paise.
    const lines = [buildLine(product({ sellPricePaise: 4453 }), 1)];
    const t = computeTotals({ lines, billDiscountPaise: 0, gst: noGst, roundOffEnabled: true });
    expect(t.roundOffPaise).toBe(47);
    expect(t.totalPaise).toBe(4500);
    expect(t.totalPaise % 100).toBe(0);
  });

  it('rounds down below 50 paise', () => {
    // ₹44.30 -> ₹44.00, so the round-off is -30 paise.
    const lines = [buildLine(product({ sellPricePaise: 4430 }), 1)];
    const t = computeTotals({ lines, billDiscountPaise: 0, gst: noGst, roundOffEnabled: true });
    expect(t.roundOffPaise).toBe(-30);
    expect(t.totalPaise).toBe(4400);
  });

  it('leaves the total untouched when round-off is disabled', () => {
    const lines = [buildLine(product({ sellPricePaise: 4453 }), 1)];
    const t = computeTotals({ lines, billDiscountPaise: 0, gst: noGst, roundOffEnabled: false });
    expect(t.roundOffPaise).toBe(0);
    expect(t.totalPaise).toBe(4453);
  });

  it('clamps a bill discount to the subtotal so the total cannot go negative', () => {
    const lines = [buildLine(product(), 1)];
    const t = computeTotals({
      lines,
      billDiscountPaise: 999999,
      gst: noGst,
      roundOffEnabled: false,
    });
    expect(t.totalPaise).toBe(0);
    expect(t.billDiscountPaise).toBe(5800);
  });

  it('EXTRACTS tax when prices are tax-inclusive (does not add it on top)', () => {
    // ₹118 at 18% inclusive -> taxable ₹100, tax ₹18, total stays ₹118.
    const lines = [buildLine(product({ sellPricePaise: 11800, gstSlab: 18 }), 1)];
    const t = computeTotals({
      lines,
      billDiscountPaise: 0,
      gst: { enabled: true, pricesIncludeTax: true },
      roundOffEnabled: false,
    });
    expect(t.taxPaise).toBe(1800);
    expect(t.totalPaise).toBe(11800);
    expect(t.gst.totalTaxablePaise).toBe(10000);
  });

  it('ADDS tax when prices are tax-exclusive', () => {
    const lines = [buildLine(product({ sellPricePaise: 10000, gstSlab: 18 }), 1)];
    const t = computeTotals({
      lines,
      billDiscountPaise: 0,
      gst: { enabled: false, pricesIncludeTax: false },
      roundOffEnabled: false,
    });
    expect(t.totalPaise).toBe(10000); // GST disabled -> untouched

    const withGst = computeTotals({
      lines,
      billDiscountPaise: 0,
      gst: { enabled: true, pricesIncludeTax: false },
      roundOffEnabled: false,
    });
    expect(withGst.taxPaise).toBe(1800);
    expect(withGst.totalPaise).toBe(11800);
  });

  it('charges no tax at all when GST mode is off (the default)', () => {
    const lines = [buildLine(product({ gstSlab: 18 }), 1)];
    const t = computeTotals({ lines, billDiscountPaise: 0, gst: noGst, roundOffEnabled: false });
    expect(t.taxPaise).toBe(0);
    expect(t.totalPaise).toBe(5800);
  });

  it('handles an empty cart', () => {
    const t = computeTotals({ lines: [], billDiscountPaise: 0, gst: noGst, roundOffEnabled: true });
    expect(t.totalPaise).toBe(0);
    expect(t.roundOffPaise).toBe(0);
  });
});

describe('addToCart', () => {
  it('increments an existing line instead of duplicating it', () => {
    const p = product({ unit: 'piece', sellPricePaise: 1400 });
    let lines: SaleLine[] = [];
    lines = addToCart(lines, p, 1);
    lines = addToCart(lines, p, 1);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.qty).toBe(2);
    expect(lines[0]!.lineTotalPaise).toBe(2800);
  });

  it('keeps different products on separate lines', () => {
    let lines: SaleLine[] = [];
    lines = addToCart(lines, product({ id: 'a' }), 1);
    lines = addToCart(lines, product({ id: 'b' }), 1);
    expect(lines).toHaveLength(2);
  });
});

describe('payment balancing', () => {
  const cash = (paise: number): Payment => ({ mode: 'cash', amountPaise: paise });

  it('reports the unpaid remainder as credit', () => {
    expect(creditRemaining(50000, [cash(30000)])).toBe(20000);
  });

  it('never reports negative credit on overpayment', () => {
    expect(creditRemaining(50000, [cash(60000)])).toBe(0);
  });

  it('computes change due', () => {
    expect(changeDue(45200, 50000)).toBe(4800);
    expect(changeDue(45200, 45200)).toBe(0);
  });

  it('accepts a split payment that covers the total', () => {
    const payments: Payment[] = [cash(30000), { mode: 'upi', amountPaise: 20000 }];
    expect(() => assertBalances(50000, payments, 0)).not.toThrow();
  });

  it('accepts a part-cash part-credit sale', () => {
    expect(() => assertBalances(50000, [cash(30000)], 20000)).not.toThrow();
  });

  it('accepts cash overpayment (the excess is change, not a mismatch)', () => {
    expect(() => assertBalances(45200, [cash(50000)], 0)).not.toThrow();
  });

  it('REJECTS a sale that does not balance', () => {
    expect(() => assertBalances(50000, [cash(30000)], 0)).toThrow(/does not balance/);
    expect(() => assertBalances(50000, [cash(30000)], 5000)).toThrow(/does not balance/);
  });
});
