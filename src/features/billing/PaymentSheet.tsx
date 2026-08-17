import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Input, Money, Select, Sheet } from '@/components/ui';
import { IconClose, IconLowStock } from '@/components/icons';
import { changeDue } from '@/domain/cart';
import { parseRupeeInput, sumPaise } from '@/domain/money';
import { listCustomers } from '@/data/repositories/customerRepo';
import { useT } from '@/i18n/useT';
import {
  addPartial,
  canComplete as canCompleteState,
  emptyPaymentState,
  isAwaitingChoice,
  isCreditPanelVisible,
  isModeSelected,
  isPartialOfferVisible,
  isTenderVisible,
  remainingPaise,
  removePayment,
  selectMode,
  toCommitInput,
  type PaymentState,
} from './paymentState';
import type { Customer, Payment, PaymentMode } from '@/domain/types';

const MODES: PaymentMode[] = ['cash', 'upi', 'card', 'credit'];

/** Notes a shopkeeper is actually handed. */
const QUICK_NOTES = [10000, 20000, 50000, 100000, 200000, 500000];

/**
 * Take payment.
 *
 * All of the decision-making lives in `paymentState.ts` so it can be tested;
 * this component only renders it. Credit is a first-class selectable mode
 * here — it is the flow a kirana shop runs on.
 */
export const PaymentSheet: React.FC<{
  open: boolean;
  totalPaise: number;
  onClose: () => void;
  onComplete: (payments: Payment[], creditPaise: number, customerId?: string) => void;
  busy?: boolean;
}> = ({ open, totalPaise, onClose, onComplete, busy }) => {
  const { t } = useT();
  const customers = useLiveQuery(() => listCustomers(), [], [] as Customer[]);

  const [state, setState] = useState<PaymentState>(emptyPaymentState);

  const paidPaise = useMemo(
    () => sumPaise(state.payments.map((p) => p.amountPaise)),
    [state.payments],
  );
  const remaining = remainingPaise(state, totalPaise);
  const tenderedPaise = parseRupeeInput(state.tendered) ?? 0;
  const change = changeDue(totalPaise, Math.max(tenderedPaise, paidPaise));

  const selectedCustomer = customers?.find((c) => c.id === state.customerId);
  const creditPanel = isCreditPanelVisible(state, totalPaise);

  const close = () => {
    setState(emptyPaymentState);
    onClose();
  };

  const complete = () => {
    if (!canCompleteState(state, totalPaise, busy)) return;
    const input = toCommitInput(state, totalPaise);
    onComplete(input.payments, input.creditPaise, input.customerId);
    setState(emptyPaymentState);
  };

  return (
    <Sheet open={open} onClose={close} title={t('pay.title')} persistent={busy}>
      <div className="text-center mb-5">
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
          {t('billing.total')}
        </p>
        <Money paise={totalPaise} className="block text-4xl font-bold" />
      </div>

      {/* Full-payment shortcuts. Credit sits here as a peer of cash and UPI,
          because "put it on their book" is a way of settling a bill, not an
          error state you fall into by underpaying. */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => setState((cur) => selectMode(cur, mode, totalPaise))}
            aria-pressed={isModeSelected(state, mode)}
            className={`rounded-full py-3 text-sm font-medium transition-colors focus-ring ${
              isModeSelected(state, mode)
                ? 'bg-brand-primary text-white'
                : 'bg-light-surface shadow-card dark:bg-white/10'
            }`}
          >
            {t(`pay.${mode}` as 'pay.cash')}
          </button>
        ))}
      </div>

      {/* Cash tendered -> change due. Hidden for a full credit sale: no money
          changes hands, so a "change to return" line there is nonsense. */}
      {isTenderVisible(state) && (
        <div className="mb-5">
          <p className="text-sm font-medium mb-2">{t('pay.tendered')}</p>
          <Input
            inputMode="decimal"
            value={state.tendered}
            onChange={(e) => setState((cur) => ({ ...cur, tendered: e.target.value }))}
            placeholder="0"
            className="text-lg tnum"
          />
          <div className="grid grid-cols-3 gap-2 mt-2">
            {QUICK_NOTES.map((paise) => (
              <button
                key={paise}
                onClick={() => setState((cur) => ({ ...cur, tendered: String(paise / 100) }))}
                className="money rounded-full bg-light-surface py-2 text-sm shadow-card hover:bg-light-line focus-ring dark:bg-white/10 dark:hover:bg-white/[0.15]"
              >
                ₹{paise / 100}
              </button>
            ))}
          </div>
          {change > 0 && (
            <p className="mt-3 text-lg font-semibold text-brand-secondary animate-fade-in">
              {t('pay.change')}: <Money paise={change} />
            </p>
          )}
        </div>
      )}

      {/* Split payment rows */}
      {state.payments.length > 0 && (
        <div className="mb-4 space-y-1">
          {state.payments.map((p, i) => (
            <div
              key={i}
              className="animate-row-in flex items-center justify-between rounded-2xl bg-light-surface px-4 py-3 text-sm shadow-card dark:bg-white/10"
            >
              <span>{t(`pay.${p.mode}` as 'pay.cash')}</span>
              <span className="flex items-center gap-3">
                <Money paise={p.amountPaise} className="font-medium" />
                <button
                  onClick={() => setState((cur) => removePayment(cur, i))}
                  className="text-light-text-secondary dark:text-dark-text-secondary hover:text-red-600 rounded focus-ring"
                  aria-label={t('common.delete')}
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {isPartialOfferVisible(state, totalPaise, tenderedPaise) && (
        <div className="flex gap-2 mb-4">
          {/* Card belongs here too: a card-plus-cash split was impossible
              purely because this list was hard-coded to two modes. */}
          {(['cash', 'upi', 'card'] as PaymentMode[]).map((mode) => (
            <Button
              key={mode}
              variant="ghost"
              className="flex-1 text-sm"
              onClick={() =>
                setState((cur) => addPartial(cur, mode, tenderedPaise || remaining, totalPaise))
              }
            >
              + {t(`pay.${mode}` as 'pay.cash')}
            </Button>
          ))}
        </div>
      )}

      {/* Who carries the unpaid part. Appears only after a deliberate choice —
          credit, or a partial tender — so the busiest sheet in the app never
          opens in a yellow warning state. */}
      {creditPanel && (
        <div className="mb-5 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-4 animate-fade-in">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            {t('pay.remaining')}: <Money paise={remaining} /> &rarr; {t('pay.credit')}
          </p>
          <p className="text-sm mt-1 mb-2 text-amber-800 dark:text-amber-200">
            {t('pay.selectCustomer')}
          </p>
          <Select
            value={state.customerId}
            onChange={(e) => setState((cur) => ({ ...cur, customerId: e.target.value }))}
            aria-label={t('pay.selectCustomer')}
          >
            <option value="">— {t('cust.name')} —</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.phone}
              </option>
            ))}
          </Select>
          {/* A shop with no customers on file cannot give credit yet, and the
              empty dropdown alone does not say so. */}
          {(customers ?? []).length === 0 && (
            <p className="text-sm mt-2 text-amber-900 dark:text-amber-100">
              {t('pay.noCustomers')}
            </p>
          )}
          {selectedCustomer && (
            <p className="text-sm mt-2 text-amber-900 dark:text-amber-100">
              {t('pay.currentBalance')}: <Money paise={selectedCustomer.balancePaise} />
              {selectedCustomer.creditLimitPaise !== undefined &&
                selectedCustomer.balancePaise + remaining > selectedCustomer.creditLimitPaise && (
                  // A warning, never a block — the shopkeeper knows their
                  // customers better than the app does.
                  <span className="flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-300">
                    <IconLowStock className="w-4 h-4 flex-shrink-0" />
                    {t('pay.overLimit')}
                  </span>
                )}
            </p>
          )}
        </div>
      )}

      {isAwaitingChoice(state, totalPaise, tenderedPaise) && (
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-3">
          {t('pay.choosePrompt')}
        </p>
      )}

      <Button full onClick={complete} disabled={!canCompleteState(state, totalPaise, busy)}>
        {busy ? '…' : t('pay.complete')}
      </Button>
    </Sheet>
  );
};
