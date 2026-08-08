/**
 * Barcode helpers. See docs/03-billing-scanner.md.
 *
 * Checksum validation matters: a misread that fails the check digit is
 * discarded silently rather than creating a junk product in the catalogue.
 */

export type BarcodeKind = 'ean13' | 'ean8' | 'upca' | 'code128' | 'qr' | 'unknown';

/** Prefix for labels this shop prints itself (doc 03). */
const QR_PRODUCT_PREFIX = 'kbs:p:';

/** Shared EAN/UPC check digit: weights alternate 1,3 from the right. */
function checkDigit(digits: string): number {
  let sum = 0;
  for (let i = digits.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += Number(digits[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return checkDigit(code.slice(0, 12)) === Number(code[12]);
}

export function isValidEan8(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  return checkDigit(code.slice(0, 7)) === Number(code[7]);
}

export function isValidUpcA(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  return checkDigit(code.slice(0, 11)) === Number(code[11]);
}

export function classifyBarcode(code: string): BarcodeKind {
  if (code.startsWith('kbs:')) return 'qr';
  if (/^\d{13}$/.test(code)) return 'ean13';
  if (/^\d{12}$/.test(code)) return 'upca';
  if (/^\d{8}$/.test(code)) return 'ean8';
  if (/^[\x20-\x7E]+$/.test(code)) return 'code128';
  return 'unknown';
}

/**
 * Accept a scanned code, or reject it as a misread.
 *
 * Non-numeric formats (Code-128, QR) carry no check digit we can verify, so
 * they pass through — the alternative would be rejecting our own shelf labels.
 */
export function isPlausibleBarcode(code: string): boolean {
  const trimmed = code.trim();
  if (trimmed.length < 4) return false;
  switch (classifyBarcode(trimmed)) {
    case 'ean13':
      return isValidEan13(trimmed);
    case 'ean8':
      return isValidEan8(trimmed);
    case 'upca':
      return isValidUpcA(trimmed);
    default:
      return true;
  }
}

/**
 * Detect a QR payload that is marketing/traceability rather than a product id.
 *
 * Most Indian FMCG packs now carry a QR alongside the striped barcode, and it
 * almost never identifies the product. It is usually a campaign URL, and is
 * often **batch- or packet-specific** — meaning a different payload on every
 * single packet. Keying a catalogue entry to one of those would create a new
 * product per packet and never match again.
 *
 * Our own shop-printed labels use the `kbs:p:` prefix and are excluded.
 */
export function looksLikeMarketingQr(code: string): boolean {
  const trimmed = code.trim();
  if (trimmed.startsWith(QR_PRODUCT_PREFIX)) return false;
  if (/^(https?|upi):\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  // Real retail barcodes are at most ~20 characters; long payloads are data,
  // not an identifier.
  if (trimmed.length > 20) return true;
  return false;
}

/** UPC-A is EAN-13 with a leading zero; normalise so one lookup finds both. */
export function normaliseBarcode(code: string): string {
  const trimmed = code.trim();
  if (/^\d{12}$/.test(trimmed) && isValidUpcA(trimmed)) return `0${trimmed}`;
  return trimmed;
}

// ─── Shop-printed QR labels for loose goods ─────────────────────────────────

export const buildProductQrPayload = (productId: string): string =>
  `${QR_PRODUCT_PREFIX}${productId}`;

export const parseProductQrPayload = (payload: string): string | null =>
  payload.startsWith(QR_PRODUCT_PREFIX) ? payload.slice(QR_PRODUCT_PREFIX.length) : null;

// ─── Weight-embedded barcodes (scale-printed labels) ────────────────────────

export interface WeightBarcode {
  itemCode: string;
  /** Weight in kilograms, decoded from the embedded gram count. */
  qtyKg: number;
}

/**
 * Decode a scale-printed label like `2PPPPPWWWWWC`, where the last 5 digits
 * before the check digit are the weight in grams.
 *
 * Encodings vary by scale vendor, so this only runs when the shop has set
 * `settings.scanner.weightBarcodePrefix` — guessing would mis-price goods.
 */
export function parseWeightBarcode(code: string, prefix: string): WeightBarcode | null {
  if (!prefix || !code.startsWith(prefix) || !/^\d{13}$/.test(code)) return null;
  const itemCode = code.slice(0, 7);
  const grams = Number(code.slice(7, 12));
  if (!Number.isFinite(grams) || grams <= 0) return null;
  return { itemCode, qtyKg: grams / 1000 };
}
