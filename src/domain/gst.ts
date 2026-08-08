/**
 * GST calculation. See docs/02-data-model.md.
 *
 * Two things that are easy to get backwards and expensive to get wrong:
 *
 * 1. Indian retail quotes MRP INCLUSIVE of GST. When `pricesIncludeTax` is
 *    true the tax is EXTRACTED from the price, not added on top. Adding it
 *    would inflate every bill by the slab rate.
 * 2. Intra-state sales (the normal case for a single shop) split the tax into
 *    equal CGST and SGST halves. A 18% slab is 9% + 9%.
 */

import type { GstSlab, Paise, SaleLine } from './types';

export const GST_SLABS: readonly GstSlab[] = [0, 5, 12, 18, 28];

export interface GstBreakdownRow {
  slab: GstSlab;
  /** Value of goods excluding tax. */
  taxablePaise: Paise;
  cgstPaise: Paise;
  sgstPaise: Paise;
  totalTaxPaise: Paise;
}

export interface GstResult {
  rows: GstBreakdownRow[];
  totalTaxPaise: Paise;
  /** Sum of taxable values — the bill's pre-tax worth. */
  totalTaxablePaise: Paise;
}

/**
 * Extract tax from a tax-inclusive amount.
 * ₹118 at 18% -> taxable ₹100, tax ₹18.
 */
export function extractTax(inclusivePaise: Paise, slab: GstSlab): { taxable: Paise; tax: Paise } {
  if (slab === 0) return { taxable: inclusivePaise, tax: 0 };
  const taxable = Math.round((inclusivePaise * 100) / (100 + slab));
  return { taxable, tax: inclusivePaise - taxable };
}

/** Add tax on top of a tax-exclusive amount. ₹100 at 18% -> tax ₹18. */
export function addTax(exclusivePaise: Paise, slab: GstSlab): { taxable: Paise; tax: Paise } {
  if (slab === 0) return { taxable: exclusivePaise, tax: 0 };
  return { taxable: exclusivePaise, tax: Math.round((exclusivePaise * slab) / 100) };
}

/**
 * Group lines by slab and compute the CGST/SGST split.
 *
 * `enabled: false` returns an empty result, which is the default for shops
 * below the registration threshold (D6).
 */
export function computeGst(
  lines: readonly SaleLine[],
  opts: { enabled: boolean; pricesIncludeTax: boolean },
): GstResult {
  if (!opts.enabled) {
    return { rows: [], totalTaxPaise: 0, totalTaxablePaise: 0 };
  }

  const bySlab = new Map<GstSlab, Paise>();
  for (const line of lines) {
    const slab = (line.gstSlab ?? 0) as GstSlab;
    bySlab.set(slab, (bySlab.get(slab) ?? 0) + line.lineTotalPaise);
  }

  const rows: GstBreakdownRow[] = [];
  for (const [slab, amount] of [...bySlab.entries()].sort((a, b) => a[0] - b[0])) {
    const { taxable, tax } = opts.pricesIncludeTax
      ? extractTax(amount, slab)
      : addTax(amount, slab);

    // CGST and SGST are equal halves. The odd paise (when tax is odd) goes to
    // CGST so the two halves still sum exactly to the total tax.
    const half = Math.floor(tax / 2);
    rows.push({
      slab,
      taxablePaise: taxable,
      cgstPaise: tax - half,
      sgstPaise: half,
      totalTaxPaise: tax,
    });
  }

  return {
    rows,
    totalTaxPaise: rows.reduce((a, r) => a + r.totalTaxPaise, 0),
    totalTaxablePaise: rows.reduce((a, r) => a + r.taxablePaise, 0),
  };
}

/** Basic GSTIN shape check: 2-digit state + 10-char PAN + 3 chars. */
export function isValidGstinFormat(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.toUpperCase());
}
