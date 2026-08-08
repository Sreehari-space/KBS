import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  ACTIVE_DRAFT_ID,
  clearActiveDraft,
  getActiveDraft,
  saveDraft,
} from '@/data/repositories/saleRepo';
import { useDebouncedEffect } from '@/hooks/useDebouncedEffect';
import type { SaleLine } from '@/domain/types';

/**
 * The open cart lives ABOVE the screen router.
 *
 * If it lived inside BillingScreen, stepping over to Customers to add someone
 * mid-bill would unmount the screen, drop the cart, and then greet the
 * shopkeeper with a false "unfinished bill — the app closed" prompt on the way
 * back. The cart has to outlive navigation; only a genuine cold start should
 * ever trigger draft recovery.
 */
interface CartContextValue {
  lines: SaleLine[];
  setLines: React.Dispatch<React.SetStateAction<SaleLine[]>>;
  /** Non-null only on a cold start that found an unfinished cart. */
  pendingDraft: SaleLine[] | null;
  resumeDraft: () => void;
  discardDraft: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export const useCart = (): CartContextValue => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [pendingDraft, setPendingDraft] = useState<SaleLine[] | null>(null);
  const [checked, setChecked] = useState(false);

  // Cold start only: was a cart left in progress when the app last closed?
  useEffect(() => {
    let cancelled = false;
    void getActiveDraft().then((draft) => {
      if (cancelled) return;
      if (draft && draft.lines.length > 0) setPendingDraft(draft.lines);
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-save, debounced so a burst of "+" taps doesn't cause a write per tap.
  // There is no Save button anywhere in this app (doc 07).
  useDebouncedEffect(
    () => {
      if (!checked || pendingDraft) return; // don't overwrite a draft awaiting a decision
      if (lines.length === 0) {
        void clearActiveDraft();
        return;
      }
      void saveDraft({ id: ACTIVE_DRAFT_ID, kind: 'active', lines, billDiscountPaise: 0 });
    },
    [lines, checked, pendingDraft],
    300,
  );

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      setLines,
      pendingDraft,
      resumeDraft: () => {
        if (pendingDraft) setLines(pendingDraft);
        setPendingDraft(null);
      },
      discardDraft: () => {
        void clearActiveDraft();
        setPendingDraft(null);
      },
    }),
    [lines, pendingDraft],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
