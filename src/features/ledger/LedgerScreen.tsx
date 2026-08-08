import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, EmptyState, Field, Input, Sheet } from '@/components/ui';
import { IconWhatsApp } from '@/components/icons';
import { formatINR, parseRupeeInput } from '@/domain/money';
import { db } from '@/data/db';
import {
  entriesForCustomer,
  outstandingCustomers,
  recordPayment,
} from '@/data/repositories/ledgerRepo';
import { toWhatsAppNumber } from '@/data/repositories/customerRepo';
import { useSettings } from '@/hooks/useSettings';
import { useT } from '@/i18n/useT';
import type { Customer, LedgerEntry, PaymentMode } from '@/domain/types';

/**
 * Credit ledger (கடன்). See docs/05-ledger-tamil-dayclose.md.
 *
 * This replaces the paper notebook behind the counter — the most important
 * object in a kirana shop, because it represents money not yet collected.
 */
export const LedgerScreen: React.FC = () => {
  const { t, lang } = useT();
  const settings = useSettings();
  const customers = useLiveQuery(() => outstandingCustomers(), [], [] as Customer[]);
  const [selected, setSelected] = useState<Customer | null>(null);

  const total = useMemo(
    () => (customers ?? []).reduce((sum, c) => sum + c.balancePaise, 0),
    [customers],
  );

  // Kept live so the balance in the open statement updates after a collection.
  const liveSelected = useLiveQuery(
    async () => (selected ? ((await db.customers.get(selected.id)) ?? null) : null),
    [selected?.id],
    null,
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-4 pt-4">
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 px-4 py-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">{t('ledger.outstanding')}</p>
          <p className="text-3xl font-bold tnum text-amber-900 dark:text-amber-100">
            {formatINR(total)}
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
            {(customers ?? []).length} {t('ledger.customers')}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {(customers ?? []).length === 0 ? (
          <EmptyState title={t('ledger.noDues')} />
        ) : (
          <div className="space-y-2">
            {(customers ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary tnum">
                    {c.phone}
                  </p>
                </div>
                <p className="font-bold tnum text-amber-600 dark:text-amber-400 flex-shrink-0">
                  {formatINR(c.balancePaise)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <StatementSheet
        customer={liveSelected ?? selected}
        onClose={() => setSelected(null)}
        shopName={lang === 'ta' && settings.shop.nameTa ? settings.shop.nameTa : settings.shop.nameEn}
      />
    </div>
  );
};

const StatementSheet: React.FC<{
  customer: Customer | null;
  onClose: () => void;
  shopName: string;
}> = ({ customer, onClose, shopName }) => {
  const { t } = useT();
  const [collecting, setCollecting] = useState(false);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<PaymentMode>('cash');

  const entries = useLiveQuery(
    async () => (customer ? entriesForCustomer(customer.id) : []),
    [customer?.id],
    [] as LedgerEntry[],
  );

  if (!customer) return null;

  const collect = async () => {
    const paise = parseRupeeInput(amount);
    if (!paise || paise <= 0) return;
    await recordPayment(customer.id, Math.min(paise, customer.balancePaise), mode);
    setAmount('');
    setCollecting(false);
  };

  const remind = () => {
    const lines = [
      `*${shopName}*`,
      '',
      `${t('cust.name')}: ${customer.name}`,
      `${t('ledger.outstanding')}: ${formatINR(customer.balancePaise)}`,
      '',
      t('ledger.remind'),
    ];
    window.open(
      `https://wa.me/${toWhatsAppNumber(customer.phone)}?text=${encodeURIComponent(lines.join('\n'))}`,
      '_blank',
    );
  };

  const typeLabel: Record<LedgerEntry['type'], string> = {
    opening_balance: t('bill.previousDue'),
    credit_sale: t('pay.credit'),
    payment: t('ledger.collect'),
    adjustment: t('common.edit'),
  };

  // Running balance, newest first — walk it with the customer when they query it.
  let running = customer.balancePaise;
  const rows = (entries ?? []).map((entry) => {
    const after = running;
    running -= entry.amountPaise;
    return { entry, after };
  });

  return (
    <Sheet open onClose={onClose} title={customer.name}>
      <div className="text-center mb-4">
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
          {t('cust.balance')}
        </p>
        <p className="text-3xl font-bold tnum">{formatINR(customer.balancePaise)}</p>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary tnum">
          {customer.phone}
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <Button className="flex-1" onClick={() => setCollecting((c) => !c)}>
          {t('ledger.collect')}
        </Button>
        <Button
          variant="secondary"
          className="flex-1 flex items-center justify-center gap-2"
          onClick={remind}
        >
          <IconWhatsApp className="w-5 h-5 flex-shrink-0" />
          {t('ledger.remind')}
        </Button>
      </div>

      {collecting && (
        <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
          <Field label={t('ledger.collect')}>
            <Input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(customer.balancePaise / 100)}
              className="tnum"
            />
          </Field>
          <div className="flex gap-2">
            {(['cash', 'upi'] as PaymentMode[]).map((m) => (
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
          <Button full onClick={collect} disabled={!parseRupeeInput(amount)}>
            {t('common.save')}
          </Button>
        </div>
      )}

      <h3 className="font-semibold mb-2">{t('ledger.statement')}</h3>
      <div className="space-y-1">
        {rows.map(({ entry, after }) => (
          <div
            key={entry.id}
            className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{typeLabel[entry.type]}</p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {new Date(entry.at).toLocaleDateString()}
                {entry.note ? ` · ${entry.note}` : ''}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p
                className={`font-semibold tnum ${
                  entry.amountPaise > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-brand-secondary'
                }`}
              >
                {entry.amountPaise > 0 ? '+' : '−'}
                {formatINR(Math.abs(entry.amountPaise))}
              </p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary tnum">
                {formatINR(after)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
};
