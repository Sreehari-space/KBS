/**
 * The Bill model. See docs/04-bill-print-whatsapp.md.
 *
 * Layout is decided ONCE here, then four renderers format an already-decided
 * structure: 58mm HTML (screen + print), plain text (WhatsApp), canvas PNG
 * (WhatsApp image), and ESC/POS bytes (Bluetooth). They can never drift apart.
 */

import { formatAmount, formatQty } from './money';
import type { Language, Paise, Sale, Settings } from './types';

export interface BillLine {
  name: string;
  /** "2 kg × 58.00" */
  qtyLabel: string;
  amountLabel: string;
}

export interface BillTotalRow {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface BillCreditBlock {
  previousBalance: string;
  thisBill: string;
  newBalance: string;
}

export interface Bill {
  header: {
    shopName: string;
    addressLines: string[];
    phone: string;
    gstin?: string;
  };
  meta: {
    billNo: string;
    dateTime: string;
    customerName?: string;
    customerPhone?: string;
  };
  lines: BillLine[];
  totals: BillTotalRow[];
  payments: BillTotalRow[];
  credit?: BillCreditBlock;
  savings?: string;
  upiQrPayload?: string;
  footerLines: string[];
}

const UNIT_SHORT: Record<string, [string, string]> = {
  piece: ['pc', 'எண்'],
  packet: ['pkt', 'பாக்'],
  kg: ['kg', 'கிலோ'],
  g: ['g', 'கி'],
  litre: ['L', 'லி'],
  ml: ['ml', 'மி.லி'],
};

const L = {
  subtotal: ['Subtotal', 'கூட்டுத்தொகை'],
  discount: ['Discount', 'தள்ளுபடி'],
  gst: ['GST', 'ஜி.எஸ்.டி'],
  roundOff: ['Round off', 'ரவுண்ட்'],
  total: ['TOTAL', 'மொத்தம்'],
  cash: ['Cash', 'ரொக்கம்'],
  upi: ['UPI', 'யுபிஐ'],
  card: ['Card', 'கார்டு'],
  credit: ['Credit', 'கடன்'],
  billNo: ['Bill', 'பில்'],
  customer: ['Customer', 'வாடிக்கையாளர்'],
  savings: ['You saved', 'நீங்கள் மிச்சம்'],
  prevDue: ['Previous due', 'பழைய கடன்'],
  thisBill: ['This bill', 'இந்த பில்'],
  totalDue: ['Total due', 'மொத்த கடன்'],
  scanToPay: ['Scan to pay', 'ஸ்கேன் செய்து செலுத்து'],
} as const;

const pick = (pair: readonly [string, string], lang: Language) =>
  lang === 'ta' ? pair[1] : pair[0];

/** UPI deep link. Generated locally — never fetched from a QR web service. */
export function buildUpiPayload(
  vpa: string,
  payeeName: string,
  amountPaise: Paise,
  note: string,
): string {
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: (amountPaise / 100).toFixed(2),
    cu: 'INR',
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

export function buildBill(
  sale: Sale,
  settings: Settings,
  opts: {
    lang: Language;
    customer?: { name: string; phone: string; balancePaise: Paise } | undefined;
  },
): Bill {
  const { lang, customer } = opts;

  const shopName =
    lang === 'ta' && settings.shop.nameTa.trim() ? settings.shop.nameTa : settings.shop.nameEn;

  const lines: BillLine[] = sale.lines.map((line) => {
    // An empty Tamil name must never render as a blank row on a bill.
    const name = lang === 'ta' && line.nameTa.trim() ? line.nameTa : line.nameEn;
    const unit = UNIT_SHORT[line.unit]?.[lang === 'ta' ? 1 : 0] ?? line.unit;
    return {
      name,
      qtyLabel: `${formatQty(line.qty)} ${unit} × ${formatAmount(line.unitPricePaise)}`,
      amountLabel: formatAmount(line.lineTotalPaise),
    };
  });

  const totals: BillTotalRow[] = [
    { label: pick(L.subtotal, lang), value: formatAmount(sale.subtotalPaise) },
  ];
  if (sale.billDiscountPaise > 0) {
    totals.push({
      label: pick(L.discount, lang),
      value: `-${formatAmount(sale.billDiscountPaise)}`,
    });
  }
  if (sale.taxPaise > 0) {
    totals.push({ label: pick(L.gst, lang), value: formatAmount(sale.taxPaise) });
  }
  // Silent rounding causes arguments — always show it when non-zero.
  if (sale.roundOffPaise !== 0) {
    totals.push({
      label: pick(L.roundOff, lang),
      value: `${sale.roundOffPaise > 0 ? '+' : '-'}${formatAmount(Math.abs(sale.roundOffPaise))}`,
    });
  }
  totals.push({ label: pick(L.total, lang), value: formatAmount(sale.totalPaise), emphasis: true });

  const payments: BillTotalRow[] = sale.payments.map((p) => ({
    label: pick(L[p.mode], lang),
    value: formatAmount(p.amountPaise),
  }));
  if (sale.creditPaise > 0) {
    payments.push({ label: pick(L.credit, lang), value: formatAmount(sale.creditPaise) });
  }

  const lineDiscounts = sale.lines.reduce((sum, l) => sum + l.lineDiscountPaise, 0);
  const totalSaved = lineDiscounts + sale.billDiscountPaise;

  const bill: Bill = {
    header: {
      shopName,
      addressLines: settings.shop.addressLines,
      phone: settings.shop.phone,
      ...(settings.gst.enabled && settings.gst.gstin ? { gstin: settings.gst.gstin } : {}),
    },
    meta: {
      billNo: sale.billNo,
      dateTime: new Date(sale.createdAt).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-IN'),
      ...(customer ? { customerName: customer.name, customerPhone: customer.phone } : {}),
    },
    lines,
    totals,
    payments,
    footerLines: [
      lang === 'ta' ? settings.billing.footerLineTa : settings.billing.footerLineEn,
    ].filter(Boolean),
  };

  if (settings.billing.showSavings && totalSaved > 0) {
    bill.savings = `${pick(L.savings, lang)}: ${formatAmount(totalSaved)}`;
  }

  // The number a credit customer actually needs.
  if (sale.creditPaise > 0 && customer) {
    const previous = customer.balancePaise - sale.creditPaise;
    bill.credit = {
      previousBalance: `${pick(L.prevDue, lang)}  ${formatAmount(previous)}`,
      thisBill: `${pick(L.thisBill, lang)}  ${formatAmount(sale.creditPaise)}`,
      newBalance: `${pick(L.totalDue, lang)}  ${formatAmount(customer.balancePaise)}`,
    };
  }

  if (settings.billing.printUpiQr && settings.shop.upiVpa) {
    bill.upiQrPayload = buildUpiPayload(
      settings.shop.upiVpa,
      settings.shop.upiPayeeName || settings.shop.nameEn,
      sale.totalPaise,
      `Bill ${sale.billNo}`,
    );
  }

  return bill;
}

export const billLabels = { pick, L };
