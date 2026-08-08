/**
 * Money arithmetic. Everything is integer paise (D1, docs/02-data-model.md).
 *
 * The old code stored float rupees and derived the subtotal as `total / 1.08`,
 * which silently broke whenever the tax rate changed. None of that is possible
 * here: paise are integers and totals are composed, never decomposed.
 */

import type { Paise } from './types';

/** Rupees (as typed by a human) -> paise. */
export const rupeesToPaise = (rupees: number): Paise => Math.round(rupees * 100);

/** Paise -> rupees, for display only. Never feed this back into arithmetic. */
export const paiseToRupees = (paise: Paise): number => paise / 100;

/**
 * Parse free-text rupee input ("45", "45.50", "₹1,234.5") to paise.
 * Returns null for anything that isn't a usable number, so callers can
 * distinguish "empty field" from "zero".
 */
export function parseRupeeInput(input: string): Paise | null {
  const cleaned = input.replace(/[₹,\s]/g, '').trim();
  if (cleaned === '' || cleaned === '.' || cleaned === '-') return null;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return rupeesToPaise(value);
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrWholeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "₹1,25,000.50" — Indian lakh/crore grouping, not "₹125,000.50". */
export const formatINR = (paise: Paise): string => inrFormatter.format(paiseToRupees(paise));

/** "₹1,25,000" — for headline figures where paise are noise. */
export const formatINRWhole = (paise: Paise): string =>
  inrWholeFormatter.format(paiseToRupees(paise));

const plainFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1,25,000.50" — no symbol, for printed bill columns. */
export const formatAmount = (paise: Paise): string => plainFormatter.format(paiseToRupees(paise));

/**
 * The delta needed to bring an amount to the nearest whole rupee.
 * roundOffDelta(44560) === -60  (₹445.60 -> ₹445.00)
 * roundOffDelta(44580) === +20  (₹445.80 -> ₹446.00)
 *
 * Math.round rounds .5 upward, which matches shop practice (the customer pays
 * the extra paise rather than the shop absorbing them).
 */
export const roundOffDelta = (paise: Paise): Paise => Math.round(paise / 100) * 100 - paise;

/** Sum helper that keeps the Paise type visible at call sites. */
export const sumPaise = (values: readonly Paise[]): Paise => values.reduce((a, b) => a + b, 0);

/**
 * Line amount for a quantity that may be fractional (2.5 kg).
 *
 * Quantity stays a float — you cannot express 2.5 kg as an integer — but the
 * MONEY is rounded to whole paise immediately so no fractional paise can
 * propagate into the bill total.
 */
export const lineAmount = (qty: number, unitPricePaise: Paise): Paise =>
  Math.round(qty * unitPricePaise);

/** Percentage of an amount, rounded to whole paise. */
export const percentOf = (paise: Paise, percent: number): Paise =>
  Math.round((paise * percent) / 100);

/** Quantity display: 2.5 -> "2.5", 3 -> "3", 0.25 -> "0.25". Max 3 dp (grams). */
export function formatQty(qty: number): string {
  const rounded = Math.round(qty * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
