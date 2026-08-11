/**
 * Credit ledger (கடன்). See docs/05-ledger-tamil-dayclose.md.
 *
 * The ledger is APPEND-ONLY. Corrections are new 'adjustment' rows, never
 * edits — if a customer disputes a balance the shop must be able to walk the
 * history with them. Customer.balancePaise is only a cache of the sum.
 */

import { db, newId, nowIso } from '../db';
import type { Customer, Id, LedgerEntry, PaymentMode } from '@/domain/types';

export function entriesForCustomer(customerId: Id): Promise<LedgerEntry[]> {
  return db.ledger.where('customerId').equals(customerId).reverse().sortBy('at');
}

export async function balanceFor(customerId: Id): Promise<number> {
  const entries = await db.ledger.where('customerId').equals(customerId).toArray();
  return entries.reduce((sum, e) => sum + e.amountPaise, 0);
}

/** Customers who owe money, largest balance first. */
export async function outstandingCustomers(): Promise<Customer[]> {
  const all = await db.customers.toArray();
  return all
    .filter((c) => !c.deletedAt && c.balancePaise > 0)
    .sort((a, b) => b.balancePaise - a.balancePaise);
}

export async function totalOutstanding(): Promise<number> {
  const customers = await outstandingCustomers();
  return customers.reduce((sum, c) => sum + c.balancePaise, 0);
}

/**
 * Record a payment against a customer's balance.
 * Entry and balance update land together or not at all.
 */
export async function recordPayment(
  customerId: Id,
  amountPaise: number,
  mode: PaymentMode,
  note?: string,
): Promise<LedgerEntry> {
  if (amountPaise <= 0) throw new Error('Payment must be positive');

  return db.transaction('rw', [db.ledger, db.customers], async () => {
    const customer = await db.customers.get(customerId);
    if (!customer) throw new Error('Customer not found');

    const entry: LedgerEntry = {
      id: newId(),
      customerId,
      at: nowIso(),
      type: 'payment',
      amountPaise: -amountPaise, // negative: reduces what the customer owes
      paymentMode: mode,
      ...(note ? { note } : {}),
    };
    await db.ledger.add(entry);
    await db.customers.update(customerId, {
      balancePaise: customer.balancePaise - amountPaise,
      updatedAt: nowIso(),
    });
    return entry;
  });
}

/** Manual correction or write-off. Signed: positive increases what is owed. */
export async function recordAdjustment(
  customerId: Id,
  amountPaise: number,
  note: string,
): Promise<LedgerEntry> {
  return db.transaction('rw', [db.ledger, db.customers], async () => {
    const customer = await db.customers.get(customerId);
    if (!customer) throw new Error('Customer not found');

    const entry: LedgerEntry = {
      id: newId(),
      customerId,
      at: nowIso(),
      type: 'adjustment',
      amountPaise,
      note,
    };
    await db.ledger.add(entry);
    await db.customers.update(customerId, {
      balancePaise: customer.balancePaise + amountPaise,
      updatedAt: nowIso(),
    });
    return entry;
  });
}

/** Migrating a shop's existing paper notebook (doc 05). */
export async function setOpeningBalance(
  customerId: Id,
  amountPaise: number,
  note = 'Opening balance',
): Promise<void> {
  await db.transaction('rw', [db.ledger, db.customers], async () => {
    const customer = await db.customers.get(customerId);
    if (!customer) throw new Error('Customer not found');
    await db.ledger.add({
      id: newId(),
      customerId,
      at: nowIso(),
      type: 'opening_balance',
      amountPaise,
      note,
    });
    await db.customers.update(customerId, {
      balancePaise: customer.balancePaise + amountPaise,
      updatedAt: nowIso(),
    });
  });
}

/**
 * Rebuild every cached balance from the ledger.
 * The escape hatch if a cache ever drifts from the append-only truth.
 */
export async function recalculateAllBalances(): Promise<number> {
  return db.transaction('rw', [db.ledger, db.customers], async () => {
    const [entries, customers] = await Promise.all([db.ledger.toArray(), db.customers.toArray()]);
    const sums = new Map<Id, number>();
    for (const e of entries) {
      sums.set(e.customerId, (sums.get(e.customerId) ?? 0) + e.amountPaise);
    }
    let fixed = 0;
    for (const c of customers) {
      const actual = sums.get(c.id) ?? 0;
      if (actual !== c.balancePaise) {
        await db.customers.update(c.id, { balancePaise: actual, updatedAt: nowIso() });
        fixed++;
      }
    }
    return fixed;
  });
}
