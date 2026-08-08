import React, { useEffect, useRef, useState } from 'react';
import { Banner, Button, Sheet } from '@/components/ui';
import { IconMic } from '@/components/icons';
import { parseUtterance, scoreProduct } from './tamilNumbers';
import { listProducts } from '@/data/repositories/productRepo';
import { productName, useT } from '@/i18n/useT';
import type { Product } from '@/domain/types';

/**
 * Tamil voice billing (docs/06 §4.2).
 *
 * "இரண்டு கிலோ அரிசி" -> 2 kg of rice into the cart. Uses the Web Speech API
 * with `ta-IN`; unsupported browsers simply don't show the button.
 */
export const isVoiceAvailable = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition,
  );

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export const VoiceSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onPick: (product: Product, qty: number) => void;
}> = ({ open, onClose, onPick }) => {
  const { t, lang } = useT();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [matches, setMatches] = useState<{ product: Product; qty: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (!open) {
      recognition.current?.stop();
      setTranscript('');
      setMatches([]);
      setError(null);
      return;
    }

    if (!isVoiceAvailable()) {
      setError(t('voice.notSupported'));
      return;
    }

    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    // ta-IN handles Tamil; English item names spoken in Tamil sentences still
    // come through, which is why the matcher checks both scripts.
    rec.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript ?? '';
      setTranscript(text);
      void resolve(text);
    };
    rec.onerror = (event) => {
      setError(event.error === 'not-allowed' ? t('scan.permissionDenied') : t('common.error'));
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recognition.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError(t('common.error'));
    }

    return () => rec.stop();
  }, [open, lang, t]);

  const resolve = async (text: string) => {
    const parsed = parseUtterance(text);
    const products = await listProducts();
    const scored = products
      .map((product) => ({ product, score: scoreProduct(product, parsed.term) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    setMatches(
      scored.map(({ product }) => ({
        product,
        // Grams spoken against a per-kg product need converting.
        qty:
          parsed.qty === null
            ? 1
            : parsed.unit === 'g' && product.unit === 'kg'
              ? parsed.qty / 1000
              : parsed.qty,
      })),
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('voice.title')}>
      {error ? (
        <Banner tone="warning">{error}</Banner>
      ) : (
        <>
          <div className="text-center py-6">
            <div
              className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
                listening
                  ? 'bg-brand-primary/15 text-brand-primary dark:text-brand-on-dark animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-700 text-light-text-secondary dark:text-dark-text-secondary'
              }`}
            >
              <IconMic className="w-9 h-9" />
            </div>
            <p className="mt-3 font-medium">
              {listening ? t('voice.listening') : t('voice.hint')}
            </p>
            {transcript && <p className="mt-2 text-lg font-semibold">{transcript}</p>}
          </div>

          {matches.length === 0 && transcript && (
            <p className="text-center text-light-text-secondary dark:text-dark-text-secondary">
              {t('voice.noMatch')}
            </p>
          )}

          <div className="space-y-2">
            {matches.map(({ product, qty }) => (
              <button
                key={product.id}
                onClick={() => {
                  onPick(product, qty);
                  onClose();
                }}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-lg bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700"
              >
                <span className="font-medium truncate">{productName(product, lang)}</span>
                <span className="tnum text-sm flex-shrink-0">
                  {qty} {product.unit}
                </span>
              </button>
            ))}
          </div>

          <Button
            full
            variant="ghost"
            className="mt-4 flex items-center justify-center gap-2"
            onClick={() => {
              recognition.current?.stop();
              try {
                recognition.current?.start();
                setListening(true);
                setTranscript('');
                setMatches([]);
              } catch {
                /* already running */
              }
            }}
          >
            <IconMic className="w-5 h-5" />
            {t('common.retry')}
          </Button>
        </>
      )}
    </Sheet>
  );
};
