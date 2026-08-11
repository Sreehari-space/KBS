/**
 * Bill -> plain text, for the wa.me link (Tier A, docs/04).
 *
 * Wrapped in a ``` code block so WhatsApp renders it monospaced and the
 * amount column stays aligned. Tamil passes through fine — WhatsApp handles
 * Unicode correctly.
 */

import type { Bill } from '@/domain/bill';

/** 58mm thermal paper is about 32 monospace characters wide. */
const WIDTH = 32;
/** WhatsApp truncates very long messages; leave headroom for the URL encoding. */
const MAX_CHARS = 3800;

const centre = (text: string) => {
  const pad = Math.max(0, Math.floor((WIDTH - text.length) / 2));
  return ' '.repeat(pad) + text;
};

const row = (left: string, right: string) => {
  const space = Math.max(1, WIDTH - left.length - right.length);
  return left + ' '.repeat(space) + right;
};

const rule = (char = '-') => char.repeat(WIDTH);

export function billToText(bill: Bill): string {
  const out: string[] = [];

  out.push(centre(bill.header.shopName));
  for (const line of bill.header.addressLines) out.push(centre(line));
  if (bill.header.phone) out.push(centre(bill.header.phone));
  if (bill.header.gstin) out.push(centre(`GSTIN: ${bill.header.gstin}`));

  out.push(rule());
  out.push(`${bill.meta.billNo}`);
  out.push(bill.meta.dateTime);
  if (bill.meta.customerName) {
    out.push(`${bill.meta.customerName} ${bill.meta.customerPhone ?? ''}`.trim());
  }
  out.push(rule());

  for (const line of bill.lines) {
    out.push(line.name);
    out.push(row(`  ${line.qtyLabel}`, line.amountLabel));
  }

  out.push(rule());
  for (const total of bill.totals) {
    out.push(total.emphasis ? rule('=') : '');
    out.push(row(total.label, total.value));
  }

  if (bill.payments.length > 0) {
    out.push(rule());
    for (const payment of bill.payments) out.push(row(payment.label, payment.value));
  }

  if (bill.savings) {
    out.push('');
    out.push(centre(bill.savings));
  }

  if (bill.credit) {
    out.push(rule());
    out.push(bill.credit.previousBalance);
    out.push(bill.credit.thisBill);
    out.push(bill.credit.newBalance);
  }

  out.push(rule());
  for (const footer of bill.footerLines) out.push(centre(footer));

  const body = out.filter((line) => line !== undefined).join('\n');
  const trimmed = body.length > MAX_CHARS ? `${body.slice(0, MAX_CHARS)}\n…` : body;

  return '```\n' + trimmed + '\n```';
}

/** wa.me deep link. Phone must already carry the 91 country code. */
export function whatsAppLink(phoneWithCountryCode: string, text: string): string {
  return `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(text)}`;
}

/** Share without a specific recipient — the user picks in WhatsApp. */
export function whatsAppShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
