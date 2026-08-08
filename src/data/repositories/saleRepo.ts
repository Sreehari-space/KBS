/**
 * Sale persistence — the most important code in the app.
 *
 * The commit protocol (docs/07-autosave-durability.md):
 *   ONE transaction writes the sale, decrements stock, appends the ledger
 *   entry, allocates the bill number and clears the draft. All of it lands,
 *   or none of it does. The receipt is rendered only after this resolves;
 *   on failure the caller keeps the cart and can retry.
 */

import { db, newId, nowIso } from '../db';
import { assertBalances } from '@/domain/cart';
import type {
  CartDraft,
  Customer,
  Id,
  LedgerEntry,
  Payment,
  Sale,
  SaleLine,
  SaleStatus,
} from '@/domain/types';

export interface CommitSaleInput {
  lines: SaleLine[];
  subtotalPaise: number;
  billDiscountPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  payments: Payment[];
  creditPaise: number;
  customerId?: Id;
  note?: string;
  /** Draft to clear in the same transaction; defaults to the active cart. */
  draftId?: Id;
}

export class SaleCommitError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SaleCommitError';
  }
}

/** "080826-014" — resets daily, allocated inside the write transaction. */
function billDateKey(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

/**
 * Commit a completed sale.
 *
 * @throws SaleCommitError if the sale does not balance, a customer is missing
 *         for a credit sale, or the write fails. Nothing is persisted in any
 *         of those cases.
 */
export async function commitSale(input: CommitSaleInput): Promise<Sale> {
  if (input.lines.length === 0) {
    throw new SaleCommitError('Cannot bill an empty cart');
  }

  // Fail before opening the transaction, not inside it.
  try {
    assertBalances(input.totalPaise, input.payments, input.creditPaise);
  } catch (err) {
    throw new SaleCommitError((err as Error).message, err);
  }

  if (input.creditPaise > 0 && !input.customerId) {
    throw new SaleCommitError('A credit sale needs a customer');
  }

  const createdAt = nowIso();
  const saleId = newId();
  const draftId = input.draftId ?? ACTIVE_DRAFT_ID;

  try {
    return await db.transaction(
      'rw',
      [db.sales, db.products, db.ledger, db.customers, db.counters, db.drafts],
      async () => {
        // 1. Allocate the bill number inside the transaction so two fast taps
        //    cannot produce the same number.
        const key = `bill:${billDateKey(new Date(createdAt))}`;
        const counter = await db.counters.get(key);
        const seq = (counter?.value ?? 0) + 1;
        await db.counters.put({ id: key, value: seq });
        const billNo = `${billDateKey(new Date(createdAt))}-${String(seq).padStart(3, '0')}`;

        // 2. Decrement stock, but only for products that track it.
        for (const line of input.lines) {
          const product = await db.products.get(line.productId);
          if (product?.trackStock) {
            await db.products.update(line.productId, {
              stockQty: product.stockQty - line.qty,
              updatedAt: createdAt,
            });
          }
        }

        // 3. Ledger entry + customer balance for the unpaid remainder.
        if (input.creditPaise > 0 && input.customerId) {
          const entry: LedgerEntry = {
            id: newId(),
            customerId: input.customerId,
            at: createdAt,
            type: 'credit_sale',
            amountPaise: input.creditPaise,
            saleId,
          };
          await db.ledger.add(entry);

          const customer = await db.customers.get(input.customerId);
          if (!customer) throw new Error('Customer not found for credit sale');
          await db.customers.update(input.customerId, {
            balancePaise: customer.balancePaise + input.creditPaise,
            updatedAt: createdAt,
          });
        }

        // 4. The sale itself.
        const sale: Sale = {
          id: saleId,
          billNo,
          createdAt,
          lines: input.lines,
          subtotalPaise: input.subtotalPaise,
          billDiscountPaise: input.billDiscountPaise,
          taxPaise: input.taxPaise,
          roundOffPaise: input.roundOffPaise,
          totalPaise: input.totalPaise,
          payments: input.payments,
          creditPaise: input.creditPaise,
          status: 'completed' as SaleStatus,
          ...(input.customerId ? { customerId: input.customerId } : {}),
          ...(input.note ? { note: input.note } : {}),
        };
        await db.sales.add(sale);

        // 5. Clear the draft last — only now is the cart safely on disk.
        await db.drafts.delete(draftId);

        return sale;
      },
    );
  } catch (err) {
    throw new SaleCommitError(
      err instanceof Error && err.name === 'QuotaExceededError'
        ? 'Device storage is full — the bill was not saved'
        : `Could not save the bill: ${(err as Error).message}`,
      err,
    );
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export const ACTIVE_DRAFT_ID = 'active';

export function listSales(limit = 50): Promise<Sale[]> {
  return db.sales.orderBy('createdAt').reverse().limit(limit).toArray();
}

export function getSale(id: Id): Promise<Sale | undefined> {
  return db.sales.get(id);
}

/** Sales within a local-time day range, used by reports and day close. */
export function salesBetween(fromIso: string, toIso: string): Promise<Sale[]> {
  return db.sales.where('createdAt').between(fromIso, toIso, true, true).toArray();
}

export function salesForDay(date: Date): Promise<Sale[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return salesBetween(start.toISOString(), end.toISOString());
}

export function salesForCustomer(customerId: Id): Promise<Sale[]> {
  return db.sales.where('customerId').equals(customerId).reverse().toArray();
}

// ─── Draft auto-save (task 1.4b) ────────────────────────────────────────────

/**
 * Persist the in-progress cart. Called debounced from the billing screen so a
 * burst of "+" taps doesn't cause a write storm.
 *
 * This is what survives Android killing a backgrounded tab — routine on
 * low-RAM phones and the reason this exists.
 */
export async function saveDraft(draft: Omit<CartDraft, 'updatedAt'>): Promise<void> {
  await db.drafts.put({ ...draft, updatedAt: nowIso() });
}

export function getActiveDraft(): Promise<CartDraft | undefined> {
  return db.drafts.get(ACTIVE_DRAFT_ID);
}

export async function clearActiveDraft(): Promise<void> {
  await db.drafts.delete(ACTIVE_DRAFT_ID);
}

export function listHeldBills(): Promise<CartDraft[]> {
  return db.drafts.where('kind').equals('held').reverse().sortBy('updatedAt');
}

/** Park the current cart so the next customer can be served. */
export async function holdCurrentCart(draft: CartDraft, label: string): Promise<Id> {
  const id = newId();
  await db.transaction('rw', db.drafts, async () => {
    await db.drafts.put({ ...draft, id, kind: 'held', label, updatedAt: nowIso() });
    await db.drafts.delete(ACTIVE_DRAFT_ID);
  });
  return id;
}

export async function resumeHeldBill(id: Id): Promise<CartDraft | undefined> {
  return db.transaction('rw', db.drafts, async () => {
    const held = await db.drafts.get(id);
    if (!held) return undefined;
    const active: CartDraft = { ...held, id: ACTIVE_DRAFT_ID, kind: 'active', updatedAt: nowIso() };
    await db.drafts.put(active);
    await db.drafts.delete(id);
    return active;
  });
}

// ─── Customer helper used by the billing screen ─────────────────────────────

export function getCustomer(id: Id): Promise<Customer | undefined> {
  return db.customers.get(id);
}
