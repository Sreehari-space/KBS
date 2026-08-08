/**
 * Day close (கடை சாத்து). See docs/05-ledger-tamil-dayclose.md.
 *
 * The end-of-day ritual: count the cash box, check it against the day's takings,
 * note what's missing. Every shop does this on paper; it's where mistakes and
 * theft surface.
 */

import { db } from '@/data/db';
import type { Paise, PaymentMode, Sale } from '@/domain/types';

export interface DayCloseSummary {
  date: Date;
  billCount: number;
  salesTotalPaise: Paise;
  byMode: Record<PaymentMode, Paise>;
  creditGivenPaise: Paise;
  creditCollectedPaise: Paise;
  creditCollectedCashPaise: Paise;
  /** Cash payments + cash credit collections. NOT just sales. */
  expectedCashPaise: Paise;
}

function dayRange(date: Date): [string, string] {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return [start.toISOString(), end.toISOString()];
}

export async function buildDayClose(date = new Date()): Promise<DayCloseSummary> {
  const [from, to] = dayRange(date);

  const [sales, ledger] = await Promise.all([
    db.sales.where('createdAt').between(from, to, true, true).toArray(),
    db.ledger.where('at').between(from, to, true, true).toArray(),
  ]);

  const byMode: Record<PaymentMode, Paise> = { cash: 0, upi: 0, card: 0, credit: 0 };
  let salesTotalPaise = 0;
  let creditGivenPaise = 0;

  for (const sale of sales as Sale[]) {
    salesTotalPaise += sale.totalPaise;
    creditGivenPaise += sale.creditPaise;
    for (const payment of sale.payments) {
      if (payment.mode !== 'credit') {
        byMode[payment.mode] += Math.min(payment.amountPaise, sale.totalPaise);
      }
    }
  }
  byMode.credit = creditGivenPaise;

  // Collections are stored as negative ledger amounts; flip the sign.
  const collections = ledger.filter((e) => e.type === 'payment');
  const creditCollectedPaise = collections.reduce((sum, e) => sum + -e.amountPaise, 0);
  const creditCollectedCashPaise = collections
    .filter((e) => e.paymentMode === 'cash' || e.paymentMode === undefined)
    .reduce((sum, e) => sum + -e.amountPaise, 0);

  return {
    date,
    billCount: sales.length,
    salesTotalPaise,
    byMode,
    creditGivenPaise,
    creditCollectedPaise,
    creditCollectedCashPaise,
    expectedCashPaise: byMode.cash + creditCollectedCashPaise,
  };
}

export function dayCloseText(
  summary: DayCloseSummary,
  shopName: string,
  countedCashPaise: Paise | null,
  labels: {
    title: string;
    sales: string;
    bills: string;
    cash: string;
    upi: string;
    card: string;
    credit: string;
    collected: string;
    expected: string;
    counted: string;
    difference: string;
  },
): string {
  const rupees = (p: Paise) => (p / 100).toFixed(2);
  const out = [
    `*${shopName}*`,
    `${labels.title} — ${summary.date.toLocaleDateString()}`,
    '',
    `${labels.bills}: ${summary.billCount}`,
    `${labels.sales}: ₹${rupees(summary.salesTotalPaise)}`,
    '',
    `${labels.cash}: ₹${rupees(summary.byMode.cash)}`,
    `${labels.upi}: ₹${rupees(summary.byMode.upi)}`,
    `${labels.card}: ₹${rupees(summary.byMode.card)}`,
    `${labels.credit}: ₹${rupees(summary.creditGivenPaise)}`,
    `${labels.collected}: ₹${rupees(summary.creditCollectedPaise)}`,
    '',
    `${labels.expected}: ₹${rupees(summary.expectedCashPaise)}`,
  ];

  if (countedCashPaise !== null) {
    const diff = countedCashPaise - summary.expectedCashPaise;
    out.push(`${labels.counted}: ₹${rupees(countedCashPaise)}`);
    out.push(`${labels.difference}: ${diff < 0 ? '−' : '+'}₹${rupees(Math.abs(diff))}`);
  }

  return out.join('\n');
}
