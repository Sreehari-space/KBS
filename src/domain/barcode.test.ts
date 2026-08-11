import { describe, expect, it } from 'vitest';
import {
  buildProductQrPayload,
  classifyBarcode,
  isPlausibleBarcode,
  isValidEan13,
  isValidEan8,
  looksLikeMarketingQr,
  normaliseBarcode,
  parseProductQrPayload,
  parseWeightBarcode,
} from './barcode';

describe('isValidEan13', () => {
  it('accepts real Indian FMCG barcodes', () => {
    // 890 is the GS1 India prefix.
    expect(isValidEan13('8901058000023')).toBe(true);
    expect(isValidEan13('8901030865275')).toBe(true);
    expect(isValidEan13('8901000000002')).toBe(true);
  });

  it('rejects a wrong check digit — this is the misread guard', () => {
    expect(isValidEan13('8901058000024')).toBe(false);
  });

  it('rejects wrong lengths and non-digits', () => {
    expect(isValidEan13('890105800002')).toBe(false);
    expect(isValidEan13('89010580000AB')).toBe(false);
  });
});

describe('isValidEan8', () => {
  it('validates the check digit', () => {
    expect(isValidEan8('96385074')).toBe(true);
    expect(isValidEan8('96385075')).toBe(false);
  });
});

describe('classifyBarcode', () => {
  it('identifies formats by shape', () => {
    expect(classifyBarcode('8901058000023')).toBe('ean13');
    expect(classifyBarcode('96385074')).toBe('ean8');
    expect(classifyBarcode('036000291452')).toBe('upca');
    expect(classifyBarcode('kbs:p:abc-123')).toBe('qr');
    expect(classifyBarcode('LOOSE-RICE-01')).toBe('code128');
  });
});

describe('isPlausibleBarcode', () => {
  it('discards numeric misreads', () => {
    expect(isPlausibleBarcode('8901058000024')).toBe(false);
  });

  it('passes valid numeric codes', () => {
    expect(isPlausibleBarcode('8901058000023')).toBe(true);
  });

  it('passes formats that carry no check digit, including our own QR labels', () => {
    expect(isPlausibleBarcode('kbs:p:abc-123')).toBe(true);
    expect(isPlausibleBarcode('LOOSE-RICE-01')).toBe(true);
  });

  it('rejects noise that is too short to be a code', () => {
    expect(isPlausibleBarcode('12')).toBe(false);
    expect(isPlausibleBarcode('')).toBe(false);
  });
});

describe('normaliseBarcode', () => {
  it('pads a valid UPC-A to EAN-13 so one lookup finds both', () => {
    expect(normaliseBarcode('036000291452')).toBe('0036000291452');
  });

  it('leaves EAN-13 untouched', () => {
    expect(normaliseBarcode('8901058000023')).toBe('8901058000023');
  });
});

describe('shop-printed QR labels', () => {
  it('round-trips a product id', () => {
    const payload = buildProductQrPayload('prod-42');
    expect(payload).toBe('kbs:p:prod-42');
    expect(parseProductQrPayload(payload)).toBe('prod-42');
  });

  it('ignores unrelated QR payloads', () => {
    expect(parseProductQrPayload('https://example.com')).toBeNull();
    expect(parseProductQrPayload('upi://pay?pa=x@y')).toBeNull();
  });
});

describe('parseWeightBarcode', () => {
  it('decodes embedded grams to kilograms', () => {
    // Layout: 7 item digits "2001230" + 5 weight digits "01500" + check digit.
    const parsed = parseWeightBarcode('2001230015008', '2');
    expect(parsed?.qtyKg).toBe(1.5);
    expect(parsed?.itemCode).toBe('2001230');
  });

  it('is disabled when the shop has not configured a prefix', () => {
    // Guessing the encoding would mis-price goods, so no prefix = no parsing.
    expect(parseWeightBarcode('2001230015008', '')).toBeNull();
  });

  it('ignores codes that do not carry the prefix', () => {
    expect(parseWeightBarcode('8901058000023', '2')).toBeNull();
  });

  it('rejects a zero weight', () => {
    expect(parseWeightBarcode('2001230000008', '2')).toBeNull();
  });
});

describe('looksLikeMarketingQr', () => {
  it('flags campaign URLs printed on FMCG packs', () => {
    // The Britannia case: the QR on the wrapper is a website, not a product id.
    expect(looksLikeMarketingQr('https://britannia.co.in/promo')).toBe(true);
    expect(looksLikeMarketingQr('http://example.com')).toBe(true);
    expect(looksLikeMarketingQr('www.example.com')).toBe(true);
  });

  it('flags long payloads, which are data rather than an identifier', () => {
    // Batch/serial QR codes differ on every packet; keying a product to one
    // would create a new product per packet and never match again.
    expect(looksLikeMarketingQr('01089012345678901721123110ABCD1234')).toBe(true);
  });

  it('does NOT flag real retail barcodes', () => {
    expect(looksLikeMarketingQr('8901058000023')).toBe(false);
    expect(looksLikeMarketingQr('96385074')).toBe(false);
  });

  it("does NOT flag the shop's own printed labels", () => {
    expect(looksLikeMarketingQr(buildProductQrPayload('prod-42'))).toBe(false);
  });

  it('does not flag a short in-house code', () => {
    expect(looksLikeMarketingQr('LOOSE-RICE-01')).toBe(false);
  });
});
