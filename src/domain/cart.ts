/**
 * Cart totals. Pure, no I/O — see docs/03-billing-scanner.md.
 *
 * The invariant that matters: Σ payments + credit === total. It is asserted
 * before a sale is committed (doc 07); a sale that doesn't balance is rejected
 * rather than written wrong.
 */

import { lineAmount, roundOffDelta, sumPaise } from './money';
import { computeGst, type GstResult } from './gst';
import type { Paise, Payment, Product, SaleLine } from './types';

export interface CartTotalsInput {
  lines: readonly SaleLine[];
  billDiscountPaise: Paise;
  gst: { enabled: boolean; pricesIncludeTax: boolean };
  roundOffEnabled: boolean;
}

export interface CartTotals {
  subtotalPaise: Paise;
  billDiscountPaise: Paise;
  /** Sum of per-line discounts — shown as customer "savings". */
  lineDiscountPaise: Paise;
  taxPaise: Paise;
  roundOffPaise: Paise;
  totalPaise: Paise;
  gst: GstResult;
  itemCount: number;
  /** Distinct lines, which is what the cart badge shows. */
  lineCount: number;
}

/** Build a sale line from a product + quantity, snapshotting name and price. */
export function buildLine(
  product: Product,
  qty: number,
  opts?: { lineDiscountPaise?: Paise; unitPricePaise?: Paise },
): SaleLine {
  const unitPricePaise = opts?.unitPricePaise ?? product.sellPricePaise;
  const lineDiscountPaise = opts?.lineDiscountPaise ?? 0;
  return {
    productId: product.id,
    nameEn: product.nameEn,
    nameTa: product.nameTa,
    unit: product.unit,
    qty,
    unitPricePaise,
    lineDiscountPaise,
    lineTotalPaise: lineAmount(qty, unitPricePaise) - lineDiscountPaise,
    ...(product.gstSlab !== undefined ? { gstSlab: product.gstSlab } : {}),
    ...(product.hsn !== undefined ? { hsn: product.hsn } : {}),
  };
}

/** Recompute a line's total after its quantity, price or discount changed. */
export function recalcLine(line: SaleLine): SaleLine {
  return {
    ...line,
    lineTotalPaise: lineAmount(line.qty, line.unitPricePaise) - line.lineDiscountPaise,
  };
}

export function computeTotals(input: CartTotalsInput): CartTotals {
  const { lines, billDiscountPaise, gst, roundOffEnabled } = input;

  const subtotalPaise = sumPaise(lines.map((l) => l.lineTotalPaise));
  const lineDiscountPaise = sumPaise(lines.map((l) => l.lineDiscountPaise));

  // A discount can never exceed the subtotal; a negative total is nonsense.
  const clampedBillDiscount = Math.min(Math.max(billDiscountPaise, 0), subtotalPaise);
  const afterDiscount = subtotalPaise - clampedBillDiscount;

  const gstResult = computeGst(lines, gst);

  // When prices include tax the tax is already inside `afterDiscount`, so it
  // must NOT be added again. When they exclude tax, it goes on top.
  const preRound = gst.enabled && !gst.pricesIncludeTax ? afterDiscount + gstResult.totalTaxPaise : afterDiscount;

  const roundOffPaise = roundOffEnabled ? roundOffDelta(preRound) : 0;

  return {
    subtotalPaise,
    billDiscountPaise: clampedBillDiscount,
    lineDiscountPaise,
    taxPaise: gstResult.totalTaxPaise,
    roundOffPaise,
    totalPaise: preRound + roundOffPaise,
    gst: gstResult,
    itemCount: lines.length,
    lineCount: lines.length,
  };
}

/** Amount still unpaid after the given payments. Never negative. */
export const creditRemaining = (totalPaise: Paise, payments: readonly Payment[]): Paise =>
  Math.max(0, totalPaise - sumPaise(payments.map((p) => p.amountPaise)));

/** Cash handed back when the customer over-pays. Never negative. */
export const changeDue = (totalPaise: Paise, tenderedPaise: Paise): Paise =>
  Math.max(0, tenderedPaise - totalPaise);

/**
 * The commit invariant (doc 07). Called before opening the write transaction.
 * Non-credit payments are capped at the total, so overpayment in cash shows up
 * as change due rather than as a mismatched sale.
 */
export function assertBalances(
  totalPaise: Paise,
  payments: readonly Payment[],
  creditPaise: Paise,
): void {
  const paid = sumPaise(
    payments.filter((p) => p.mode !== 'credit').map((p) => Math.min(p.amountPaise, totalPaise)),
  );
  const settled = Math.min(paid, totalPaise) + creditPaise;
  if (settled !== totalPaise) {
    throw new Error(
      `Sale does not balance: payments ${paid} + credit ${creditPaise} !== total ${totalPaise}`,
    );
  }
}

/**
 * Merge a scanned/tapped product into an existing cart.
 *
 * Piece-based items increment an existing line — scanning the same packet
 * twice should read as quantity 2, not two separate lines. Weight-based items
 * always open a fresh line because the quantity comes from the keypad.
 */
export function addToCart(
  lines: readonly SaleLine[],
  product: Product,
  qty: number,
): SaleLine[] {
  const existingIndex = lines.findIndex(
    (l) => l.productId === product.id && l.lineDiscountPaise === 0,
  );
  if (existingIndex >= 0) {
    const next = [...lines];
    const existing = next[existingIndex]!;
    next[existingIndex] = recalcLine({ ...existing, qty: existing.qty + qty });
    return next;
  }
  return [...lines, buildLine(product, qty)];
}
