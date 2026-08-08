import React, { useEffect, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { useBarcodeScanner } from './useBarcodeScanner';
import { beepSuccess, beepUnknown, primeAudio } from './beep';
import { useT } from '@/i18n/useT';

export interface ScanHit {
  code: string;
  label: string;
  known: boolean;
}

/**
 * Full-screen camera. See docs/03-billing-scanner.md.
 *
 * Continuous by default: a 20-item bill must not require reopening the camera
 * 20 times. The strip along the bottom confirms what went in without closing.
 */
export const ScannerSheet: React.FC<{
  open: boolean;
  continuous: boolean;
  onClose: () => void;
  /** Resolve the code; return a label to show, and whether it was known. */
  onScan: (code: string) => Promise<ScanHit>;
}> = ({ open, continuous, onClose, onScan }) => {
  const { t } = useT();
  const [hits, setHits] = useState<ScanHit[]>([]);
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(false);

  const handle = async (code: string) => {
    const hit = await onScan(code);
    if (hit.known) beepSuccess();
    else beepUnknown();
    setHits((cur) => [hit, ...cur].slice(0, 6));
  };

  const { videoRef, status, torchOn, torchAvailable, toggleTorch } = useBarcodeScanner({
    onScan: (code) => void handle(code),
    continuous,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      primeAudio();
      setHits([]);
      setShowManual(false);
      setManual('');
    }
  }, [open]);

  if (!open) return null;

  const blocked =
    status === 'permission-denied' || status === 'no-camera' || status === 'unsupported';

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col no-print">
      <div className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0">
        <span className="font-semibold">{t('scan.title')}</span>
        <button onClick={onClose} className="px-3 py-1 text-2xl leading-none" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
        />

        {/* Aiming frame */}
        {!blocked && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-4/5 max-w-sm aspect-[3/2] border-2 border-white/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        )}

        {blocked && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div className="text-white space-y-3">
              <p className="text-lg font-semibold">
                {status === 'permission-denied'
                  ? t('scan.permissionDenied')
                  : status === 'unsupported'
                    ? t('scan.notSupported')
                    : t('scan.noCamera')}
              </p>
              <Button onClick={() => setShowManual(true)}>{t('scan.manual')}</Button>
            </div>
          </div>
        )}

        {!blocked && (
          <p className="absolute top-3 inset-x-0 text-center text-white/80 text-sm">
            {t('scan.hint')}
          </p>
        )}
      </div>

      {/* Running strip of what was just scanned */}
      {hits.length > 0 && (
        <div className="flex-shrink-0 max-h-32 overflow-y-auto bg-black/80 px-4 py-2 space-y-1">
          {hits.map((hit, i) => (
            <div
              key={`${hit.code}-${i}`}
              className={`text-sm flex justify-between gap-2 ${
                hit.known ? 'text-green-300' : 'text-amber-300'
              }`}
            >
              <span className="truncate">{hit.label}</span>
              <span className="tnum opacity-60 flex-shrink-0">{hit.code}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex-shrink-0 p-4 pb-safe bg-black flex gap-3">
        {torchAvailable && (
          <Button variant="ghost" onClick={() => void toggleTorch()} className="flex-1">
            {torchOn ? '🔦 ON' : '🔦'} {t('scan.torch')}
          </Button>
        )}
        <Button variant="ghost" onClick={() => setShowManual((s) => !s)} className="flex-1">
          ⌨ {t('scan.manual')}
        </Button>
        <Button onClick={onClose} className="flex-1">
          {t('common.close')}
        </Button>
      </div>

      {/* Faded and torn labels are routine — never trap the user in a camera
          that cannot read. */}
      {showManual && (
        <div className="flex-shrink-0 p-4 pb-safe bg-black flex gap-2">
          <Input
            autoFocus
            inputMode="numeric"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder={t('inv.barcode')}
            className="flex-1 tnum"
          />
          <Button
            onClick={() => {
              if (manual.trim()) void handle(manual.trim());
              setManual('');
            }}
          >
            {t('qty.add')}
          </Button>
        </div>
      )}
    </div>
  );
};
