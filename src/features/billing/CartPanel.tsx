import React from 'react';
import { EmptyState, Money } from '@/components/ui';
import { IconMinus, IconPlus, IconTrash } from '@/components/icons';
import { formatQty } from '@/domain/money';
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
            // A NEW line animates in; changing the quantity of an existing one
            // does not, because React keeps that row's DOM node. The key does
            // all the work — no "which row just changed" state needed.
            <div
              key={`${line.productId}-${index}`}
              className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0 animate-row-in"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium leading-snug">{name}</p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary count">
                  {formatQty(line.qty)} {unitLabel(line.unit, lang)} ×{' '}
                  <Money paise={line.unitPricePaise} />
                </p>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onChangeQty(index, Math.max(0, line.qty - step))}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition-transform active:scale-90 focus-ring"
                  aria-label="Decrease"
                >
                  <IconMinus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-sm font-medium count">
                  {formatQty(line.qty)}
                </span>
                <button
                  onClick={() => onChangeQty(index, line.qty + step)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center transition-transform active:scale-90 focus-ring"
                  aria-label="Increase"
                >
                  <IconPlus className="w-4 h-4" />
                </button>
                {/* Remove lives with the quantity controls, not in the amount
                    column — red repeated beside every total drowns out the
                    numbers the operator is actually checking. */}
                <button
                  onClick={() => onRemove(index)}
                  className="w-8 h-8 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:text-red-600 flex items-center justify-center"
                  aria-label={t('common.delete')}
                >
                  <IconTrash className="w-4 h-4" />
                </button>
              </div>

              <div className="text-right flex-shrink-0 w-24">
                <Money paise={line.lineTotalPaise} className="font-bold" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1 text-sm">
        <Row label={t('billing.subtotal')} paise={totals.subtotalPaise} />
        {totals.billDiscountPaise > 0 && (
          <Row label={t('billing.discount')} paise={totals.billDiscountPaise} sign="−" />
        )}
        {totals.taxPaise > 0 && <Row label={t('billing.tax')} paise={totals.taxPaise} />}
        {totals.roundOffPaise !== 0 && (
          <Row
            label={t('billing.roundOff')}
            paise={Math.abs(totals.roundOffPaise)}
            sign={totals.roundOffPaise > 0 ? '+' : '−'}
          />
        )}
        <div className="flex justify-between pt-2 text-lg font-bold">
          <span>{t('billing.total')}</span>
          <Money paise={totals.totalPaise} />
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; paise: number; sign?: string }> = ({ label, paise, sign }) => (
  <div className="flex justify-between text-light-text-secondary dark:text-dark-text-secondary">
    <span>{label}</span>
    <span>
      {sign && `${sign} `}
      <Money paise={paise} />
    </span>
  </div>
);
