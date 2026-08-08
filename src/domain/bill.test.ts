import { describe, expect, it } from 'vitest';
import { buildBill, buildUpiPayload } from './bill';
import { defaultSettings } from '@/data/repositories/settingsRepo';
import type { Sale, Settings } from './types';

const settings = (over: Partial<Settings> = {}): Settings => ({
  ...defaultSettings,
  ...over,
  shop: { ...defaultSettings.shop, nameEn: 'KBS Stores', nameTa: 'கே.பி.எஸ். ஸ்டோர்ஸ்', ...over.shop },
  billing: { ...defaultSettings.billing, ...over.billing },
  gst: { ...defaultSettings.gst, ...over.gst },
});

const sale = (over: Partial<Sale> = {}): Sale => ({
  id: 's1',
  billNo: '080826-014',
  createdAt: '2026-08-08T08:20:00.000Z',
  lines: [
    {
      productId: 'p1',
      nameEn: 'Ponni Rice',
      nameTa: 'பொன்னி அரிசி',
      unit: 'kg',
      qty: 5,
      unitPricePaise: 5800,
      lineDiscountPaise: 0,
      lineTotalPaise: 29000,
    },
  ],
  subtotalPaise: 29000,
  billDiscountPaise: 0,
  taxPaise: 0,
  roundOffPaise: 0,
  totalPaise: 29000,
  payments: [{ mode: 'cash', amountPaise: 29000 }],
  creditPaise: 0,
  status: 'completed',
  ...over,
});

describe('buildBill', () => {
  it('uses the Tamil shop and item names when the language is Tamil', () => {
    const bill = buildBill(sale(), settings(), { lang: 'ta', customer: undefined });
    expect(bill.header.shopName).toBe('கே.பி.எஸ். ஸ்டோர்ஸ்');
    expect(bill.lines[0]!.name).toBe('பொன்னி அரிசி');
  });

  it('falls back to English when a Tamil name is empty', () => {
    // An empty nameTa must never render as a blank row on a printed bill.
    const s = sale();
    s.lines[0]!.nameTa = '';
    const bill = buildBill(s, settings(), { lang: 'ta', customer: undefined });
    expect(bill.lines[0]!.name).toBe('Ponni Rice');
  });

  it('formats the quantity line as qty x rate', () => {
    const bill = buildBill(sale(), settings(), { lang: 'en', customer: undefined });
    expect(bill.lines[0]!.qtyLabel).toBe('5 kg × 58.00');
    expect(bill.lines[0]!.amountLabel).toBe('290.00');
  });

  it('shows the round-off row when non-zero, and hides it at zero', () => {
    const withRound = buildBill(
      sale({ roundOffPaise: -40, totalPaise: 28960 }),
      settings(),
      { lang: 'en', customer: undefined },
    );
    expect(withRound.totals.some((r) => r.label === 'Round off')).toBe(true);

    const noRound = buildBill(sale(), settings(), { lang: 'en', customer: undefined });
    expect(noRound.totals.some((r) => r.label === 'Round off')).toBe(false);
  });

  it('omits GSTIN when GST mode is off', () => {
    const bill = buildBill(sale(), settings({ gst: { ...defaultSettings.gst, gstin: '33AAAAA0000A1Z5' } }), {
      lang: 'en',
      customer: undefined,
    });
    expect(bill.header.gstin).toBeUndefined();
  });

  it('includes GSTIN when GST mode is on', () => {
    const bill = buildBill(
      sale(),
      settings({ gst: { ...defaultSettings.gst, enabled: true, gstin: '33AAAAA0000A1Z5' } }),
      { lang: 'en', customer: undefined },
    );
    expect(bill.header.gstin).toBe('33AAAAA0000A1Z5');
  });

  it('shows savings only when a discount was actually given', () => {
    const plain = buildBill(sale(), settings(), { lang: 'en', customer: undefined });
    expect(plain.savings).toBeUndefined();

    const discounted = buildBill(
      sale({ billDiscountPaise: 1000, totalPaise: 28000 }),
      settings(),
      { lang: 'en', customer: undefined },
    );
    expect(discounted.savings).toContain('10.00');
  });

  it('builds the credit block from the customer balance AFTER the sale', () => {
    // The customer's stored balance already includes this bill's credit, so
    // the "previous due" line has to subtract it back out.
    const bill = buildBill(
      sale({ creditPaise: 20000, payments: [{ mode: 'cash', amountPaise: 9000 }] }),
      settings(),
      {
        lang: 'en',
        customer: { name: 'Raja', phone: '9876543210', balancePaise: 168540 },
      },
    );
    expect(bill.credit?.previousBalance).toContain('1,485.40');
    expect(bill.credit?.thisBill).toContain('200.00');
    expect(bill.credit?.newBalance).toContain('1,685.40');
  });

  it('omits the UPI QR when no VPA is configured', () => {
    // Otherwise the QR would point at a placeholder and send money to a stranger.
    const bill = buildBill(sale(), settings(), { lang: 'en', customer: undefined });
    expect(bill.upiQrPayload).toBeUndefined();
  });

  it('includes the UPI QR when a VPA is set', () => {
    const bill = buildBill(
      sale(),
      settings({ shop: { ...defaultSettings.shop, upiVpa: 'shop@okaxis' } }),
      { lang: 'en', customer: undefined },
    );
    expect(bill.upiQrPayload).toContain('pa=shop%40okaxis');
    expect(bill.upiQrPayload).toContain('am=290.00');
  });
});

describe('buildUpiPayload', () => {
  it('builds a valid UPI deep link with the amount in rupees', () => {
    const payload = buildUpiPayload('shop@okaxis', 'KBS Stores', 43540, 'Bill 080826-014');
    expect(payload.startsWith('upi://pay?')).toBe(true);
    expect(payload).toContain('am=435.40');
    expect(payload).toContain('cu=INR');
  });
});
