import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Input, Sheet } from '@/components/ui';
import { changeDue, creditRemaining } from '@/domain/cart';
import { formatINR, parseRupeeInput, sumPaise } from '@/domain/money';
import { listCustomers } from '@/data/repositories/customerRepo';
import { useT } from '@/i18n/useT';
import type { Customer, Payment, PaymentMode } from '@/domain/types';

const MODES: PaymentMode[] = ['cash', 'upi', 'card', 'credit'];

/** Notes a shopkeeper is actually handed. */
const QUICK_NOTES = [10000, 20000, 50000, 100000, 200000, 500000];

export const PaymentSheet: React.FC<{
  open: boolean;
  totalPaise: number;
  onClose: () => void;
  onComplete: (payments: Payment[], creditPaise: number, customerId?: string) => void;
  busy?: boolean;
}> = ({ open, totalPaise, onClose, onComplete, busy }) => {
  const { t } = useT();
  const customers = useLiveQuery(() => listCustomers(), [], [] as Customer[]);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [tendered, setTendered] = useState('');
  const [customerId, setCustomerId] = useState<string>('');

  const paidPaise = useMemo(
    () => sumPaise(payments.filter((p) => p.mode !== 'credit').map((p) => p.amountPaise)),
    [payments],
  );
  const remaining = creditRemaining(totalPaise, payments);
  const tenderedPaise = parseRupeeInput(tendered) ?? 0;
  const change = changeDue(totalPaise, Math.max(tenderedPaise, paidPaise));

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  const reset = () => {
    setPayments([]);
    setTendered('');
    setCustomerId('');
  };

  const close = () => {
    reset();
    onClose();
  };

  /** Pay the whole remaining balance in one mode — the common case. */
  const payFull = (mode: PaymentMode) => {
    if (mode === 'credit') {
      setPayments((p) => p.filter((x) => x.mode !== 'credit'));
      return; // credit is the leftover, assigned at completion
    }
    setPayments([{ mode, amountPaise: totalPaise }]);
  };

  const addPartial = (mode: PaymentMode, amountPaise: number) => {
    if (amountPaise <= 0) return;
    setPayments((p) => [...p, { mode, amountPaise: Math.min(amountPaise, remaining) }]);
    setTendered('');
  };

  const complete = () => {
    // Credit is whatever the payments did not cover.
    const credit = remaining;
    if (credit > 0 && !customerId) return;
    onComplete(payments, credit, credit > 0 ? customerId : undefined);
    reset();
  };

  const canComplete = totalPaise > 0 && (remaining === 0 || Boolean(customerId)) && !busy;

  return (
    <Sheet open={open} onClose={close} title={t('pay.title')} persistent={busy}>
      <div className="text-center mb-5">
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
          {t('billing.total')}
        </p>
        <p className="text-4xl font-bold tnum">{formatINR(totalPaise)}</p>
      </div>

      {/* Full-payment shortcuts */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => payFull(mode)}
            className={`py-3 rounded-lg border-2 text-sm font-medium ${
              payments.length === 1 && payments[0]!.mode === mode
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {t(`pay.${mode}` as 'pay.cash')}
          </button>
        ))}
      </div>

      {/* Cash tendered -> change due */}
      <div className="mb-5">
        <p className="text-sm font-medium mb-2">{t('pay.tendered')}</p>
        <Input
          inputMode="decimal"
          value={tendered}
          onChange={(e) => setTendered(e.target.value)}
          placeholder="0"
          className="text-lg tnum"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {QUICK_NOTES.map((paise) => (
            <button
              key={paise}
              onClick={() => setTendered(String(paise / 100))}
              className="px-3 py-1.5 text-sm rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 tnum"
            >
              ₹{paise / 100}
            </button>
          ))}
        </div>
        {change > 0 && (
          <p className="mt-3 text-lg font-semibold text-brand-secondary tnum">
            {t('pay.change')}: {formatINR(change)}
          </p>
        )}
      </div>

      {/* Split payment rows */}
      {payments.length > 0 && (
        <div className="mb-4 space-y-1">
          {payments.map((p, i) => (
            <div
              key={i}
              className="flex justify-between items-center text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2"
            >
              <span>{t(`pay.${p.mode}` as 'pay.cash')}</span>
              <span className="flex items-center gap-3">
                <span className="tnum font-medium">{formatINR(p.amountPaise)}</span>
                <button
                  onClick={() => setPayments((all) => all.filter((_, idx) => idx !== i))}
                  className="text-red-500 font-bold"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {remaining > 0 && payments.length > 0 && (
        <div className="flex gap-2 mb-4">
          {(['cash', 'upi'] as PaymentMode[]).map((mode) => (
            <Button
              key={mode}
              variant="ghost"
              className="flex-1 text-sm"
              onClick={() => addPartial(mode, tenderedPaise || remaining)}
            >
              + {t(`pay.${mode}` as 'pay.cash')}
            </Button>
          ))}
        </div>
      )}

      {/* Whatever is left becomes credit and needs a customer */}
      {remaining > 0 && (
        <div className="mb-5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-4">
          <p className="font-semibold text-amber-900 dark:text-amber-100 tnum">
            {t('pay.remaining')}: {formatINR(remaining)} → {t('pay.credit')}
          </p>
          <p className="text-sm mt-1 mb-2 text-amber-800 dark:text-amber-200">
            {t('pay.selectCustomer')}
          </p>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600"
          >
            <option value="">— {t('cust.name')} —</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.phone}
              </option>
            ))}
          </select>
          {selectedCustomer && (
            <p className="text-sm mt-2 tnum text-amber-900 dark:text-amber-100">
              {t('pay.currentBalance')}: {formatINR(selectedCustomer.balancePaise)}
              {selectedCustomer.creditLimitPaise !== undefined &&
                selectedCustomer.balancePaise + remaining > selectedCustomer.creditLimitPaise && (
                  // A warning, never a block — the shopkeeper knows their
                  // customers better than the app does.
                  <span className="block font-semibold text-red-700 dark:text-red-300">
                    ⚠ {t('pay.overLimit')}
                  </span>
                )}
            </p>
          )}
        </div>
      )}

      <Button full onClick={complete} disabled={!canComplete}>
        {busy ? '…' : t('pay.complete')}
      </Button>
    </Sheet>
  );
};
