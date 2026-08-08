import React, { useMemo, useState } from 'react';
import { Button, Sheet } from '@/components/ui';
import { NumericKeypad, appendDigit, backspace } from '@/components/ui/NumericKeypad';
import { formatINR, lineAmount, parseRupeeInput } from '@/domain/money';
import { productName, unitLabel, useT } from '@/i18n/useT';
import { isFractionalUnit, type Product } from '@/domain/types';

const PRESETS_BY_UNIT: Record<string, { label: string; qty: number }[]> = {
  kg: [
    { label: '100g', qty: 0.1 },
    { label: '250g', qty: 0.25 },
    { label: '500g', qty: 0.5 },
    { label: '1kg', qty: 1 },
    { label: '2kg', qty: 2 },
    { label: '5kg', qty: 5 },
  ],
  litre: [
    { label: '250ml', qty: 0.25 },
    { label: '500ml', qty: 0.5 },
    { label: '1L', qty: 1 },
    { label: '2L', qty: 2 },
  ],
  g: [
    { label: '50g', qty: 50 },
    { label: '100g', qty: 100 },
    { label: '250g', qty: 250 },
  ],
  ml: [
    { label: '100ml', qty: 100 },
    { label: '250ml', qty: 250 },
    { label: '500ml', qty: 500 },
  ],
};

/**
 * Quantity entry for weight/volume items.
 *
 * Supports entering the AMOUNT instead of the weight — "₹50 worth of
 * tomatoes" is how customers actually ask, and doing that arithmetic in your
 * head all day is where mistakes come from.
 */
export const QuantitySheet: React.FC<{
  product: Product | null;
  onClose: () => void;
  onAdd: (qty: number) => void;
}> = ({ product, onClose, onAdd }) => {
  const { t, lang } = useT();
  const [mode, setMode] = useState<'weight' | 'amount'>('weight');
  const [entry, setEntry] = useState('');

  const qty = useMemo(() => {
    if (!product) return 0;
    if (mode === 'weight') return Number(entry) || 0;
    const amountPaise = parseRupeeInput(entry);
    if (!amountPaise || product.sellPricePaise <= 0) return 0;
    // Round to grams so the printed quantity is something a scale can show.
    return Math.round((amountPaise / product.sellPricePaise) * 1000) / 1000;
  }, [entry, mode, product]);

  const amountPaise = product ? lineAmount(qty, product.sellPricePaise) : 0;

  const reset = () => {
    setEntry('');
    setMode('weight');
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (qty <= 0) return;
    onAdd(qty);
    reset();
  };

  if (!product) return null;
  const presets = PRESETS_BY_UNIT[product.unit] ?? [];

  return (
    <Sheet open={Boolean(product)} onClose={close} title={t('qty.title')}>
      <div className="text-center mb-4">
        <p className="text-lg font-bold">{productName(product, lang)}</p>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
          {formatINR(product.sellPricePaise)} / {unitLabel(product.unit, lang)}
        </p>
      </div>

      {isFractionalUnit(product.unit) && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {(['weight', 'amount'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setEntry('');
              }}
              className={`py-2 rounded-lg border-2 font-medium text-sm ${
                mode === m
                  ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:text-brand-on-dark'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              {m === 'weight' ? t('qty.byWeight') : t('qty.byAmount')}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-lg bg-slate-100 dark:bg-slate-700 px-4 py-4 text-center mb-3">
        <span className="text-3xl font-bold tnum">
          {mode === 'amount' && entry ? '₹' : ''}
          {entry || '0'}
        </span>
        <span className="ml-2 text-light-text-secondary dark:text-dark-text-secondary">
          {mode === 'weight' ? unitLabel(product.unit, lang) : ''}
        </span>
      </div>

      {mode === 'weight' && presets.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => setEntry(String(p.qty))}
              className="px-3 py-1.5 text-sm rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <NumericKeypad
        onDigit={(d) => setEntry((cur) => appendDigit(cur, d))}
        onBackspace={() => setEntry(backspace)}
      />

      <div className="mt-4 flex items-center justify-between">
        <span className="text-light-text-secondary dark:text-dark-text-secondary">
          {mode === 'amount' && qty > 0 && `${qty} ${unitLabel(product.unit, lang)}`}
        </span>
        <span className="text-2xl font-bold tnum">{formatINR(amountPaise)}</span>
      </div>

      <Button full className="mt-4" onClick={submit} disabled={qty <= 0}>
        {t('qty.add')}
      </Button>
    </Sheet>
  );
};
