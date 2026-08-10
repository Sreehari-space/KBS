import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, EmptyState, Field, Input, Money, Sheet, SkeletonRows } from '@/components/ui';
import { IconCustomers, IconPlus } from '@/components/icons';
import { paiseToRupees, parseRupeeInput } from '@/domain/money';
import {
  createCustomer,
  isValidIndianMobile,
  listCustomers,
  updateCustomer,
} from '@/data/repositories/customerRepo';
import { setOpeningBalance } from '@/data/repositories/ledgerRepo';
import { useT } from '@/i18n/useT';


type Draft = {
  id?: string;
  name: string;
  phone: string;
  address: string;
  creditLimit: string;
  openingBalance: string;
};

const emptyDraft: Draft = {
  name: '',
  phone: '',
  address: '',
  creditLimit: '',
  openingBalance: '',
};

export const CustomersScreen: React.FC = () => {
  const { t } = useT();
  const customers = useLiveQuery(() => listCustomers(), []);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (customers ?? []).filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [customers, search]);

  const totalOutstanding = useMemo(
    () => (customers ?? []).reduce((sum, c) => sum + Math.max(0, c.balancePaise), 0),
    [customers],
  );

  const save = async () => {
    if (!draft || !draft.name.trim()) return;
    const creditLimit = parseRupeeInput(draft.creditLimit);

    if (draft.id) {
      await updateCustomer(draft.id, {
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        address: draft.address.trim(),
        ...(creditLimit !== null ? { creditLimitPaise: creditLimit } : {}),
      });
    } else {
      const created = await createCustomer({
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        address: draft.address.trim(),
        ...(creditLimit !== null ? { creditLimitPaise: creditLimit } : {}),
      });
      // Migrating a shop's paper notebook: record the existing debt as a
      // ledger entry rather than silently setting a balance field.
      const opening = parseRupeeInput(draft.openingBalance);
      if (opening && opening > 0) await setOpeningBalance(created.id, opening);
    }
    setDraft(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-4 pt-4 space-y-3">
        {totalOutstanding > 0 && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">{t('ledger.outstanding')}</p>
            <Money
              paise={totalOutstanding}
              className="block text-2xl font-bold text-amber-900 dark:text-amber-100"
            />
          </div>
        )}
        <div className="flex gap-2">
          <Input
            type="search"
            placeholder={t('cust.name')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={() => setDraft(emptyDraft)}
            className="px-4"
            aria-label={t('cust.add')}
          >
            <IconPlus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3" aria-busy={customers === undefined}>
        {customers === undefined ? (
          <SkeletonRows rows={5} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={t('cust.empty')}
            hint={t('cust.emptyHint')}
            icon={<IconCustomers className="w-10 h-10" />}
            action={{ label: t('cust.add'), onClick: () => setDraft(emptyDraft) }}
          />
        ) : (
          <div className="space-y-2">
            {visible.map((c) => (
              <button
                key={c.id}
                onClick={() =>
                  setDraft({
                    id: c.id,
                    name: c.name,
                    phone: c.phone,
                    address: c.address ?? '',
                    creditLimit: c.creditLimitPaise
                      ? String(paiseToRupees(c.creditLimitPaise))
                      : '',
                    openingBalance: '',
                  })
                }
                className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700 hover:border-brand-primary transition-colors focus-ring"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary count">
                    {c.phone}
                  </p>
                </div>
                {c.balancePaise !== 0 && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                      {t('cust.balance')}
                    </p>
                    <Money
                      paise={c.balancePaise}
                      className={`block font-bold ${
                        c.balancePaise > 0 ? 'text-amber-600 dark:text-amber-400' : ''
                      }`}
                    />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('common.edit') : t('cust.add')}
      >
        {draft && (
          <div className="space-y-3">
            <Field label={t('cust.name')}>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                autoFocus
              />
            </Field>
            <Field
              label={t('cust.phone')}
              hint={
                draft.phone && !isValidIndianMobile(draft.phone)
                  ? '10-digit mobile number'
                  : undefined
              }
            >
              <Input
                inputMode="numeric"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </Field>
            <Field label={`${t('cust.address')} (${t('common.optional')})`}>
              <Input
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              />
            </Field>
            <Field label={`${t('cust.creditLimit')} (${t('common.optional')})`}>
              <Input
                inputMode="decimal"
                value={draft.creditLimit}
                onChange={(e) => setDraft({ ...draft, creditLimit: e.target.value })}
              />
            </Field>
            {!draft.id && (
              <Field label={`${t('bill.previousDue')} (${t('common.optional')})`}>
                <Input
                  inputMode="decimal"
                  value={draft.openingBalance}
                  onChange={(e) => setDraft({ ...draft, openingBalance: e.target.value })}
                />
              </Field>
            )}
            <Button full onClick={save} disabled={!draft.name.trim()}>
              {t('common.save')}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
};
