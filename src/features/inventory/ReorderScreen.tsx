import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, EmptyState } from '@/components/ui';
import { formatQty } from '@/domain/money';
import { lowStock } from '@/data/repositories/productRepo';
import { useSettings } from '@/hooks/useSettings';
import { productName, unitLabel, useT } from '@/i18n/useT';
import type { Product } from '@/domain/types';

/** Low-stock list, one tap to WhatsApp the order to a supplier. */
export const ReorderScreen: React.FC = () => {
  const { t, lang } = useT();
  const settings = useSettings();
  const items = useLiveQuery(() => lowStock(), [], [] as Product[]);

  const send = () => {
    const shopName =
      lang === 'ta' && settings.shop.nameTa ? settings.shop.nameTa : settings.shop.nameEn;
    const lines = [
      `*${shopName}*`,
      t('reorder.heading'),
      '',
      ...(items ?? []).map(
        (p) => `• ${productName(p, lang)} (${formatQty(p.stockQty)} ${unitLabel(p.unit, lang)})`,
      ),
    ];
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {(items ?? []).length === 0 ? (
          <EmptyState title={t('reorder.none')} />
        ) : (
          <div className="space-y-2">
            {(items ?? []).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{productName(p, lang)}</p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {p.category}
                  </p>
                </div>
                <p className="font-bold tnum text-red-500 flex-shrink-0">
                  {formatQty(p.stockQty)} {unitLabel(p.unit, lang)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {(items ?? []).length > 0 && (
        <div className="flex-shrink-0 p-4 pb-safe border-t border-slate-200 dark:border-slate-700">
          <Button full variant="secondary" onClick={send}>
            💬 {t('reorder.send')}
          </Button>
        </div>
      )}
    </div>
  );
};
