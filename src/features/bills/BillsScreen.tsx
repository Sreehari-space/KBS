import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Banner, Button, EmptyState, Money, Sheet, SkeletonRows } from '@/components/ui';
import { IconBills, IconPrint } from '@/components/icons';
import { formatQty } from '@/domain/money';
import { listSales } from '@/data/repositories/saleRepo';
import { commitReturn } from '@/data/repositories/returnRepo';
import { ReceiptSheet } from '@/features/bill/ReceiptSheet';
import { unitLabel, useT } from '@/i18n/useT';
import { formatDateTime } from '@/domain/datetime';
import type { Sale } from '@/domain/types';

/** Past bills: reprint, resend, and return items. */
export const BillsScreen: React.FC = () => {
  const { t, lang } = useT();
  const sales = useLiveQuery(() => listSales(100), []);
  const [viewing, setViewing] = useState<Sale | null>(null);
  const [returning, setReturning] = useState<Sale | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4" aria-busy={sales === undefined}>
        {sales === undefined ? (
          <SkeletonRows rows={6} />
        ) : sales.length === 0 ? (
          // The preview shows, greyed out, exactly what will fill this screen —
          // more useful than an icon and an apology.
          <EmptyState
            title={t('bills.none')}
            hint={t('bills.emptyHint')}
            icon={<IconBills className="w-10 h-10" />}
            preview={
              <div className="max-w-xs mx-auto p-3 rounded-lg border border-slate-300 dark:border-slate-600 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium count">{t('bill.no')} 000000-001</p>
                    <p className="text-xs">— · 3 {t('billing.items')}</p>
                  </div>
                  <Money paise={0} className="text-xl font-bold" />
                </div>
              </div>
            }
          />
        ) : (
          <div className="space-y-2">
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="p-3 rounded-lg bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium count">{sale.billNo}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                      {formatDateTime(sale.createdAt, lang)} · {sale.lines.length}{' '}
                      {t('billing.items')}
                    </p>
                    {sale.status !== 'completed' && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {t('bills.returned')}
                      </p>
                    )}
                  </div>
                  <Money
                    paise={sale.totalPaise}
                    className={`text-xl font-bold flex-shrink-0 ${
                      sale.totalPaise < 0 ? 'text-red-600 dark:text-red-400' : ''
                    }`}
                  />
                </div>
                {/* The amount is what an operator scans this list for, so the
                    actions stay subordinate: reprint is a small button, and
                    the semi-destructive return is a plain link. */}
                <div className="flex items-center gap-3 mt-2">
                  <Button
                    variant="ghost"
                    className="py-1.5 px-3 text-sm flex items-center gap-1.5"
                    onClick={() => setViewing(sale)}
                  >
                    <IconPrint className="w-4 h-4" />
                    {t('bills.reprint')}
                  </Button>
                  {sale.totalPaise > 0 && sale.status === 'completed' && (
                    <button
                      onClick={() => setReturning(sale)}
                      className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary dark:hover:text-brand-on-dark"
                    >
                      {t('bills.return')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ReceiptSheet sale={viewing} onClose={() => setViewing(null)} />

      {returning && (
        <ReturnSheet
          sale={returning}
          onClose={() => setReturning(null)}
          onDone={(returnSale) => {
            setReturning(null);
            setViewing(returnSale);
          }}
          lang={lang}
        />
      )}
    </div>
  );
};

const ReturnSheet: React.FC<{
  sale: Sale;
  onClose: () => void;
  onDone: (returnSale: Sale) => void;
  lang: 'ta' | 'en';
}> = ({ sale, onClose, onDone, lang }) => {
  const { t } = useT();
  const [quantities, setQuantities] = useState<Map<number, number>>(new Map());
  const [mode, setMode] = useState<'cash' | 'upi' | 'credit'>('cash');
  const [error, setError] = useState<string | null>(null);

  const refundPaise = [...quantities.entries()].reduce((sum, [index, qty]) => {
    const line = sale.lines[index];
    return line ? sum + Math.round(qty * line.unitPricePaise) : sum;
  }, 0);

  const submit = async () => {
    setError(null);
    try {
      const returnSale = await commitReturn({
        saleId: sale.id,
        quantities,
        refundMode: mode,
      });
      onDone(returnSale);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Sheet open onClose={onClose} title={t('bills.return')}>
      {error && (
        <div className="mb-3">
          <Banner tone="danger" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        </div>
      )}

      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-3">
        {t('bills.selectItems')} · {sale.billNo}
      </p>

      <div className="space-y-2 mb-4">
        {sale.lines.map((line, index) => {
          const name = lang === 'ta' && line.nameTa.trim() ? line.nameTa : line.nameEn;
          const qty = quantities.get(index) ?? 0;
          const step = line.unit === 'piece' || line.unit === 'packet' ? 1 : 0.25;
          return (
            <div
              key={index}
              className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{name}</p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary count">
                  {formatQty(line.qty)} {unitLabel(line.unit, lang)} ·{' '}
                  <Money paise={line.unitPricePaise} />
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() =>
                    setQuantities((m) => {
                      const next = new Map(m);
                      const value = Math.max(0, qty - step);
                      if (value === 0) next.delete(index);
                      else next.set(index, value);
                      return next;
                    })
                  }
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 font-bold"
                >
                  −
                </button>
                <span className="w-12 text-center text-sm tnum">{formatQty(qty)}</span>
                <button
                  onClick={() =>
                    setQuantities((m) => {
                      const next = new Map(m);
                      // Never allow returning more than was sold.
                      next.set(index, Math.min(line.qty, qty + step));
                      return next;
                    })
                  }
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 font-bold"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mb-4">
        {(['cash', 'upi', ...(sale.customerId ? (['credit'] as const) : [])] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium ${
              mode === m
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:text-brand-on-dark'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {t(`pay.${m}` as 'pay.cash')}
          </button>
        ))}
      </div>

      <div className="flex justify-between text-lg font-bold mb-3">
        <span>{t('bills.refund')}</span>
        <Money paise={refundPaise} />
      </div>

      <Button full onClick={submit} disabled={refundPaise <= 0}>
        {t('bills.confirmReturn')}
      </Button>
    </Sheet>
  );
};
