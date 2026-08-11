/**
 * Bill -> PNG, for sharing an image to WhatsApp (Tier B, docs/04).
 *
 * A text bill is functional; an image bill looks like a real receipt and gets
 * forwarded. Drawn with a plain canvas rather than html2canvas/dom-to-image:
 * those are heavy, render Tamil unreliably, and we already hold the Bill in a
 * form that is easy to draw.
 *
 * 384px wide = 58mm at 203 dpi, which is exactly a thermal printer's raster
 * width — so Phase 4's ESC/POS path reuses this same canvas.
 */

import QRCode from 'qrcode';
import type { Bill } from '@/domain/bill';

const WIDTH_384 = 384;
const WIDTH_576 = 576; // 80mm at 203 dpi

interface DrawContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  pad: number;
  y: number;
}

const FONT = (size: number, bold = false) =>
  `${bold ? 'bold ' : ''}${size}px "Noto Sans Tamil", monospace`;

export async function billToCanvas(bill: Bill, opts: { widthMm?: 58 | 80 } = {}): Promise<Blob> {
  const width = opts.widthMm === 80 ? WIDTH_576 : WIDTH_384;
  const pad = 12;

  // Fonts must be ready or Tamil falls back mid-draw and the metrics shift.
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const qrDataUrl = bill.upiQrPayload
    ? await QRCode.toDataURL(bill.upiQrPayload, { margin: 1, width: Math.floor(width * 0.5) })
    : null;
  const qrImage = qrDataUrl ? await loadImage(qrDataUrl) : null;

  // Two passes: measure with a throwaway context, then draw at the real height.
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) throw new Error('Canvas unavailable');
  const height = layout({ ctx: measure, width, pad, y: 0 }, bill, qrImage, false);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  layout({ ctx, width, pad, y: 0 }, bill, qrImage, true);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not render bill image'))),
      'image/png',
    );
  });
}

/** Runs twice: once to measure the height, once to actually paint. */
function layout(
  d: DrawContext,
  bill: Bill,
  qrImage: HTMLImageElement | null,
  paint: boolean,
): number {
  const { ctx, width, pad } = d;
  let y = pad;

  const centre = (text: string, size: number, bold = false) => {
    ctx.font = FONT(size, bold);
    if (paint) {
      const w = ctx.measureText(text).width;
      ctx.fillText(text, (width - w) / 2, y);
    }
    y += size * 1.35;
  };

  const left = (text: string, size: number, bold = false) => {
    ctx.font = FONT(size, bold);
    if (paint) ctx.fillText(text, pad, y);
    y += size * 1.35;
  };

  const row = (labelText: string, valueText: string, size: number, bold = false) => {
    ctx.font = FONT(size, bold);
    if (paint) {
      ctx.fillText(labelText, pad, y);
      // Amounts are right-aligned in a fixed column — misaligned amounts are
      // the main reason a printed bill looks amateur.
      const w = ctx.measureText(valueText).width;
      ctx.fillText(valueText, width - pad - w, y);
    }
    y += size * 1.35;
  };

  const rule = (dashed = true) => {
    if (paint) {
      ctx.save();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      if (dashed) ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pad, y + 4);
      ctx.lineTo(width - pad, y + 4);
      ctx.stroke();
      ctx.restore();
    }
    y += 12;
  };

  centre(bill.header.shopName, 20, true);
  for (const line of bill.header.addressLines) centre(line, 12);
  if (bill.header.phone) centre(bill.header.phone, 12);
  if (bill.header.gstin) centre(`GSTIN: ${bill.header.gstin}`, 12);

  rule();
  left(bill.meta.billNo, 13);
  left(bill.meta.dateTime, 12);
  if (bill.meta.customerName) {
    left(`${bill.meta.customerName} ${bill.meta.customerPhone ?? ''}`.trim(), 12);
  }
  rule();

  for (const line of bill.lines) {
    left(line.name, 14);
    row(`  ${line.qtyLabel}`, line.amountLabel, 13);
  }

  rule();
  for (const total of bill.totals) {
    if (total.emphasis) rule(false);
    row(total.label, total.value, total.emphasis ? 19 : 13, total.emphasis);
  }

  if (bill.payments.length > 0) {
    rule();
    for (const payment of bill.payments) row(payment.label, payment.value, 13);
  }

  if (bill.savings) {
    y += 4;
    centre(bill.savings, 14, true);
  }

  if (bill.credit) {
    rule();
    left(bill.credit.previousBalance, 13);
    left(bill.credit.thisBill, 13);
    left(bill.credit.newBalance, 14, true);
  }

  if (qrImage) {
    rule();
    const size = Math.floor(width * 0.5);
    if (paint) ctx.drawImage(qrImage, (width - size) / 2, y, size, size);
    y += size + 6;
  }

  rule();
  for (const footer of bill.footerLines) centre(footer, 13);

  return y + pad;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('QR render failed'));
    img.src = src;
  });
}

/** Share the bill image through the OS sheet; falls back to a download. */
export async function shareBillImage(bill: Bill, blob: Blob): Promise<boolean> {
  const file = new File([blob], `bill-${bill.meta.billNo}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Bill ${bill.meta.billNo}` });
      return true;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return false;
}
