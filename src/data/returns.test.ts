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
