/**
 * Returns and refunds.
 *
 * Sales are immutable (doc 07), so a return is a NEW sale with negative
 * quantities linked to the original via `returnOfSaleId`. The original bill is
 * never edited — an already-printed bill must keep matching the paper in the
 * customer's hand.
 */

import { db, newId, nowIso } from '../db';
import type { Id, LedgerEntry, Sale, SaleLine } from '@/domain/types';

export interface ReturnRequest {
  saleId: Id;
  /** Index into the original sale's lines -> quantity being returned. */
  quantities: Map<number, number>;
  /** How the refund is handed back. 'credit' reduces the customer's balance. */
  refundMode: 'cash' | 'upi' | 'credit';
}

export class ReturnError extends Error {}

export async function commitReturn(request: ReturnRequest): Promise<Sale> {
  const original = await db.sales.get(request.saleId);
  if (!original) throw new ReturnError('Original bill not found');
  if (original.status === 'returned') throw new ReturnError('This bill was already returned');

  const lines: SaleLine[] = [];
  for (const [index, qty] of request.quantities) {
    const source = original.lines[index];
    if (!source || qty <= 0) continue;
    if (qty > source.qty) throw new ReturnError('Cannot return more than was sold');
    lines.push({
      ...source,
      qty: -qty,
      lineDiscountPaise: 0,
      lineTotalPaise: -Math.round(qty * source.unitPricePaise),
    });
  }

  if (lines.length === 0) throw new ReturnError('Select at least one item to return');

  const refundPaise = -lines.reduce((sum, l) => sum + l.lineTotalPaise, 0);
  const createdAt = nowIso();
  const returnId = newId();

  return db.transaction(
    'rw',
    [db.sales, db.products, db.ledger, db.customers, db.counters],
    async () => {
      const dateKey = billDateKey(new Date(createdAt));
      const counterKey = `bill:${dateKey}`;
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

      // A credit refund reduces what the customer owes rather than paying cash.
      if (request.refundMode === 'credit' && original.customerId) {
        const customer = await db.customers.get(original.customerId);
        if (!customer) throw new ReturnError('Customer not found');
        const entry: LedgerEntry = {
          id: newId(),
          customerId: original.customerId,
          at: createdAt,
          type: 'adjustment',
          amountPaise: -refundPaise,
          saleId: returnId,
          note: `Return of ${original.billNo}`,
        };
        await db.ledger.add(entry);
        await db.customers.update(original.customerId, {
          balancePaise: customer.balancePaise - refundPaise,
          updatedAt: createdAt,
        });
      }

      const returnSale: Sale = {
        id: returnId,
        billNo: `${dateKey}-${String(seq).padStart(3, '0')}R`,
        createdAt,
        lines,
        subtotalPaise: -refundPaise,
        billDiscountPaise: 0,
        taxPaise: 0,
        roundOffPaise: 0,
        totalPaise: -refundPaise,
        payments:
          request.refundMode === 'credit'
            ? []
            : [{ mode: request.refundMode, amountPaise: -refundPaise }],
        creditPaise: 0,
        status: 'completed',
        returnOfSaleId: original.id,
        ...(original.customerId ? { customerId: original.customerId } : {}),
        note: `Return of ${original.billNo}`,
      };
      await db.sales.add(returnSale);

      // Mark the original, without altering its amounts.
      const fullyReturned = original.lines.every(
        (line, i) => (request.quantities.get(i) ?? 0) >= line.qty,
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
