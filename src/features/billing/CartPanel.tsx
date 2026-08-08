import React from 'react';
import { EmptyState } from '@/components/ui';
import { formatINR, formatQty } from '@/domain/money';
import type { CartTotals } from '@/domain/cart';
import { unitLabel, useT } from '@/i18n/useT';
import { isFractionalUnit, type SaleLine } from '@/domain/types';

export const CartPanel: React.FC<{
  lines: SaleLine[];
  totals: CartTotals;
  onChangeQty: (index: number, qty: number) => void;
  onRemove: (index: number) => void;
}> = ({ lines, totals, onChangeQty, onRemove }) => {
  const { t, lang } = useT();

  if (lines.length === 0) {
    return <EmptyState title={t('billing.cartEmpty')} hint={t('billing.cartEmptyHint')} />;
  }

  return (
    <div>
      <div className="space-y-2">
        {lines.map((line, index) => {
          // Weight lines step by 250 g; piece lines by 1.
          const step = isFractionalUnit(line.unit) ? 0.25 : 1;
          const name = lang === 'ta' && line.nameTa.trim() ? line.nameTa : line.nameEn;
          return (
            <div
              key={`${line.productId}-${index}`}
              className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium leading-snug">{name}</p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary tnum">
                  {formatQty(line.qty)} {unitLabel(line.unit, lang)} ×{' '}
                  {formatINR(line.unitPricePaise)}
                </p>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onChangeQty(index, Math.max(0, line.qty - step))}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 font-bold"
                  aria-label="Decrease"
                >
                  −
                </button>
                <span className="w-12 text-center text-sm font-medium tnum">
                  {formatQty(line.qty)}
                </span>
                <button
                  onClick={() => onChangeQty(index, line.qty + step)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 font-bold"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>

              <div className="text-right flex-shrink-0 w-20">
                <p className="font-bold tnum">{formatINR(line.lineTotalPaise)}</p>
                <button
                  onClick={() => onRemove(index)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1 text-sm">
        <Row label={t('billing.subtotal')} value={formatINR(totals.subtotalPaise)} />
        {totals.billDiscountPaise > 0 && (
          <Row
            label={t('billing.discount')}
            value={`− ${formatINR(totals.billDiscountPaise)}`}
          />
        )}
        {totals.taxPaise > 0 && (
          <Row label={t('billing.tax')} value={formatINR(totals.taxPaise)} />
        )}
        {totals.roundOffPaise !== 0 && (
          <Row
            label={t('billing.roundOff')}
            value={`${totals.roundOffPaise > 0 ? '+' : '−'} ${formatINR(
              Math.abs(totals.roundOffPaise),
            )}`}
          />
        )}
        <div className="flex justify-between pt-2 text-lg font-bold">
          <span>{t('billing.total')}</span>
          <span className="tnum">{formatINR(totals.totalPaise)}</span>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between text-light-text-secondary dark:text-dark-text-secondary">
    <span>{label}</span>
    <span className="tnum">{value}</span>
  </div>
);
