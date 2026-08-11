import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AnimatedMoney,
  Banner,
  Button,
  EmptyState,
  Input,
  Money,
  Sheet,
  SkeletonTiles,
} from '@/components/ui';
import { IconCheck, IconMic, IconScan, IconSearch, IconTrash } from '@/components/icons';
import { Kbd } from '@/components/ShortcutsOverlay';
import { QuantitySheet } from './QuantitySheet';
import { PaymentSheet } from './PaymentSheet';
import { CartPanel } from './CartPanel';
import { ScannerSheet, type ScanHit } from '@/features/scanner/ScannerSheet';
import { NewProductSheet } from '@/features/inventory/NewProductSheet';
import { addToCart, computeTotals, recalcLine } from '@/domain/cart';
import { looksLikeMarketingQr, normaliseBarcode, parseWeightBarcode } from '@/domain/barcode';
import { isFractionalUnit, type Payment, type Product, type Sale } from '@/domain/types';
import { findByBarcode, listProducts, quickTiles } from '@/data/repositories/productRepo';
import {
  ACTIVE_DRAFT_ID,
  clearActiveDraft,
  commitSale,
  discardHeldBill,
  holdCurrentCart,
  listHeldBills,
  peekNextBillNo,
  resumeHeldBill,
} from '@/data/repositories/saleRepo';
import { VoiceSheet, isVoiceAvailable } from '@/features/voice/VoiceSheet';
import type { CartDraft } from '@/domain/types';
import { useCart } from './CartContext';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useSettings } from '@/hooks/useSettings';
import { productName, unitLabel, useT } from '@/i18n/useT';

/**
 * Column count of the product grid, mirroring the Tailwind classes below.
 * The arrow keys need it to move a row rather than a cell.
 */
function useGridColumns(): number {
  const [columns, setColumns] = useState(2);
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      setColumns(w >= 1024 ? 4 : w >= 640 ? 3 : 2);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return columns;
}

export const BillingScreen: React.FC<{
  onBilled: (sale: Sale) => void;
  onNavigate: (screen: 'inventory') => void;
  keyboardUser: boolean;
}> = ({ onBilled, onNavigate, keyboardUser }) => {
  const { t, lang } = useT();
  const settings = useSettings();

  // No default value: `undefined` is the loading state, and a skeleton grid is
  // what belongs there. The old default of `[]` rendered "no items found" for
  // a frame every time the screen mounted.
  const products = useLiveQuery(() => listProducts(), []);
  const tiles = useLiveQuery(() => quickTiles(), []);
  const nextBillNo = useLiveQuery(() => peekNextBillNo(), []);

  const { lines, setLines, pendingDraft, resumeDraft, discardDraft, saveState } = useCart();
  const [search, setSearch] = useState('');
  const [qtyProduct, setQtyProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const columns = useGridColumns();

  const heldBills = useLiveQuery(() => listHeldBills(), [], [] as CartDraft[]);

  const totals = useMemo(
    () =>
      computeTotals({
        lines,
        billDiscountPaise: 0,
        gst: { enabled: settings.gst.enabled, pricesIncludeTax: settings.gst.pricesIncludeTax },
        roundOffEnabled: settings.billing.roundOffEnabled,
      }),
    [lines, settings.gst.enabled, settings.gst.pricesIncludeTax, settings.billing.roundOffEnabled],
  );

  const loading = products === undefined || tiles === undefined;

  const visibleProducts = useMemo(() => {
    const all = products ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return tiles ?? [];
    return all.filter(
      (p) =>
        p.nameEn.toLowerCase().includes(q) ||
        p.nameTa.includes(search.trim()) ||
        p.category.toLowerCase().includes(q) ||
        p.barcodes.some((b) => b.includes(q)),
    );
  }, [products, tiles, search]);

  // A new result set always starts at the first item, so Enter after typing
  // adds the top match — the single most-used keyboard path.
  useEffect(() => setActiveIndex(0), [search, visibleProducts.length]);

  const anySheetOpen =
    cartOpen ||
    payOpen ||
    scannerOpen ||
    voiceOpen ||
    heldOpen ||
    confirmClear ||
    qtyProduct !== null ||
    unknownBarcode !== null;

  const addProduct = useCallback(
    (product: Product) => {
      // Weight items need a quantity; piece items just increment.
      if (isFractionalUnit(product.unit)) {
        setQtyProduct(product);
        return;
      }
      setLines((cur) => addToCart(cur, product, 1));
      setFlashId(product.id);
    },
    [setLines],
  );

  useEffect(() => {
    if (!flashId) return;
    const id = window.setTimeout(() => setFlashId(null), 240);
    return () => window.clearTimeout(id);
  }, [flashId]);

  /** Keep the keyboard-selected tile on screen without stealing focus. */
  useEffect(() => {
    const tile = gridRef.current?.children[activeIndex];
    tile?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const moveActive = useCallback(
    (delta: number) => {
      setActiveIndex((cur) => {
        const next = cur + delta;
        if (next < 0 || next >= visibleProducts.length) return cur;
        return next;
      });
    },
    [visibleProducts.length],
  );

  /** +/− act on the line most recently touched, which is the last one. */
  const bumpLastLine = useCallback(
    (delta: number) => {
      setLines((cur) => {
        if (cur.length === 0) return cur;
        const index = cur.length - 1;
        const line = cur[index]!;
        const step = isFractionalUnit(line.unit) ? 0.25 : 1;
        const qty = line.qty + delta * step;
        if (qty <= 0) return cur.filter((_, i) => i !== index);
        return cur.map((l, i) => (i === index ? recalcLine({ ...l, qty }) : l));
      });
    },
    [setLines],
  );

  useHotkeys(
    [
      {
        key: '/',
        handler: () => searchRef.current?.focus(),
      },
      { key: 'F2', whileTyping: true, handler: () => setScannerOpen(true) },
      {
        key: 'F4',
        whileTyping: true,
        handler: () => {
          if (lines.length > 0) setCartOpen(true);
        },
      },
      {
        key: 'F9',
        whileTyping: true,
        handler: () => {
          if (lines.length > 0) setPayOpen(true);
        },
      },
      { key: 'ArrowDown', whileTyping: true, handler: () => moveActive(columns) },
      { key: 'ArrowUp', whileTyping: true, handler: () => moveActive(-columns) },
      // Left/Right deliberately do NOT fire while typing: they are how the
      // caret moves inside the search box, and stealing that is worse than
      // the shortcut is worth. Up/Down are safe — a single-line input has
      // nowhere vertical to go — and Up/Down is the search-then-pick path.
      { key: 'ArrowRight', handler: () => moveActive(1) },
      { key: 'ArrowLeft', handler: () => moveActive(-1) },
      {
        key: 'Enter',
        whileTyping: true,
        handler: () => {
          const product = visibleProducts[activeIndex];
          if (product) addProduct(product);
        },
      },
      // Likewise: these are printable characters, so they only act when the
      // caret is not in a field.
      { key: '+', handler: () => bumpLastLine(1) },
      { key: '=', handler: () => bumpLastLine(1) },
      { key: '-', handler: () => bumpLastLine(-1) },
      {
        key: 'Escape',
        whileTyping: true,
        handler: () => {
          setSearch('');
          searchRef.current?.blur();
        },
      },
    ],
    // While a sheet is up, the sheet owns the keyboard. Escape is handled
    // inside Sheet itself, so nothing is lost by standing down here.
    !anySheetOpen,
  );

  /**
   * Learn-as-you-scan (D4). Known code -> straight into the cart. Unknown code
   * -> a prefilled new-product sheet, after which every future scan of that
   * packet is instant. The shop's catalogue builds itself during normal
   * billing, with no data-entry session up front.
   */
  const handleScan = async (rawCode: string): Promise<ScanHit> => {
    const code = normaliseBarcode(rawCode);

    // Scale-printed labels carry the weight in the barcode itself.
    const weight = parseWeightBarcode(code, settings.scanner.weightBarcodePrefix);
    if (weight) {
      const byItem = await findByBarcode(weight.itemCode);
      if (byItem) {
        setLines((cur) => addToCart(cur, byItem, weight.qtyKg));
        return {
          code,
          label: `${productName(byItem, lang)} · ${weight.qtyKg}kg`,
          known: true,
        };
      }
    }

    const product = await findByBarcode(code);
    if (product) {
      if (isFractionalUnit(product.unit)) {
        // Weight items still need a quantity, so pause scanning and ask.
        setScannerOpen(false);
        setQtyProduct(product);
      } else {
        setLines((cur) => addToCart(cur, product, 1));
      }
      return { code, label: productName(product, lang), known: true };
    }

    setScannerOpen(false);
    setUnknownBarcode(code);
    return { code, label: t('inv.newFromScan'), known: false };
  };

  const handleCommit = async (payments: Payment[], creditPaise: number, customerId?: string) => {
    setCommitting(true);
    setError(null);
    try {
      const sale = await commitSale({
        lines,
        subtotalPaise: totals.subtotalPaise,
        billDiscountPaise: totals.billDiscountPaise,
        taxPaise: totals.taxPaise,
        roundOffPaise: totals.roundOffPaise,
        totalPaise: totals.totalPaise,
        payments,
        creditPaise,
        ...(customerId ? { customerId } : {}),
      });
      // Only now — after the transaction committed — is the sale real. The
      // payment sheet collapses and the receipt rises in its place; that
      // hand-off is the one deliberate success moment in the app.
      setLines([]);
      setPayOpen(false);
      setCartOpen(false);
      onBilled(sale);
    } catch (err) {
      // The cart is deliberately left intact so the shopkeeper can retry with
      // the customer still standing at the counter.
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Draft recovery prompt */}
      {pendingDraft && (
        <div className="p-4">
          <Banner tone="info">
            <p className="font-semibold">{t('draft.title')}</p>
            <p className="mb-2">{t('draft.body')}</p>
            <div className="flex gap-2">
              <Button className="py-2 text-sm" onClick={resumeDraft}>
                {t('draft.resume')}
              </Button>
              <Button variant="ghost" className="py-2 text-sm" onClick={discardDraft}>
                {t('draft.discard')}
              </Button>
            </div>
          </Banner>
        </div>
      )}

      {error && (
        <div className="p-4">
          <Banner tone="danger" onDismiss={() => setError(null)}>
            <p className="font-semibold">{error}</p>
            <p className="text-sm mt-1">
              {t('billing.cart')} — {lines.length} {t('billing.items')}
            </p>
          </Banner>
        </div>
      )}

      {/* Search + scan */}
      <div className="px-4 pt-4 flex gap-2 flex-shrink-0">
        <div className="relative flex-1">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
          <Input
            ref={searchRef}
            type="search"
            placeholder={t('billing.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`pl-9 ${keyboardUser ? 'pr-9' : ''}`}
          />
          {keyboardUser && !search && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <Kbd>/</Kbd>
            </span>
          )}
        </div>
        <button
          onClick={() => setScannerOpen(true)}
          className="flex-shrink-0 px-4 rounded-md border border-slate-300 dark:border-slate-600 bg-light-surface dark:bg-dark-surface font-medium hover:border-brand-primary hover:text-brand-primary dark:hover:text-brand-on-dark transition-colors flex items-center gap-2 focus-ring"
        >
          <IconScan className="w-5 h-5" />
          {t('billing.scan')}
        </button>
        {isVoiceAvailable() && (
          <button
            onClick={() => setVoiceOpen(true)}
            className="flex-shrink-0 px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-light-surface dark:bg-dark-surface hover:border-brand-primary hover:text-brand-primary dark:hover:text-brand-on-dark transition-colors flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary focus-ring"
            aria-label={t('voice.title')}
          >
            <IconMic className="w-5 h-5" />
          </button>
        )}
      </div>

      {heldBills.length > 0 && (
        <div className="px-4 pt-2 flex-shrink-0">
          <button
            onClick={() => setHeldOpen(true)}
            className="w-full text-sm py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 font-medium focus-ring"
          >
            {t('billing.heldBills')}: {heldBills.length}
          </button>
        </div>
      )}

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4" aria-busy={loading}>
        {!search && !loading && visibleProducts.length > 0 && (
          <h2 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">
            {t('billing.quickItems')}
          </h2>
        )}
        {loading ? (
          <SkeletonTiles />
        ) : visibleProducts.length === 0 ? (
          search ? (
            <EmptyState
              title={t('billing.noResults')}
              hint={t('inv.newFromScanHint')}
              action={{ label: t('billing.scan'), onClick: () => setScannerOpen(true) }}
              secondaryAction={{ label: t('inv.add'), onClick: () => onNavigate('inventory') }}
            />
          ) : (
            <EmptyState
              title={t('billing.noTiles')}
              hint={t('billing.noTilesHint')}
              action={{ label: t('billing.scan'), onClick: () => setScannerOpen(true) }}
              secondaryAction={{ label: t('inv.add'), onClick: () => onNavigate('inventory') }}
            />
          )
        ) : (
          <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visibleProducts.map((p, index) => {
              const out = p.trackStock && p.stockQty <= 0;
              const marked = keyboardUser && index === activeIndex;
              return (
                // Out of stock WARNS but never blocks. The shopkeeper is
                // holding the packet; the app is not in a position to argue,
                // and a stale count must not stop a sale. This also matches
                // the scan path, which never checked stock.
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  aria-current={marked ? 'true' : undefined}
                  className={`flex flex-col text-left p-3 rounded-md border transition-colors bg-light-surface dark:bg-dark-surface hover:border-brand-primary active:bg-slate-100 dark:active:bg-slate-700 focus-ring ${
                    flashId === p.id ? 'animate-pop' : ''
                  } ${
                    marked
                      ? 'kbd-active'
                      : out
                        ? 'border-amber-400 dark:border-amber-600'
                        : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {/* min-h reserves exactly two lines at leading-snug. The
                      price AND the stock line share one bottom-pinned block,
                      and the stock line's height is always reserved — pinning
                      the price alone left it above the stock line on tracked
                      items but at the floor on untracked ones, so prices in a
                      row sat ~19px apart. */}
                  <p className="font-semibold text-sm leading-snug line-clamp-2 min-h-[3.1em]">
                    {productName(p, lang)}
                  </p>
                  <div className="mt-auto pt-2">
                    <div className="flex items-baseline justify-between gap-1">
                      <Money
                        paise={p.sellPricePaise}
                        className="font-bold text-brand-primary dark:text-brand-on-dark"
                      />
                      <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                        /{unitLabel(p.unit, lang)}
                      </span>
                    </div>
                    <p
                      // Fixed 16px slot with a matching line-box: a min-height
                      // in `em` did not equal the height of a rendered line,
                      // so empty and filled slots still differed by ~4px.
                      className={`text-[11px] mt-0.5 count h-4 leading-4 ${
                        out
                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                          : p.stockQty <= p.lowStockThreshold
                            ? 'text-red-500 font-semibold'
                            : 'text-light-text-secondary dark:text-dark-text-secondary'
                      }`}
                    >
                      {!p.trackStock
                        ? ''
                        : out
                          ? t('billing.outOfStock')
                          : `${p.stockQty} ${t('billing.inStock')}`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky total bar — the running amount stays readable while adding items */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-light-surface dark:bg-dark-surface px-4 py-3 pb-safe">
        {/* The bill number exists BEFORE the sale completes, so the sequence
            reads as a ledger rather than as a database key handed out later. */}
        <div className="flex items-center justify-between gap-3 mb-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
          <span className="count truncate">
            {nextBillNo ? `${t('billing.nextBill')} ${nextBillNo}` : ' '}
          </span>
          <SaveIndicator state={saveState} />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCartOpen(true)}
            disabled={lines.length === 0}
            className="flex-1 text-left disabled:opacity-50 rounded-md focus-ring"
          >
            <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary count">
              {lines.length} {lines.length === 1 ? t('billing.item') : t('billing.items')}
            </span>
            <AnimatedMoney paise={totals.totalPaise} className="block text-2xl font-bold" />
          </button>
          <Button
            onClick={() => setPayOpen(true)}
            disabled={lines.length === 0 || committing}
            className="px-8 py-4 text-lg flex items-center gap-2"
          >
            {t('billing.bill')}
            {keyboardUser && lines.length > 0 && <Kbd>F9</Kbd>}
          </Button>
        </div>
      </div>

      <QuantitySheet
        product={qtyProduct}
        onClose={() => setQtyProduct(null)}
        onAdd={(qty) => {
          if (qtyProduct) setLines((cur) => addToCart(cur, qtyProduct, qty));
          setQtyProduct(null);
        }}
      />

      <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title={t('billing.cart')}>
        {/* Customer forgot something and walked back to the aisle; the next
            person is waiting. Park the bill and serve them. */}
        <CartPanel
          lines={lines}
          totals={totals}
          onChangeQty={(index, qty) =>
            setLines((cur) =>
              qty <= 0
                ? cur.filter((_, i) => i !== index)
                : cur.map((l, i) => (i === index ? recalcLine({ ...l, qty }) : l)),
            )
          }
          onRemove={(index) => setLines((cur) => cur.filter((_, i) => i !== index))}
        />
        <Button
          full
          className="mt-4 flex items-center justify-center gap-2"
          onClick={() => {
            setCartOpen(false);
            setPayOpen(true);
          }}
          disabled={lines.length === 0}
        >
          <span>{t('billing.bill')}</span>
          <span aria-hidden>·</span>
          <Money paise={totals.totalPaise} />
        </Button>

        {/* Secondary actions sit BELOW the bill button, and the destructive
            one is a text link — it should not carry the same weight as Hold. */}
        {lines.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <Button
              variant="ghost"
              className="py-2 text-sm"
              onClick={async () => {
                await holdCurrentCart(
                  {
                    id: ACTIVE_DRAFT_ID,
                    kind: 'active',
                    lines,
                    billDiscountPaise: 0,
                    updatedAt: '',
                  },
                  new Date().toLocaleTimeString(),
                );
                setLines([]);
                setCartOpen(false);
              }}
            >
              {t('billing.hold')}
            </Button>
            {/* Confirmed, because it is the one destructive action on the
                billing path and it also wipes the saved draft. */}
            <button
              onClick={() => setConfirmClear(true)}
              className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-red-600 px-2 py-2 rounded focus-ring"
            >
              {t('billing.clear')}
            </button>
          </div>
        )}
      </Sheet>

      <PaymentSheet
        open={payOpen}
        totalPaise={totals.totalPaise}
        onClose={() => setPayOpen(false)}
        onComplete={handleCommit}
        busy={committing}
      />

      <ScannerSheet
        open={scannerOpen}
        continuous={settings.scanner.continuousMode}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />

      <NewProductSheet
        barcode={unknownBarcode}
        warning={
          unknownBarcode && looksLikeMarketingQr(unknownBarcode) ? t('scan.marketingQr') : undefined
        }
        onClose={() => setUnknownBarcode(null)}
        onCreated={(product) => {
          setUnknownBarcode(null);
          if (isFractionalUnit(product.unit)) setQtyProduct(product);
          else setLines((cur) => addToCart(cur, product, 1));
        }}
      />

      <VoiceSheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onPick={(product, qty) => setLines((cur) => addToCart(cur, product, qty))}
      />

      <Sheet open={heldOpen} onClose={() => setHeldOpen(false)} title={t('billing.heldBills')}>
        <div className="space-y-2">
          {heldBills.map((held) => (
            <div
              key={held.id}
              className="flex items-stretch gap-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <button
                onClick={async () => {
                  const resumed = await resumeHeldBill(held.id);
                  if (resumed) setLines(resumed.lines);
                  setHeldOpen(false);
                }}
                className="flex-1 flex items-center justify-between gap-3 p-3 text-left focus-ring"
              >
                <span className="font-medium">{held.label}</span>
                <span className="text-sm count">
                  {held.lines.length} {t('billing.items')}
                </span>
              </button>
              {/* A customer who walks out leaves a parked bill behind. Without
                  this the only way to clear one was to serve it. */}
              <button
                onClick={() => void discardHeldBill(held.id)}
                className="px-3 text-light-text-secondary dark:text-dark-text-secondary hover:text-red-600 focus-ring"
                aria-label={t('draft.discard')}
              >
                <IconTrash className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={confirmClear} onClose={() => setConfirmClear(false)} title={t('billing.clear')}>
        <p className="mb-4">{t('billing.clearConfirm')}</p>
        <div className="flex gap-3">
          <Button variant="ghost" full onClick={() => setConfirmClear(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            full
            onClick={() => {
              setLines([]);
              void clearActiveDraft();
              setConfirmClear(false);
              setCartOpen(false);
            }}
          >
            {t('billing.clear')}
          </Button>
        </div>
      </Sheet>
    </div>
  );
};

/**
 * A quiet statement of fact, not a toast.
 *
 * The width is fixed so the row above the total never reflows between
 * "Saving…" and "Saved" — a jumping label is exactly the kind of small
 * cheapness this whole pass is about removing.
 */
const SaveIndicator: React.FC<{ state: 'idle' | 'saving' | 'saved' }> = ({ state }) => {
  const { t } = useT();
  if (state === 'idle') return <span aria-hidden>&nbsp;</span>;
  return (
    <span
      className="flex items-center gap-1 flex-shrink-0 tabular-nums"
      role="status"
      aria-live="polite"
    >
      {state === 'saved' ? (
        <>
          <IconCheck className="w-3.5 h-3.5 text-brand-secondary" />
          {t('save.saved')}
        </>
      ) : (
        t('save.saving')
      )}
    </span>
  );
};
