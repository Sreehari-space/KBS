/**
 * Tests for the commit protocol (docs/07-autosave-durability.md).
 *
 * These cover acceptance criteria 5, 6, 7 and 8: nothing partial is ever
 * written, the cart survives a failure, and two fast taps cannot duplicate a
 * bill number.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, newId, nowIso } from './db';
import { commitSale, SaleCommitError, ACTIVE_DRAFT_ID, saveDraft } from './repositories/saleRepo';
import { buildLine, computeTotals } from '@/domain/cart';
import type { Customer, Product, SaleLine } from '@/domain/types';

const noGst = { enabled: false, pricesIncludeTax: true };

function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: newId(),
    nameEn: 'Ponni Rice',
    nameTa: 'பொன்னி அரிசி',
    barcodes: ['8901058000023'],
    category: 'Rice',
    unit: 'kg',
    sellPricePaise: 5800,
    stockQty: 100,
    lowStockThreshold: 10,
    trackStock: true,
    isQuickTile: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...over,
  };
}

function makeCustomer(over: Partial<Customer> = {}): Customer {
  return {
    id: newId(),
    name: 'Raja',
    phone: '9876543210',
    balancePaise: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...over,
  };
}

function totalsFor(lines: SaleLine[]) {
  const t = computeTotals({
    lines,
    billDiscountPaise: 0,
    gst: noGst,
    roundOffEnabled: true,
  });
  return {
    lines,
    subtotalPaise: t.subtotalPaise,
    billDiscountPaise: t.billDiscountPaise,
    taxPaise: t.taxPaise,
    roundOffPaise: t.roundOffPaise,
    totalPaise: t.totalPaise,
  };
}

beforeEach(async () => {
  // Fresh tables between tests. (The app itself never clears data — this is
  // test setup only.)
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

describe('commitSale — the happy path', () => {
  it('writes the sale, decrements stock and clears the draft together', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const lines = [buildLine(product, 5)];
    await saveDraft({ id: ACTIVE_DRAFT_ID, kind: 'active', lines, billDiscountPaise: 0 });

    const sale = await commitSale({
      ...totalsFor(lines),
      payments: [{ mode: 'cash', amountPaise: 29000 }],
      creditPaise: 0,
    });

    expect(sale.billNo).toMatch(/^\d{6}-001$/);
    expect(await db.sales.count()).toBe(1);
    expect((await db.products.get(product.id))!.stockQty).toBe(95);
    // The draft is cleared only after the sale is safely on disk.
    expect(await db.drafts.get(ACTIVE_DRAFT_ID)).toBeUndefined();
  });

  it('does not touch stock for products that do not track it', async () => {
    const loose = makeProduct({ trackStock: false, stockQty: 0 });
    await db.products.add(loose);
    const lines = [buildLine(loose, 3)];

    await commitSale({
      ...totalsFor(lines),
      payments: [{ mode: 'cash', amountPaise: totalsFor(lines).totalPaise }],
      creditPaise: 0,
    });

    expect((await db.products.get(loose.id))!.stockQty).toBe(0);
  });

  it('records split payments', async () => {
    const product = makeProduct({ sellPricePaise: 50000, unit: 'piece' });
    await db.products.add(product);
    const lines = [buildLine(product, 1)];

    const sale = await commitSale({
      ...totalsFor(lines),
      payments: [
        { mode: 'cash', amountPaise: 30000 },
        { mode: 'upi', amountPaise: 20000 },
      ],
      creditPaise: 0,
    });

    expect(sale.payments).toHaveLength(2);
    expect(await db.sales.count()).toBe(1);
  });
});

describe('commitSale — credit sales', () => {
  it('creates the ledger entry and updates the balance in the same transaction', async () => {
    const product = makeProduct({ sellPricePaise: 50000, unit: 'piece' });
    const customer = makeCustomer();
    await db.products.add(product);
    await db.customers.add(customer);
    const lines = [buildLine(product, 1)];

    const sale = await commitSale({
      ...totalsFor(lines),
      payments: [{ mode: 'cash', amountPaise: 30000 }],
      creditPaise: 20000,
      customerId: customer.id,
    });

    const entries = await db.ledger.where('customerId').equals(customer.id).toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.amountPaise).toBe(20000);
    expect(entries[0]!.saleId).toBe(sale.id);
    expect((await db.customers.get(customer.id))!.balancePaise).toBe(20000);
  });

  it('REFUSES a credit sale with no customer, and writes nothing', async () => {
    const product = makeProduct({ sellPricePaise: 50000, unit: 'piece' });
    await db.products.add(product);
    const lines = [buildLine(product, 1)];

    await expect(
      commitSale({
        ...totalsFor(lines),
        payments: [],
        creditPaise: 50000,
      }),
    ).rejects.toThrow(SaleCommitError);

    expect(await db.sales.count()).toBe(0);
    expect(await db.ledger.count()).toBe(0);
    expect((await db.products.get(product.id))!.stockQty).toBe(100);
  });

  it('rolls back everything when the customer does not exist', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const lines = [buildLine(product, 5)];

    await expect(
      commitSale({
        ...totalsFor(lines),
        payments: [],
        creditPaise: totalsFor(lines).totalPaise,
        customerId: 'ghost-customer',
      }),
    ).rejects.toThrow(SaleCommitError);

    // Acceptance test 8: no partial sale — stock must NOT have moved.
    expect(await db.sales.count()).toBe(0);
    expect(await db.ledger.count()).toBe(0);
    expect((await db.products.get(product.id))!.stockQty).toBe(100);
  });
});

describe('commitSale — refusals leave no trace', () => {
  it('rejects an empty cart', async () => {
    await expect(
      commitSale({
        lines: [],
        subtotalPaise: 0,
        billDiscountPaise: 0,
        taxPaise: 0,
        roundOffPaise: 0,
        totalPaise: 0,
        payments: [],
        creditPaise: 0,
      }),
    ).rejects.toThrow(/empty cart/i);
    expect(await db.sales.count()).toBe(0);
  });

  it('rejects a sale that does not balance and keeps the cart intact', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const lines = [buildLine(product, 5)];
    await saveDraft({ id: ACTIVE_DRAFT_ID, kind: 'active', lines, billDiscountPaise: 0 });

    await expect(
      commitSale({
        ...totalsFor(lines),
        payments: [{ mode: 'cash', amountPaise: 100 }], // nowhere near the total
        creditPaise: 0,
      }),
    ).rejects.toThrow(/does not balance/);

    expect(await db.sales.count()).toBe(0);
    // Acceptance test 5: the cart survives a failed commit so it can be retried.
    expect(await db.drafts.get(ACTIVE_DRAFT_ID)).toBeDefined();
  });
});

describe('bill numbering', () => {
  it('allocates sequential numbers within a day', async () => {
    const product = makeProduct({ unit: 'piece', sellPricePaise: 1000 });
    await db.products.add(product);
    const lines = [buildLine(product, 1)];
    const input = {
      ...totalsFor(lines),
      payments: [{ mode: 'cash' as const, amountPaise: 1000 }],
      creditPaise: 0,
    };

    const a = await commitSale(input);
    const b = await commitSale(input);
    const c = await commitSale(input);

    expect(a.billNo.endsWith('-001')).toBe(true);
    expect(b.billNo.endsWith('-002')).toBe(true);
    expect(c.billNo.endsWith('-003')).toBe(true);
  });

  it('never issues a duplicate number under concurrent commits', async () => {
    // Acceptance test 6: two fast taps produce distinct bills, not a collision.
    const product = makeProduct({ unit: 'piece', sellPricePaise: 1000, stockQty: 100 });
    await db.products.add(product);
    const lines = [buildLine(product, 1)];
    const input = {
      ...totalsFor(lines),
      payments: [{ mode: 'cash' as const, amountPaise: 1000 }],
      creditPaise: 0,
    };

    const sales = await Promise.all(Array.from({ length: 10 }, () => commitSale(input)));
    const numbers = sales.map((s) => s.billNo);

    expect(new Set(numbers).size).toBe(10);
    expect(await db.sales.count()).toBe(10);
    expect((await db.products.get(product.id))!.stockQty).toBe(90);
  });
});

describe('draft auto-save', () => {
  it('round-trips an in-progress cart', async () => {
    const product = makeProduct();
    await db.products.add(product);
    const lines = [buildLine(product, 2.5)];

    await saveDraft({ id: ACTIVE_DRAFT_ID, kind: 'active', lines, billDiscountPaise: 0 });

    // Simulates Android killing the tab and the app reopening.
    const restored = await db.drafts.get(ACTIVE_DRAFT_ID);
    expect(restored?.lines).toHaveLength(1);
    expect(restored?.lines[0]!.qty).toBe(2.5);
    expect(restored?.lines[0]!.nameTa).toBe('பொன்னி அரிசி');
  });

  it('overwrites rather than accumulating drafts', async () => {
    const product = makeProduct();
    await saveDraft({
      id: ACTIVE_DRAFT_ID,
      kind: 'active',
      lines: [buildLine(product, 1)],
      billDiscountPaise: 0,
    });
    await saveDraft({
      id: ACTIVE_DRAFT_ID,
      kind: 'active',
      lines: [buildLine(product, 2)],
      billDiscountPaise: 0,
    });

    expect(await db.drafts.count()).toBe(1);
    expect((await db.drafts.get(ACTIVE_DRAFT_ID))!.lines[0]!.qty).toBe(2);
  });
});
