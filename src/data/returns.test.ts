/**
 * Returns must never mutate the original bill (doc 07 — sales are immutable),
 * and must put stock back exactly once.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, newId, nowIso } from './db';
import { commitSale } from './repositories/saleRepo';
import { commitReturn, ReturnError } from './repositories/returnRepo';
import { buildLine, computeTotals } from '@/domain/cart';
import type { Customer, Product } from '@/domain/types';

const noGst = { enabled: false, pricesIncludeTax: true };

const makeProduct = (over: Partial<Product> = {}): Product => ({
  id: newId(),
  nameEn: 'Biscuit',
  nameTa: 'பிஸ்கட்',
  barcodes: [],
  category: 'Packaged',
  unit: 'piece',
  sellPricePaise: 1000,
  stockQty: 100,
  lowStockThreshold: 5,
  trackStock: true,
  isQuickTile: false,
  createdAt: nowIso(),
  updatedAt: nowIso(),
  ...over,
});

async function sellFive(product: Product) {
  const lines = [buildLine(product, 5)];
  const t = computeTotals({ lines, billDiscountPaise: 0, gst: noGst, roundOffEnabled: true });
  return commitSale({
    lines,
    subtotalPaise: t.subtotalPaise,
    billDiscountPaise: t.billDiscountPaise,
    taxPaise: t.taxPaise,
    roundOffPaise: t.roundOffPaise,
    totalPaise: t.totalPaise,
    payments: [{ mode: 'cash', amountPaise: t.totalPaise }],
    creditPaise: 0,
  });
}

beforeEach(async () => {
  await db.open();
  await Promise.all([
    db.sales.clear(),
    db.products.clear(),
    db.customers.clear(),
    db.ledger.clear(),
    db.counters.clear(),
    db.drafts.clear(),
  ]);
});

describe('commitReturn', () => {
  it('creates a negative bill and puts stock back', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const sale = await sellFive(product);
    expect((await db.products.get(product.id))!.stockQty).toBe(95);

    const returned = await commitReturn({
      saleId: sale.id,
      quantities: new Map([[0, 2]]),
      refundMode: 'cash',
    });

    expect(returned.totalPaise).toBe(-2000);
    expect(returned.lines[0]!.qty).toBe(-2);
    expect(returned.returnOfSaleId).toBe(sale.id);
    expect((await db.products.get(product.id))!.stockQty).toBe(97);
  });

  it('leaves the ORIGINAL bill amounts untouched', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const sale = await sellFive(product);

    await commitReturn({ saleId: sale.id, quantities: new Map([[0, 2]]), refundMode: 'cash' });

    const original = await db.sales.get(sale.id);
    // The printed bill in the customer's hand must still match.
    expect(original!.totalPaise).toBe(5000);
    expect(original!.lines[0]!.qty).toBe(5);
    expect(original!.status).toBe('partially_returned');
  });

  it('marks the bill fully returned when every item comes back', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const sale = await sellFive(product);

    await commitReturn({ saleId: sale.id, quantities: new Map([[0, 5]]), refundMode: 'cash' });

    expect((await db.sales.get(sale.id))!.status).toBe('returned');
    expect((await db.products.get(product.id))!.stockQty).toBe(100);
  });

  it('refuses to return more than was sold, and changes nothing', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const sale = await sellFive(product);

    await expect(
      commitReturn({ saleId: sale.id, quantities: new Map([[0, 9]]), refundMode: 'cash' }),
    ).rejects.toThrow(ReturnError);

    expect((await db.products.get(product.id))!.stockQty).toBe(95);
    expect(await db.sales.count()).toBe(1);
  });

  it('refuses an empty return', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const sale = await sellFive(product);

    await expect(
      commitReturn({ saleId: sale.id, quantities: new Map(), refundMode: 'cash' }),
    ).rejects.toThrow(ReturnError);
  });

  it('reduces the customer balance when refunding to credit', async () => {
    const product = makeProduct();
    const customer: Customer = {
      id: newId(),
      name: 'Raja',
      phone: '9876543210',
      balancePaise: 5000,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await db.products.add(product);
    await db.customers.add(customer);

    const lines = [buildLine(product, 5)];
    const t = computeTotals({ lines, billDiscountPaise: 0, gst: noGst, roundOffEnabled: true });
    const sale = await commitSale({
      lines,
      subtotalPaise: t.subtotalPaise,
      billDiscountPaise: t.billDiscountPaise,
      taxPaise: t.taxPaise,
      roundOffPaise: t.roundOffPaise,
      totalPaise: t.totalPaise,
      payments: [],
      creditPaise: t.totalPaise,
      customerId: customer.id,
    });

    expect((await db.customers.get(customer.id))!.balancePaise).toBe(10000);

    await commitReturn({ saleId: sale.id, quantities: new Map([[0, 2]]), refundMode: 'credit' });

    expect((await db.customers.get(customer.id))!.balancePaise).toBe(8000);
    // The correction is a new append-only row, not an edit.
    const adjustments = (await db.ledger.toArray()).filter((e) => e.type === 'adjustment');
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]!.amountPaise).toBe(-2000);
  });

  it('refuses to return the same bill twice', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const sale = await sellFive(product);
    await commitReturn({ saleId: sale.id, quantities: new Map([[0, 5]]), refundMode: 'cash' });

    await expect(
      commitReturn({ saleId: sale.id, quantities: new Map([[0, 1]]), refundMode: 'cash' }),
    ).rejects.toThrow(/already returned/);
  });
});

describe('repeat partial returns', () => {
  it('never refunds more than the bill was worth', async () => {
    // The defect: quantities were checked against the ORIGINAL line quantity,
    // not against what was still un-returned. Returning 2 of 5 and then 5 of 5
    // refunded ₹70 on a ₹50 sale and invented two units of stock.
    const product = makeProduct();
    await db.products.add(product);
    const sale = await sellFive(product); // ₹50.00, stock 100 -> 95

    await commitReturn({ saleId: sale.id, quantities: new Map([[0, 2]]), refundMode: 'cash' });
    await expect(
      commitReturn({ saleId: sale.id, quantities: new Map([[0, 5]]), refundMode: 'cash' }),
    ).rejects.toThrow(ReturnError);

    const refunded = (await db.sales.toArray())
      .filter((s) => s.returnOfSaleId === sale.id)
      .reduce((sum, s) => sum + -s.totalPaise, 0);
    expect(refunded).toBe(2000);
    expect(refunded).toBeLessThanOrEqual(sale.totalPaise);
    // Stock cannot exceed what the shop started with either.
    expect((await db.products.get(product.id))!.stockQty).toBe(97);
  });

  it('allows the rest to come back, and only the rest', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const sale = await sellFive(product);

    await commitReturn({ saleId: sale.id, quantities: new Map([[0, 2]]), refundMode: 'cash' });
    await commitReturn({ saleId: sale.id, quantities: new Map([[0, 3]]), refundMode: 'cash' });

    const refunded = (await db.sales.toArray())
      .filter((s) => s.returnOfSaleId === sale.id)
      .reduce((sum, s) => sum + -s.totalPaise, 0);
    expect(refunded).toBe(5000);
    expect((await db.products.get(product.id))!.stockQty).toBe(100);
    // Cumulatively complete, so the bill closes. The old code only looked at
    // the request in front of it and left this 'partially_returned' forever,
    // which is what allowed a third return.
    expect((await db.sales.get(sale.id))!.status).toBe('returned');

    await expect(
      commitReturn({ saleId: sale.id, quantities: new Map([[0, 1]]), refundMode: 'cash' }),
    ).rejects.toThrow(ReturnError);
  });

  it('refuses to return a return', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const sale = await sellFive(product);
    const ret = await commitReturn({
      saleId: sale.id,
      quantities: new Map([[0, 2]]),
      refundMode: 'cash',
    });

    await expect(
      commitReturn({ saleId: ret.id, quantities: new Map([[0, 1]]), refundMode: 'cash' }),
    ).rejects.toThrow(ReturnError);
  });

  it('numbers returns in their own daily series', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const sale = await sellFive(product);
    const ret = await commitReturn({
      saleId: sale.id,
      quantities: new Map([[0, 1]]),
      refundMode: 'cash',
    });
    const next = await sellFive(product);

    // Returns used to consume the sale sequence, leaving gaps (001, 002R, 003)
    // in the series a shopkeeper reconciles by hand.
    expect(sale.billNo).toMatch(/-001$/);
    expect(ret.billNo).toMatch(/-R001$/);
    expect(next.billNo).toMatch(/-002$/);
  });
});

describe('refunds follow what was actually charged', () => {
  it('refunds the discounted amount, not the raw line total', async () => {
    const product = makeProduct();
    await db.products.add(product);
    // ₹50.00 of goods sold for ₹40.00 after a bill-level discount.
    const sale = await commitSale({
      lines: [buildLine(product, 5)],
      subtotalPaise: 5000,
      billDiscountPaise: 1000,
      taxPaise: 0,
      roundOffPaise: 0,
      totalPaise: 4000,
      payments: [{ mode: 'cash', amountPaise: 4000 }],
      creditPaise: 0,
    });

    const ret = await commitReturn({
      saleId: sale.id,
      quantities: new Map([[0, 5]]),
      refundMode: 'cash',
    });

    // Summing line totals handed back ₹50 for a ₹40 sale.
    expect(-ret.totalPaise).toBe(4000);
  });

  it('brings back a proportional share of the GST', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const sale = await commitSale({
      lines: [buildLine(product, 5)],
      subtotalPaise: 5000,
      billDiscountPaise: 0,
      taxPaise: 250,
      roundOffPaise: 0,
      totalPaise: 5000,
      payments: [{ mode: 'cash', amountPaise: 5000 }],
      creditPaise: 0,
    });

    const ret = await commitReturn({
      saleId: sale.id,
      quantities: new Map([[0, 2]]),
      refundMode: 'cash',
    });

    // Two of five units came back, so two fifths of the tax does too. It used
    // to be dropped entirely, which under-reports the adjustment.
    expect(ret.taxPaise).toBe(-100);
    expect(-ret.totalPaise).toBe(2000);
  });

  it('takes the refund off the account before it opens the cash drawer', async () => {
    const product = makeProduct();
    const customer: Customer = {
      id: newId(),
      name: 'Selvi',
      phone: '9876500000',
      balancePaise: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await db.products.add(product);
    await db.customers.add(customer);

    const sale = await commitSale({
      lines: [buildLine(product, 5)],
      subtotalPaise: 5000,
      billDiscountPaise: 0,
      taxPaise: 0,
      roundOffPaise: 0,
      totalPaise: 5000,
      payments: [],
      creditPaise: 5000,
      customerId: customer.id,
    });
    expect((await db.customers.get(customer.id))!.balancePaise).toBe(5000);

    // The shopkeeper picks "cash" — but this bill was never paid, so handing
    // over cash would give away money that never arrived AND leave the debt.
    const ret = await commitReturn({
      saleId: sale.id,
      quantities: new Map([[0, 2]]),
      refundMode: 'cash',
    });

    expect((await db.customers.get(customer.id))!.balancePaise).toBe(3000);
    expect(ret.payments).toEqual([]);
    expect(-ret.totalPaise).toBe(2000);
  });

  it('pays out cash only for the part that was actually paid', async () => {
    const product = makeProduct();
    const customer: Customer = {
      id: newId(),
      name: 'Kumar',
      phone: '9876511111',
      balancePaise: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await db.products.add(product);
    await db.customers.add(customer);

    // ₹50 bill: ₹30 cash, ₹20 on the book.
    const sale = await commitSale({
      lines: [buildLine(product, 5)],
      subtotalPaise: 5000,
      billDiscountPaise: 0,
      taxPaise: 0,
      roundOffPaise: 0,
      totalPaise: 5000,
      payments: [{ mode: 'cash', amountPaise: 3000 }],
      creditPaise: 2000,
      customerId: customer.id,
    });

    // Everything comes back: ₹20 clears the debt, ₹30 is handed over.
    const ret = await commitReturn({
      saleId: sale.id,
      quantities: new Map([[0, 5]]),
      refundMode: 'cash',
    });

    expect((await db.customers.get(customer.id))!.balancePaise).toBe(0);
    expect(ret.payments).toEqual([{ mode: 'cash', amountPaise: -3000 }]);
    expect(-ret.totalPaise).toBe(5000);
  });
});
