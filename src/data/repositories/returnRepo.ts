/**
 * Returns and refunds.
 *
 * Sales are immutable (doc 07), so a return is a NEW sale with negative
 * quantities linked to the original via `returnOfSaleId`. The original bill is
 * never edited — an already-printed bill must keep matching the paper in the
 * customer's hand.
 *
 * Three rules this file exists to enforce, each of which was previously
 * violated:
 *
 * 1. **A bill can never be refunded for more than it was worth.** Quantities
 *    are checked against what is still un-returned across ALL prior returns,
 *    not against the original line quantity. Returning 2 of 5 and then 5 of 5
 *    used to refund ₹70 on a ₹50 sale and invent two units of stock.
 * 2. **The refund is a share of what the customer actually paid**, not a sum
 *    of raw line totals. That is the only way a bill discount, the round-off
 *    and GST come back correctly; summing lines refunded the undiscounted
 *    amount and dropped the tax entirely.
 * 3. **Money that was never handed over is never handed back.** If the bill
 *    went on the customer's account, the refund reduces that balance before
 *    any cash leaves the drawer.
 */

import { db, newId, nowIso } from '../db';
import { sumPaise } from '@/domain/money';
import type { Id, LedgerEntry, Paise, Sale, SaleLine } from '@/domain/types';

export interface ReturnRequest {
  saleId: Id;
  /** Index into the original sale's lines -> quantity being returned. */
  quantities: Map<number, number>;
  /** How the CASH part of the refund is handed back. */
  refundMode: 'cash' | 'upi' | 'credit';
}

export class ReturnError extends Error {}

/** Every return already recorded against a bill. */
export function priorReturns(saleId: Id): Promise<Sale[]> {
  return db.sales.where('returnOfSaleId').equals(saleId).toArray();
}

/**
 * How much of each product has already come back.
 *
 * Aggregated per product rather than per line index: a return line is a copy
 * of the original and does not record which index it came from, and weight
 * items legitimately produce two lines of the same product (2 kg rice and
 * 1.5 kg rice). "No more rice may come back than went out" is both the check
 * that matters and the one that survives return rows written by older builds.
 */
export function returnedByProduct(returns: readonly Sale[]): Map<Id, number> {
  const returned = new Map<Id, number>();
  for (const ret of returns) {
    for (const line of ret.lines) {
      returned.set(line.productId, (returned.get(line.productId) ?? 0) + Math.abs(line.qty));
    }
  }
  return returned;
}

/** Quantity sold per product on the original bill. */
export function soldByProduct(sale: Sale): Map<Id, number> {
  const sold = new Map<Id, number>();
  for (const line of sale.lines) {
    sold.set(line.productId, (sold.get(line.productId) ?? 0) + line.qty);
  }
  return sold;
}

/**
 * How much refund has already been taken off the customer's account for this
 * bill. A return's credit portion is whatever its total was not paid out in
 * cash, so it reads back off the return rows without extra bookkeeping.
 */
export function creditAlreadyRefunded(returns: readonly Sale[]): Paise {
  return returns.reduce((sum, ret) => {
    const paidOut = Math.abs(sumPaise(ret.payments.map((p) => p.amountPaise)));
    return sum + (Math.abs(ret.totalPaise) - paidOut);
  }, 0);
}

/**
 * The refund for a set of returned lines, as a share of what was charged.
 *
 * Working from the original's own totals means the return inherits whatever
 * conventions were in force on the day — tax-inclusive or exclusive pricing,
 * a bill-level discount, the round-off — without this module needing to know
 * any of them. A full return refunds the bill exactly.
 */
export function proportionalRefund(
  original: Sale,
  returnedSubtotalPaise: Paise,
): { refundPaise: Paise; taxPaise: Paise } {
  if (original.subtotalPaise <= 0 || returnedSubtotalPaise <= 0) {
    return { refundPaise: 0, taxPaise: 0 };
  }
  const ratio = Math.min(1, returnedSubtotalPaise / original.subtotalPaise);
  return {
    refundPaise: Math.round(original.totalPaise * ratio),
    taxPaise: Math.round(original.taxPaise * ratio),
  };
}

export async function commitReturn(request: ReturnRequest): Promise<Sale> {
  const original = await db.sales.get(request.saleId);
  if (!original) throw new ReturnError('Original bill not found');
  if (original.returnOfSaleId) throw new ReturnError('A return cannot itself be returned');
  if (original.status === 'returned') throw new ReturnError('This bill was already returned');

  const previous = await priorReturns(request.saleId);
  const alreadyReturned = returnedByProduct(previous);
  const sold = soldByProduct(original);

  const lines: SaleLine[] = [];
  const requestedByProduct = new Map<Id, number>();

  for (const [index, qty] of request.quantities) {
    const source = original.lines[index];
    if (!source || qty <= 0) continue;
    if (qty > source.qty) throw new ReturnError('Cannot return more than was sold');

    const running = (requestedByProduct.get(source.productId) ?? 0) + qty;
    requestedByProduct.set(source.productId, running);

    // The check that was missing: prior returns count against the same bill.
    const outstanding =
      (sold.get(source.productId) ?? 0) - (alreadyReturned.get(source.productId) ?? 0);
    if (running > outstanding) {
      throw new ReturnError('Cannot return more than was sold');
    }

    lines.push({
      ...source,
      qty: -qty,
      lineDiscountPaise: 0,
      lineTotalPaise: -Math.round(qty * source.unitPricePaise),
    });
  }

  if (lines.length === 0) throw new ReturnError('Select at least one item to return');

  const returnedSubtotal = -sumPaise(lines.map((l) => l.lineTotalPaise));
  const { refundPaise, taxPaise } = proportionalRefund(original, returnedSubtotal);
  if (refundPaise <= 0) throw new ReturnError('Nothing to refund');

  // Money that never arrived is not handed back: the unpaid part of the bill
  // comes off the customer's account first, and only the balance is paid out.
  const creditOutstanding = Math.max(0, original.creditPaise - creditAlreadyRefunded(previous));
  const creditPortion = original.customerId ? Math.min(refundPaise, creditOutstanding) : 0;
  const cashPortion = refundPaise - creditPortion;

  const createdAt = nowIso();
  const returnId = newId();

  return db.transaction(
    'rw',
    [db.sales, db.products, db.ledger, db.customers, db.counters],
    async () => {
      // Returns have their OWN daily series. Sharing the sale sequence left
      // gaps in it (001, 002R, 003…), exactly the sort of thing a shopkeeper
      // reconciling by hand notices and does not trust.
      const dateKey = billDateKey(new Date(createdAt));
      const counterKey = `return:${dateKey}`;
      const counter = await db.counters.get(counterKey);
      const seq = (counter?.value ?? 0) + 1;
      await db.counters.put({ id: counterKey, value: seq });

      // Stock goes back up.
      for (const line of lines) {
        const product = await db.products.get(line.productId);
        if (product?.trackStock) {
          await db.products.update(line.productId, {
            stockQty: product.stockQty + Math.abs(line.qty),
            updatedAt: createdAt,
          });
        }
      }

      if (creditPortion > 0 && original.customerId) {
        const customer = await db.customers.get(original.customerId);
        if (!customer) throw new ReturnError('Customer not found');
        const entry: LedgerEntry = {
          id: newId(),
          customerId: original.customerId,
          at: createdAt,
          type: 'adjustment',
          amountPaise: -creditPortion,
          saleId: returnId,
          note: `Return of ${original.billNo}`,
        };
        await db.ledger.add(entry);
        await db.customers.update(original.customerId, {
          balancePaise: customer.balancePaise - creditPortion,
          updatedAt: createdAt,
        });
      }

      const returnSale: Sale = {
        id: returnId,
        billNo: `${dateKey}-R${String(seq).padStart(3, '0')}`,
        createdAt,
        lines,
        subtotalPaise: -returnedSubtotal,
        billDiscountPaise: 0,
        taxPaise: -taxPaise,
        roundOffPaise: 0,
        totalPaise: -refundPaise,
        // Only the part actually paid out appears as a payment. The rest is
        // the ledger adjustment above, and the two sum to the refund.
        payments:
          cashPortion > 0
            ? [
                {
                  mode: request.refundMode === 'credit' ? 'cash' : request.refundMode,
                  amountPaise: -cashPortion,
                },
              ]
            : [],
        creditPaise: 0,
        status: 'completed',
        returnOfSaleId: original.id,
        ...(original.customerId ? { customerId: original.customerId } : {}),
        note: `Return of ${original.billNo}`,
      };
      await db.sales.add(returnSale);

      // Fully returned means CUMULATIVELY fully returned, across every return
      // this bill has seen — not just the one being committed now.
      const totalReturned = returnedByProduct([...previous, returnSale]);
      const fullyReturned = [...sold.entries()].every(
        ([productId, qty]) => (totalReturned.get(productId) ?? 0) >= qty,
      );
      await db.sales.update(original.id, {
        status: fullyReturned ? 'returned' : 'partially_returned',
      });

      return returnSale;
    },
  );
}

function billDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}${pad(date.getMonth() + 1)}${String(date.getFullYear()).slice(-2)}`;
}
