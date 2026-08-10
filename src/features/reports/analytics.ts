/**
 * Report arithmetic, kept out of the component so it can be tested.
 *
 * Reports used to be four totals and three lists — correct, and a table
 * rather than an instrument. A number on its own is data; a number with a
 * baseline is information. Everything here exists to give the shopkeeper the
 * second kind: how today compares with the same stretch before it, when the
 * shop is actually busy, and what is left after what the goods cost.
 *
 * All money stays integer paise (D1). Quantities may be fractional (2.5 kg),
 * so every money product is rounded at the point it is computed.
 */

import type { Id, Paise, PaymentMode, Sale } from '@/domain/types';

export interface PeriodSummary {
  billCount: number;
  revenuePaise: Paise;
  creditPaise: Paise;
  averagePaise: Paise;
}

/** Summarise a set of sales. Returns zeros for an empty set, never NaN. */
export function summarise(sales: readonly Sale[]): PeriodSummary {
  const revenuePaise = sales.reduce((sum, s) => sum + s.totalPaise, 0);
  const creditPaise = sales.reduce((sum, s) => sum + s.creditPaise, 0);
  return {
    billCount: sales.length,
    revenuePaise,
    creditPaise,
    averagePaise: sales.length ? Math.round(revenuePaise / sales.length) : 0,
  };
}

/**
 * Percentage change from `previous` to `current`, or null when there is no
 * usable baseline.
 *
 * Growing from zero is not "infinity percent" — it is a period with nothing to
 * compare against, and saying so is more honest than printing a number the
 * shopkeeper would have to discount in their head.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export interface DayBucket {
  /** Local calendar day, midnight. */
  date: Date;
  totalPaise: Paise;
  billCount: number;
}

/**
 * One bucket per day across the whole window, including days with no sales.
 *
 * The gaps matter: a sparkline drawn only from days that had sales makes a
 * closed Sunday look like a normal trading day.
 */
export function dailySeries(
  sales: readonly Sale[],
  days: number,
  now: Date = new Date(),
): DayBucket[] {
  const buckets: DayBucket[] = [];
  const index = new Map<string, DayBucket>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = startOfDay(now);
    date.setDate(date.getDate() - offset);
    const bucket: DayBucket = { date, totalPaise: 0, billCount: 0 };
    buckets.push(bucket);
    index.set(dayKey(date), bucket);
  }

  for (const sale of sales) {
    const bucket = index.get(dayKey(new Date(sale.createdAt)));
    if (!bucket) continue;
    bucket.totalPaise += sale.totalPaise;
    bucket.billCount += 1;
  }
  return buckets;
}

/**
 * Sales per hour of the day, summed across the whole period.
 *
 * A kirana owner genuinely does not know whether the 7–9pm rush beats the
 * morning one. Finding out is the first thing that makes software feel worth
 * paying for, and no paper notebook can produce it.
 */
export function hourHistogram(sales: readonly Sale[]): Paise[] {
  const hours: Paise[] = Array.from({ length: 24 }, () => 0);
  for (const sale of sales) {
    const hour = new Date(sale.createdAt).getHours();
    hours[hour] = (hours[hour] ?? 0) + sale.totalPaise;
  }
  return hours;
}

/** Totals per payment mode, biggest first. Credit is excluded — it is not paid. */
export function paymentMix(sales: readonly Sale[]): Array<[PaymentMode, Paise]> {
  const byMode = new Map<PaymentMode, Paise>();
  for (const sale of sales) {
    for (const payment of sale.payments) {
      byMode.set(payment.mode, (byMode.get(payment.mode) ?? 0) + payment.amountPaise);
    }
  }
  return [...byMode.entries()].sort((a, b) => b[1] - a[1]);
}

export interface ProductTotals {
  productId: Id;
  nameEn: string;
  nameTa: string;
  qty: number;
  revenuePaise: Paise;
}

/** Best sellers by revenue. Names are snapshots off the sale line, not lookups. */
export function productTotals(sales: readonly Sale[]): ProductTotals[] {
  const byProduct = new Map<Id, ProductTotals>();
  for (const sale of sales) {
    for (const line of sale.lines) {
      const current = byProduct.get(line.productId) ?? {
        productId: line.productId,
        nameEn: line.nameEn,
        nameTa: line.nameTa,
        qty: 0,
        revenuePaise: 0,
      };
      current.qty += line.qty;
      current.revenuePaise += line.lineTotalPaise;
      byProduct.set(line.productId, current);
    }
  }
  return [...byProduct.values()].sort((a, b) => b.revenuePaise - a.revenuePaise);
}

export interface MarginResult {
  /** Profit on the lines whose product has a cost price recorded. */
  profitPaise: Paise;
  /** Revenue those lines represent — the profit's denominator. */
  costedRevenuePaise: Paise;
  /** Revenue with no cost price behind it, so the UI can be honest. */
  uncostedRevenuePaise: Paise;
}

/**
 * Gross margin, over the lines where it can actually be known.
 *
 * "You sold ₹4,280, you made ₹610" is the most valuable line this app can
 * show — but only for items whose cost price was entered. Lines without one
 * are reported separately rather than silently counted as pure profit, which
 * would flatter the shop and make the number useless.
 *
 * Returns whole-paise arithmetic: `qty` may be 2.5 kg, so each line's cost is
 * rounded before it is summed, exactly as `lineAmount` does for the price.
 */
export function grossMargin(
  sales: readonly Sale[],
  costByProduct: ReadonlyMap<Id, Paise | undefined>,
): MarginResult {
  let profitPaise = 0;
  let costedRevenuePaise = 0;
  let uncostedRevenuePaise = 0;

  for (const sale of sales) {
    for (const line of sale.lines) {
      const cost = costByProduct.get(line.productId);
      if (cost === undefined || cost <= 0) {
        uncostedRevenuePaise += line.lineTotalPaise;
        continue;
      }
      costedRevenuePaise += line.lineTotalPaise;
      profitPaise += line.lineTotalPaise - Math.round(line.qty * cost);
    }
  }
  return { profitPaise, costedRevenuePaise, uncostedRevenuePaise };
}

// ─── helpers ────────────────────────────────────────────────────────────────

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Local calendar key. Deliberately not the ISO string — that is UTC. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** The window a report covers, plus the equally long window before it. */
export function periodBounds(
  days: number,
  now: Date = new Date(),
): { from: Date; previousFrom: Date } {
  const from = startOfDay(now);
  from.setDate(from.getDate() - (days - 1));
  const previousFrom = new Date(from);
  previousFrom.setDate(previousFrom.getDate() - days);
  return { from, previousFrom };
}
