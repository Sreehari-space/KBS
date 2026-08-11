// @vitest-environment jsdom
/**
 * The regression test for the bug that started all this: tapping "Credit" did
 * nothing. `paymentState.test.ts` proves the logic; this proves the sheet is
 * actually wired to it — which is precisely the seam the original defect fell
 * through, since the logic did not exist and nothing rendered could be
 * asserted on.
 */

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentSheet } from './PaymentSheet';
import { I18nContext } from '@/i18n/useT';
import { db, newId, nowIso } from '@/data/db';

const TOTAL = 6100; // ₹61.00

function renderSheet(onComplete = vi.fn()) {
  render(
    <I18nContext.Provider value={{ lang: 'en', setLang: () => {} }}>
      <PaymentSheet open totalPaise={TOTAL} onClose={() => {}} onComplete={onComplete} />
    </I18nContext.Provider>,
  );
  return onComplete;
}

beforeEach(async () => {
  await db.open();
  await db.customers.clear();
  await db.customers.add({
    id: newId(),
    name: 'Murugan',
    phone: '9876543210',
    balancePaise: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
});

afterEach(cleanup);

describe('PaymentSheet — credit', () => {
  it('marks the Credit chip as pressed when tapped', async () => {
    const user = userEvent.setup();
    renderSheet();

    const credit = screen.getByRole('button', { name: 'Credit' });
    expect(credit).toHaveProperty('ariaPressed', 'false');

    await user.click(credit);
    // The whole bug in one assertion: this used to stay 'false' forever,
    // because tapping Credit filtered a list credit is never in.
    expect(credit).toHaveProperty('ariaPressed', 'true');
  });

  it('reveals the customer picker and enables completion once one is chosen', async () => {
    const user = userEvent.setup();
    const onComplete = renderSheet();

    expect(screen.queryByRole('combobox')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Credit' }));

    const picker = await screen.findByRole('combobox');
    const complete = screen.getByRole('button', { name: 'Complete sale' });
    expect(complete).toHaveProperty('disabled', true);

    await waitFor(() => expect(picker.querySelectorAll('option').length).toBeGreaterThan(1));
    const option = picker.querySelectorAll('option')[1] as HTMLOptionElement;
    await user.selectOptions(picker, option.value);

    expect(complete).toHaveProperty('disabled', false);
    await user.click(complete);

    // Credit is the remainder, so nothing is tendered and the whole bill goes
    // on the account.
    expect(onComplete).toHaveBeenCalledWith([], TOTAL, option.value);
  });

  it('hides the cash-tendered field during a full credit sale', async () => {
    const user = userEvent.setup();
    renderSheet();

    expect(screen.getByText('Cash received')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Credit' }));
    expect(screen.queryByText('Cash received')).toBeNull();
  });

  it('does not open in a warning state', () => {
    renderSheet();
    // The property the original "fix" was after, and which must survive.
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('Choose how the customer is paying')).toBeDefined();
  });
});

describe('PaymentSheet — plain and split payments', () => {
  it('settles the bill in one mode', async () => {
    const user = userEvent.setup();
    const onComplete = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Cash' }));
    await user.click(screen.getByRole('button', { name: 'Complete sale' }));

    expect(onComplete).toHaveBeenCalledWith([{ mode: 'cash', amountPaise: TOTAL }], 0, undefined);
  });

  it('offers a partial payment once an amount is tendered', async () => {
    const user = userEvent.setup();
    renderSheet();

    // These buttons were unreachable: they appeared only when a payment
    // already existed, and the only way to create one settled the bill.
    expect(screen.queryByRole('button', { name: '+ Cash' })).toBeNull();
    await user.type(screen.getByPlaceholderText('0'), '10');
    expect(screen.getByRole('button', { name: '+ Cash' })).toBeDefined();
    expect(screen.getByRole('button', { name: '+ Card' })).toBeDefined();
  });

  it('leaves the unpaid remainder on the account', async () => {
    const user = userEvent.setup();
    const onComplete = renderSheet();

    await user.type(screen.getByPlaceholderText('0'), '10');
    await user.click(screen.getByRole('button', { name: '+ Cash' }));

    const picker = await screen.findByRole('combobox');
    await waitFor(() => expect(picker.querySelectorAll('option').length).toBeGreaterThan(1));
    const option = picker.querySelectorAll('option')[1] as HTMLOptionElement;
    await user.selectOptions(picker, option.value);
    await user.click(screen.getByRole('button', { name: 'Complete sale' }));

    expect(onComplete).toHaveBeenCalledWith(
      [{ mode: 'cash', amountPaise: 1000 }],
      TOTAL - 1000,
      option.value,
    );
  });
});
