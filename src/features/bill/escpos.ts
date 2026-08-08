/**
 * Web Bluetooth + ESC/POS printing (docs/04, Phase 4.1).
 *
 * The ₹1,500–3,000 Bluetooth thermal printers TN shops buy speak ESC/POS.
 * Talking to them directly skips the print dialog entirely — tap Print, paper
 * comes out.
 *
 * THE TAMIL CATCH: cheap ESC/POS printers have no Tamil font in ROM, so
 * sending Tamil as text prints boxes. Instead the whole bill is rendered to a
 * canvas and sent as a RASTER IMAGE (GS v 0). Slower per bill, but correct —
 * and it reuses billToCanvas, which is why that renders at exactly thermal
 * width (384px = 58mm @ 203dpi).
 *
 * Web Bluetooth is Android-Chrome only. iOS Safari has no support and won't,
 * so browser printing (window.print with the 58mm stylesheet) is never removed.
 */

import { billToCanvas } from './billToCanvas';
import type { Bill } from '@/domain/bill';

// Common serial-over-BLE service used by cheap thermal printers.
const PRINTER_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHARACTERISTIC = '00002af1-0000-1000-8000-00805f9b34fb';

/** BLE writes are capped per packet; 512 is safe across the cheap modules. */
const CHUNK_SIZE = 512;

export const isBluetoothPrintingAvailable = (): boolean =>
  typeof navigator !== 'undefined' && 'bluetooth' in navigator;

export async function printViaBluetooth(
  bill: Bill,
  widthMm: 58 | 80,
  copies = 1,
): Promise<void> {
  if (!isBluetoothPrintingAvailable()) {
    throw new Error('Bluetooth printing is not supported on this browser');
  }

  const blob = await billToCanvas(bill, { widthMm });
  const raster = await blobToEscPosRaster(blob);

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [PRINTER_SERVICE] }],
    optionalServices: [PRINTER_SERVICE],
  });

  const server = await device.gatt?.connect();
  if (!server) throw new Error('Could not connect to the printer');

  try {
    const service = await server.getPrimaryService(PRINTER_SERVICE);
    const characteristic = await service.getCharacteristic(PRINTER_CHARACTERISTIC);

    for (let copy = 0; copy < Math.max(1, copies); copy++) {
      const payload = concat([
        new Uint8Array([0x1b, 0x40]), // ESC @ — initialise
        new Uint8Array([0x1b, 0x61, 0x01]), // ESC a 1 — centre
        raster,
        new Uint8Array([0x0a, 0x0a, 0x0a]), // feed clear of the tear bar
        new Uint8Array([0x1d, 0x56, 0x00]), // GS V 0 — full cut
      ]);

      for (let offset = 0; offset < payload.length; offset += CHUNK_SIZE) {
        await characteristic.writeValueWithoutResponse(
          payload.slice(offset, offset + CHUNK_SIZE) as unknown as BufferSource,
        );
        // Cheap modules drop data if written flat out.
        await delay(20);
      }
    }
  } finally {
    server.disconnect();
  }
}

/**
 * PNG -> ESC/POS raster bitmap (GS v 0).
 *
 * Thermal printers are 1-bit: each byte carries 8 horizontal pixels, MSB
 * first, 1 = burn (black).
 */
async function blobToEscPosRaster(blob: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bytesPerRow = Math.ceil(canvas.width / 8);
  const bytes = new Uint8Array(bytesPerRow * canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      // Luminance, then threshold. Anything not near-white burns.
      const luma = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      if (luma < 160) {
        bytes[y * bytesPerRow + (x >> 3)]! |= 0x80 >> (x & 7);
      }
    }
  }

  const header = new Uint8Array([
    0x1d,
    0x76,
    0x30,
    0x00, // GS v 0 m=0 (normal density)
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    canvas.height & 0xff,
    (canvas.height >> 8) & 0xff,
  ]);

  return concat([header, bytes]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
