/**
 * Barcode + QR scanning. See docs/03-billing-scanner.md.
 *
 * Engine selection, in order:
 *   1. Native `BarcodeDetector` — built into Chrome on Android, which is what
 *      most target devices run. Fast, hardware-accelerated, zero bundle cost.
 *   2. ZXing WASM — for iOS Safari and desktop Firefox, which have no
 *      BarcodeDetector. Loaded LAZILY so it never sits in the main bundle.
 *
 * Both barcodes and QR are decoded in one camera view: Indian products carry
 * EAN-13, while QR covers the shop's own printed labels for loose goods.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isPlausibleBarcode } from '@/domain/barcode';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] as const;

/** Holding one packet in frame otherwise registers the same code repeatedly. */
const DUPLICATE_WINDOW_MS = 1500;

export type ScannerStatus =
  'idle' | 'starting' | 'scanning' | 'permission-denied' | 'no-camera' | 'unsupported' | 'error';

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorLike;
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

/** Native detector, or null when this browser has none (then ZXing is used). */
async function createNativeDetector(): Promise<BarcodeDetectorLike | null> {
  if (typeof window === 'undefined' || !window.BarcodeDetector) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = FORMATS.filter((f) => supported.includes(f));
    if (formats.length === 0) return null;
    return new window.BarcodeDetector({ formats });
  } catch {
    return null;
  }
}

export interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  continuous: boolean;
  enabled: boolean;
}

export function useBarcodeScanner({ onScan, continuous, enabled }: UseBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSeen = useRef<Map<string, number>>(new Map());
  const zxingRef = useRef<{ reader: unknown; canvas: HTMLCanvasElement } | null>(null);

  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const handleCode = useCallback((raw: string) => {
    const code = raw.trim();
    // A misread that fails its check digit is discarded silently — better
    // than creating a junk product in the catalogue.
    if (!isPlausibleBarcode(code)) return;

    const now = Date.now();
    const previous = lastSeen.current.get(code);
    if (previous && now - previous < DUPLICATE_WINDOW_MS) return;
    lastSeen.current.set(code, now);

    onScanRef.current(code);
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    zxingRef.current = null;
    setStatus('idle');
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }, [torchOn]);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    let cancelled = false;

    const start = async () => {
      setStatus('starting');

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('no-camera');
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (err) {
        const name = (err as Error)?.name;
        // Distinguish "you said no" from "there is no camera" — the recovery
        // instructions are completely different.
        setStatus(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'permission-denied'
            : 'no-camera',
        );
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play().catch(() => undefined);

      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
      setTorchAvailable(Boolean(capabilities?.torch));

      const detector = await createNativeDetector();
      const useZxing = detector === null;

      if (useZxing) {
        // Lazy import: keeps the WASM decoder out of the main bundle for the
        // majority of devices that have the native API.
        try {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          zxingRef.current = {
            reader: new BrowserMultiFormatReader(),
            canvas: document.createElement('canvas'),
          };
        } catch {
          setStatus('unsupported');
          return;
        }
      }

      if (cancelled) return;
      setStatus('scanning');

      const tick = async () => {
        if (cancelled || !videoRef.current) return;
        const el = videoRef.current;

        if (el.readyState === el.HAVE_ENOUGH_DATA) {
          try {
            if (!useZxing && detector) {
              const results = await detector.detect(el);
              for (const r of results) handleCode(r.rawValue);
              if (results.length > 0 && !continuous) {
                stop();
                return;
              }
            } else if (zxingRef.current) {
              const { reader, canvas } = zxingRef.current as {
                reader: { decodeFromCanvas: (c: HTMLCanvasElement) => { getText(): string } };
                canvas: HTMLCanvasElement;
              };
              canvas.width = el.videoWidth;
              canvas.height = el.videoHeight;
              const ctx2d = canvas.getContext('2d');
              if (ctx2d && canvas.width > 0) {
                ctx2d.drawImage(el, 0, 0);
                try {
                  const result = reader.decodeFromCanvas(canvas);
                  if (result) {
                    handleCode(result.getText());
                    if (!continuous) {
                      stop();
                      return;
                    }
                  }
                } catch {
                  /* NotFoundException every frame without a code — expected */
                }
              }
            }
          } catch {
            /* transient decode failure; keep scanning */
          }
        }

        rafRef.current = requestAnimationFrame(() => void tick());
      };

      rafRef.current = requestAnimationFrame(() => void tick());
    };

    void start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, continuous, handleCode, stop]);

  return { videoRef, status, torchOn, torchAvailable, toggleTorch, stop };
}
