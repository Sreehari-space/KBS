import { describe, expect, it } from 'vitest';
import {
  addPartial,
  canComplete,
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
} from './paymentState';
import { assertBalances } from '@/domain/cart';

const TOTAL = 10000; // ₹100.00

describe('full credit sale — the flow that broke', () => {
  it('selecting credit lights the chip', () => {
    // The regression: tapping Credit filtered `payments` for a mode that is
    // never in `payments`, so nothing changed and the chip never lit. To the
    // shopkeeper the button was simply dead.
    const state = selectMode(emptyPaymentState, 'credit', TOTAL);
    expect(isModeSelected(state, 'credit')).toBe(true);
    expect(isModeSelected(state, 'cash')).toBe(false);
  });

  it('selecting credit reveals the customer picker', () => {
    expect(isCreditPanelVisible(emptyPaymentState, TOTAL)).toBe(false);
    const state = selectMode(emptyPaymentState, 'credit', TOTAL);
    expect(isCreditPanelVisible(state, TOTAL)).toBe(true);
  });

  it('completes once a customer is chosen, and not before', () => {
    const chosen = selectMode(emptyPaymentState, 'credit', TOTAL);
    expect(canComplete(chosen, TOTAL)).toBe(false);
    const withCustomer = { ...chosen, customerId: 'cust-1' };
    expect(canComplete(withCustomer, TOTAL)).toBe(true);
  });

  it('puts the whole amount on the customer account', () => {
    const state = { ...selectMode(emptyPaymentState, 'credit', TOTAL), customerId: 'cust-1' };
    const input = toCommitInput(state, TOTAL);
    expect(input).toEqual({ payments: [], creditPaise: TOTAL, customerId: 'cust-1' });
    // And the result still satisfies the commit invariant (doc 07).
    expect(() => assertBalances(TOTAL, input.payments, input.creditPaise)).not.toThrow();
  });

  it('drops a stale tendered amount, so no phantom change is shown', () => {
    const typed = { ...emptyPaymentState, tendered: '500' };
    const state = selectMode(typed, 'credit', TOTAL);
    expect(state.tendered).toBe('');
    expect(isTenderVisible(state)).toBe(false);
  });
});

describe('switching between modes', () => {
  it('choosing cash after credit clears the credit flag', () => {
    const state = selectMode(selectMode(emptyPaymentState, 'credit', TOTAL), 'cash', TOTAL);
    expect(state.fullCredit).toBe(false);
    expect(isModeSelected(state, 'cash')).toBe(true);
    expect(remainingPaise(state, TOTAL)).toBe(0);
    expect(canComplete(state, TOTAL)).toBe(true);
  });

  it('choosing credit after cash clears the tender', () => {
    const state = selectMode(selectMode(emptyPaymentState, 'cash', TOTAL), 'credit', TOTAL);
    expect(state.payments).toEqual([]);
    expect(remainingPaise(state, TOTAL)).toBe(TOTAL);
  });

  it('a fully paid sale needs no customer', () => {
    const state = selectMode(emptyPaymentState, 'upi', TOTAL);
    expect(toCommitInput(state, TOTAL)).toEqual({
      payments: [{ mode: 'upi', amountPaise: TOTAL }],
      creditPaise: 0,
    });
  });
});

describe('partial payment then credit', () => {
  it('leaves the unpaid remainder on the account', () => {
    const state = {
      ...addPartial(emptyPaymentState, 'cash', 4000, TOTAL),
      customerId: 'cust-1',
    };
    expect(remainingPaise(state, TOTAL)).toBe(6000);
    expect(isCreditPanelVisible(state, TOTAL)).toBe(true);
    const input = toCommitInput(state, TOTAL);
    expect(input.creditPaise).toBe(6000);
    expect(() => assertBalances(TOTAL, input.payments, input.creditPaise)).not.toThrow();
  });

  it('never tenders more than is outstanding', () => {
    // Handing over ₹500 for a ₹100 bill is change, not a ₹500 payment.
    const state = addPartial(emptyPaymentState, 'cash', 50000, TOTAL);
    expect(state.payments).toEqual([{ mode: 'cash', amountPaise: TOTAL }]);
    expect(remainingPaise(state, TOTAL)).toBe(0);
  });

  it('ignores a zero or negative tender', () => {
    expect(addPartial(emptyPaymentState, 'cash', 0, TOTAL)).toBe(emptyPaymentState);
    expect(addPartial(emptyPaymentState, 'cash', -100, TOTAL)).toBe(emptyPaymentState);
  });

  it('adds nothing once the bill is settled', () => {
    const settled = addPartial(emptyPaymentState, 'cash', TOTAL, TOTAL);
    expect(addPartial(settled, 'upi', 5000, TOTAL)).toBe(settled);
  });

  it('splits across two modes', () => {
    const split = addPartial(
      addPartial(emptyPaymentState, 'cash', 4000, TOTAL),
      'upi',
      6000,
      TOTAL,
    );
    expect(remainingPaise(split, TOTAL)).toBe(0);
    expect(canComplete(split, TOTAL)).toBe(true);
    expect(() => assertBalances(TOTAL, split.payments, 0)).not.toThrow();
  });

  it('removing a tender re-opens the remainder', () => {
    const split = addPartial(emptyPaymentState, 'cash', 4000, TOTAL);
    const removed = removePayment(split, 0);
    expect(remainingPaise(removed, TOTAL)).toBe(TOTAL);
    // Back to a bare sheet: no lingering credit panel with nothing behind it.
    expect(isCreditPanelVisible(removed, TOTAL)).toBe(false);
    expect(isAwaitingChoice(removed, TOTAL)).toBe(true);
  });
});

describe('reaching a partial payment at all', () => {
  it('offers "+ Cash" once an amount has been tendered', () => {
    // The old gate was `remaining > 0 && payments.length > 0`, which could
    // never hold: the only thing that filled `payments` was a full-amount
    // tender, which drove `remaining` to zero. So these buttons — and with
    // them every split and partial-credit sale — were dead markup.
    expect(isPartialOfferVisible(emptyPaymentState, TOTAL, 0)).toBe(false);
    expect(isPartialOfferVisible(emptyPaymentState, TOTAL, 4000)).toBe(true);
  });

  it('keeps offering while a balance remains', () => {
    const part = addPartial(emptyPaymentState, 'cash', 4000, TOTAL);
    expect(isPartialOfferVisible(part, TOTAL, 0)).toBe(true);
  });

  it('stops offering once the bill is settled', () => {
    const paid = addPartial(emptyPaymentState, 'cash', TOTAL, TOTAL);
    expect(isPartialOfferVisible(paid, TOTAL, 5000)).toBe(false);
  });

  it('is not offered during a full credit sale', () => {
    const credit = selectMode(emptyPaymentState, 'credit', TOTAL);
    expect(isPartialOfferVisible(credit, TOTAL, 5000)).toBe(false);
  });
});

describe('the sheet does not open in a warning state', () => {
  it('shows the prompt, not the credit panel, before any choice', () => {
    expect(isAwaitingChoice(emptyPaymentState, TOTAL)).toBe(true);
    expect(isCreditPanelVisible(emptyPaymentState, TOTAL)).toBe(false);
  });

  it('stops prompting once a mode is chosen', () => {
    expect(isAwaitingChoice(selectMode(emptyPaymentState, 'credit', TOTAL), TOTAL)).toBe(false);
    expect(isAwaitingChoice(selectMode(emptyPaymentState, 'cash', TOTAL), TOTAL)).toBe(false);
  });

  it('stops prompting once an amount is being typed', () => {
    // Typing a tender IS answering the question; repeating it underneath the
    // number they are entering reads as the app not keeping up.
    expect(isAwaitingChoice(emptyPaymentState, TOTAL, 4000)).toBe(false);
  });
});

describe('guards', () => {
  it('refuses to complete while a commit is in flight', () => {
    const paid = selectMode(emptyPaymentState, 'cash', TOTAL);
    expect(canComplete(paid, TOTAL, true)).toBe(false);
  });

  it('refuses an empty bill', () => {
    expect(canComplete(emptyPaymentState, 0)).toBe(false);
  });
});
