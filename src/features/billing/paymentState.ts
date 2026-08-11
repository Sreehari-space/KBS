/**
 * Payment sheet state, as pure functions.
 *
 * This lives outside the component for one reason: the full-credit sale — the
 * single most important flow in a kirana shop (D9) — silently became
 * unreachable through the UI, and nothing could catch it. Component state that
 * decides whether a shop can put a bill on a customer's khata belongs in a
 * tested module, not in a `useState` nobody can assert on.
 *
 * The model has two distinct shapes, and conflating them was the bug:
 *
 *   1. **Tendered payments** — cash/UPI/card actually handed over. These live
 *      in `payments` and each carries an amount.
 *   2. **Credit** — the part nobody paid. It has no entry in `payments`; it is
 *      the remainder, computed at completion. So "the customer is paying by
 *      credit" cannot be expressed by adding to `payments`, and needs its own
 *      flag: `fullCredit`.
 *
 * A partial credit sale (₹50 cash, ₹50 on the book) is `payments = [cash 50]`
 * with `fullCredit = false` — the remainder does the work. A full credit sale
 * is `payments = []` with `fullCredit = true`.
 */

import { creditRemaining } from '@/domain/cart';
import type { Paise, Payment, PaymentMode } from '@/domain/types';

export interface PaymentState {
  /** Non-credit tenders. Credit is never in here — it is the remainder. */
  payments: Payment[];
  /** The whole bill goes on the customer's account. */
  fullCredit: boolean;
  /** Required before a sale with any credit in it can be completed. */
  customerId: string;
  /** Raw text from the "cash received" field. */
  tendered: string;
}

export const emptyPaymentState: PaymentState = {
  payments: [],
  fullCredit: false,
  customerId: '',
  tendered: '',
};

/** Amount still unsettled: what will land on the customer's account. */
export function remainingPaise(state: PaymentState, totalPaise: Paise): Paise {
  return creditRemaining(totalPaise, state.payments);
}

/**
 * Tap a mode chip: "the customer is paying the whole bill this way".
 *
 * Credit is a real, selectable choice here. It used to filter `payments` for a
 * mode that is never in `payments`, so tapping it was a no-op: no highlight, no
 * customer picker, and the Complete button stayed disabled forever.
 */
export function selectMode(
  state: PaymentState,
  mode: PaymentMode,
  totalPaise: Paise,
): PaymentState {
  if (mode === 'credit') {
    // No money changes hands, so any typed tender is stale and would otherwise
    // keep showing a "change to return" line on a bill nobody paid.
    return { ...state, payments: [], fullCredit: true, tendered: '' };
  }
  return { ...state, payments: [{ mode, amountPaise: totalPaise }], fullCredit: false };
}

/** Add part of the bill in one mode, leaving the rest to another mode or credit. */
export function addPartial(
  state: PaymentState,
  mode: PaymentMode,
  amountPaise: Paise,
  totalPaise: Paise,
): PaymentState {
  if (amountPaise <= 0) return state;
  const capped = Math.min(amountPaise, remainingPaise(state, totalPaise));
  if (capped <= 0) return state;
  return {
    ...state,
    payments: [...state.payments, { mode, amountPaise: capped }],
    fullCredit: false,
    tendered: '',
  };
}

export function removePayment(state: PaymentState, index: number): PaymentState {
  return { ...state, payments: state.payments.filter((_, i) => i !== index) };
}

/** Which chip is lit. Credit is driven by its own flag, not by `payments`. */
export function isModeSelected(state: PaymentState, mode: PaymentMode): boolean {
  if (mode === 'credit') return state.fullCredit;
  return state.payments.length === 1 && state.payments[0]!.mode === mode;
}

/**
 * Whether to show the customer picker.
 *
 * Deliberately NOT "remaining > 0", which is true the instant the sheet opens
 * and made the busiest sheet in the app boot into an amber warning state. It
 * appears only after a deliberate act: choosing credit, or tendering part of
 * the bill.
 */
export function isCreditPanelVisible(state: PaymentState, totalPaise: Paise): boolean {
  return remainingPaise(state, totalPaise) > 0 && (state.fullCredit || state.payments.length > 0);
}

/**
 * Whether to offer "+ Cash" / "+ UPI", which record PART of the bill.
 *
 * This used to be gated on `remaining > 0 && payments.length > 0` — a
 * condition that could never hold, because the only thing that filled
 * `payments` was a full-amount tender, which drove `remaining` to zero. The
 * split-payment buttons were therefore dead markup, and with them the only
 * route to a partial credit sale.
 *
 * The way in is a tendered amount: once the shopkeeper types what they were
 * actually handed, they can book it and leave the rest outstanding.
 */
export function isPartialOfferVisible(
  state: PaymentState,
  totalPaise: Paise,
  tenderedPaise: Paise,
): boolean {
  if (state.fullCredit) return false;
  if (remainingPaise(state, totalPaise) <= 0) return false;
  return state.payments.length > 0 || tenderedPaise > 0;
}

/** The "choose how the customer is paying" nudge, shown before any choice. */
export function isAwaitingChoice(
  state: PaymentState,
  totalPaise: Paise,
  tenderedPaise = 0,
): boolean {
  return (
    remainingPaise(state, totalPaise) > 0 &&
    !state.fullCredit &&
    state.payments.length === 0 &&
    tenderedPaise <= 0
  );
}

/** Cash tendered is meaningless when nothing is being handed over. */
export function isTenderVisible(state: PaymentState): boolean {
  return !state.fullCredit;
}

/**
 * A sale can complete when it is fully paid, or when whatever is left has a
 * customer to carry it. A credit sale with no customer is refused — there
 * would be nobody to bill.
 */
export function canComplete(state: PaymentState, totalPaise: Paise, busy = false): boolean {
  if (busy || totalPaise <= 0) return false;
  return remainingPaise(state, totalPaise) === 0 || Boolean(state.customerId);
}

/** What `commitSale` is handed. Credit is the remainder, resolved here. */
export function toCommitInput(
  state: PaymentState,
  totalPaise: Paise,
): { payments: Payment[]; creditPaise: Paise; customerId?: string } {
  const creditPaise = remainingPaise(state, totalPaise);
  return {
    payments: state.payments,
    creditPaise,
    ...(creditPaise > 0 ? { customerId: state.customerId } : {}),
  };
}
