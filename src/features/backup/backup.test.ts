/**
 * Restore is the one operation with no undo, and it runs on the worst day the
 * shop will ever have. These tests cover what happens on a NEW device, which
 * is the only case that actually matters.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, newId, nowIso } from '@/data/db';
import { commitSale } from '@/data/repositories/saleRepo';
import { buildBackup, countersFromSales, restoreBackup } from './backupService';
import { buildLine, computeTotals } from '@/domain/cart';
import type { Customer, Product, Sale } from '@/domain/types';

const noGst = { enabled: false, pricesIncludeTax: true };

const makeProduct = (): Product => ({
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
});

async function sellOne(product: Product) {
  const lines = [buildLine(product, 1)];
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
    db.settings.clear(),
  ]);
});

describe('countersFromSales', () => {
  it('finds the highest sequence per day and per series', () => {
    const bills = [
      { billNo: '080826-001' },
      { billNo: '080826-014' },
      { billNo: '080826-R002' },
      { billNo: '090826-003' },
    ] as Sale[];

    expect(countersFromSales(bills).sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: 'bill:080826', value: 14 },
      { id: 'bill:090826', value: 3 },
      { id: 'return:080826', value: 2 },
    ]);
  });

  it('ignores anything that is not a bill number', () => {
    expect(countersFromSales([{ billNo: 'nonsense' } as Sale])).toEqual([]);
  });
});

describe('restoring onto a clean device', () => {
  it('never reissues a bill number that already exists', async () => {
    // The defect: counters were not exported and not rebuilt, so the next sale
    // after a restore started again at -001. Two different sales, one number,
    // no error — discovered during a dispute months later.
    const product = makeProduct();
    await db.products.add(product);
    const first = await sellOne(product);
    const second = await sellOne(product);
    const backup = await buildBackup();

    // A new phone: the database has nothing in it.
    await Promise.all([db.sales.clear(), db.products.clear(), db.counters.clear()]);
    await restoreBackup(backup);

    const third = await sellOne(product);
    const numbers = (await db.sales.toArray()).map((s) => s.billNo);

    expect(new Set(numbers).size).toBe(numbers.length);
    expect(third.billNo).not.toBe(first.billNo);
    expect(third.billNo).not.toBe(second.billNo);
    expect(third.billNo).toMatch(/-003$/);
  });

  it('rebuilds sequences from a backup that predates counters', async () => {
    const product = makeProduct();
    await db.products.add(product);
    await sellOne(product);
    await sellOne(product);
    const backup = await buildBackup();

    // A v1 file, taken before counters were ever exported.
    const legacy = { ...backup };
    delete (legacy as { counters?: unknown }).counters;

    await Promise.all([db.sales.clear(), db.counters.clear()]);
    await restoreBackup(legacy);

    const next = await sellOne(product);
    expect(next.billNo).toMatch(/-003$/);
  });

  it('recomputes cached balances from the restored ledger', async () => {
    const customer: Customer = {
      id: newId(),
      name: 'Raja',
      phone: '9876543210',
      balancePaise: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await db.customers.add(customer);
    await db.ledger.add({
      id: newId(),
      customerId: customer.id,
      at: nowIso(),
      type: 'opening_balance',
      amountPaise: 7500,
    });

    const backup = await buildBackup();
    // A file whose cached balance disagrees with its own ledger — a partial
    // write, a hand-edited file, an older bug. Restore should not import the
    // disagreement.
    backup.customers = backup.customers.map((c) => ({ ...c, balancePaise: 999999 }));

    await restoreBackup(backup);

    expect((await db.customers.get(customer.id))!.balancePaise).toBe(7500);
  });

  it('keeps the seed guard so a restore is never overwritten by sample data', async () => {
    const product = makeProduct();
    await db.products.add(product);
    await sellOne(product);
    const backup = await buildBackup();

    await restoreBackup(backup);
    expect((await db.counters.get('seeded:v1'))?.value).toBe(1);
  });
});
