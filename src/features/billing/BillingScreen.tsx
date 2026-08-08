import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Banner, Button, EmptyState, Input, Sheet } from '@/components/ui';
import { QuantitySheet } from './QuantitySheet';
import { PaymentSheet } from './PaymentSheet';
import { CartPanel } from './CartPanel';
import { ScannerSheet, type ScanHit } from '@/features/scanner/ScannerSheet';
import { NewProductSheet } from '@/features/inventory/NewProductSheet';
import { addToCart, computeTotals, recalcLine } from '@/domain/cart';
import { formatINR } from '@/domain/money';
import { looksLikeMarketingQr, normaliseBarcode, parseWeightBarcode } from '@/domain/barcode';
import { isFractionalUnit, type Payment, type Product, type Sale } from '@/domain/types';
import { findByBarcode, listProducts, quickTiles } from '@/data/repositories/productRepo';
import {
  ACTIVE_DRAFT_ID,
  clearActiveDraft,
  commitSale,
  holdCurrentCart,
  listHeldBills,
  resumeHeldBill,
} from '@/data/repositories/saleRepo';
import { VoiceSheet, isVoiceAvailable } from '@/features/voice/VoiceSheet';
import type { CartDraft } from '@/domain/types';
import { useCart } from './CartContext';
import { useSettings } from '@/hooks/useSettings';
import { productName, unitLabel, useT } from '@/i18n/useT';

export const BillingScreen: React.FC<{ onBilled: (sale: Sale) => void }> = ({ onBilled }) => {
  const { t, lang } = useT();
  const settings = useSettings();

  const products = useLiveQuery(() => listProducts(), [], [] as Product[]);
  const tiles = useLiveQuery(() => quickTiles(), [], [] as Product[]);

  const { lines, setLines, pendingDraft, resumeDraft, discardDraft } = useCart();
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

  const handleProductTap = (product: Product) => {
    // Weight items need a quantity; piece items just increment.
    if (isFractionalUnit(product.unit)) {
      setQtyProduct(product);
    } else {
      setLines((cur) => addToCart(cur, product, 1));
    }
  };

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
      // Only now — after the transaction committed — is the sale real.
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
            <p className="text-sm mt-1">{t('billing.cart')} — {lines.length} {t('billing.items')}</p>
          </Banner>
        </div>
      )}

      {/* Search + scan */}
      <div className="px-4 pt-4 flex gap-2 flex-shrink-0">
        <Input
          type="search"
          placeholder={t('billing.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <button
          onClick={() => setScannerOpen(true)}
          className="flex-shrink-0 px-4 rounded-lg bg-brand-secondary text-white font-semibold hover:bg-green-600 active:bg-green-700 flex items-center gap-1.5"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M4 7V5a1 1 0 011-1h2M4 17v2a1 1 0 001 1h2M20 7V5a1 1 0 00-1-1h-2M20 17v2a1 1 0 01-1 1h-2" />
            <path strokeLinecap="round" d="M7 8v8M10 8v8M13 8v8M16 8v8" />
          </svg>
          {t('billing.scan')}
        </button>
        {isVoiceAvailable() && (
          <button
            onClick={() => setVoiceOpen(true)}
            className="flex-shrink-0 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-xl"
            aria-label={t('voice.title')}
          >
            🎤
          </button>
        )}
      </div>

      {(heldBills ?? []).length > 0 && (
        <div className="px-4 pt-2 flex-shrink-0">
          <button
            onClick={() => setHeldOpen(true)}
            className="w-full text-sm py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 font-medium"
          >
            {t('billing.heldBills')}: {(heldBills ?? []).length}
          </button>
        </div>
      )}

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!search && (
          <h2 className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">
            {t('billing.quickItems')}
          </h2>
        )}
        {visibleProducts.length === 0 ? (
          <EmptyState title={search ? t('billing.noResults') : t('billing.cartEmptyHint')} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visibleProducts.map((p) => {
              const out = p.trackStock && p.stockQty <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => !out && handleProductTap(p)}
                  disabled={out}
                  className={`text-left p-3 rounded-xl border transition-colors ${
                    out
                      ? 'opacity-40 border-slate-200 dark:border-slate-700'
                      : 'bg-light-surface dark:bg-dark-surface border-slate-200 dark:border-slate-700 hover:border-brand-primary active:bg-slate-100 dark:active:bg-slate-700'
                  }`}
                >
                  <p className="font-semibold text-sm leading-snug line-clamp-2 min-h-[2.6em]">
                    {productName(p, lang)}
                  </p>
                  <div className="mt-2 flex items-baseline justify-between gap-1">
                    <span className="font-bold text-brand-primary tnum">
                      {formatINR(p.sellPricePaise)}
                    </span>
                    <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                      /{unitLabel(p.unit, lang)}
                    </span>
                  </div>
                  {p.trackStock && (
                    <p
                      className={`text-[11px] mt-0.5 tnum ${
                        p.stockQty <= p.lowStockThreshold
                          ? 'text-red-500 font-semibold'
                          : 'text-light-text-secondary dark:text-dark-text-secondary'
                      }`}
                    >
                      {out ? t('billing.outOfStock') : `${p.stockQty} ${t('billing.inStock')}`}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky total bar — the running amount stays readable while adding items */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-light-surface dark:bg-dark-surface px-4 py-3 pb-safe">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCartOpen(true)}
            disabled={lines.length === 0}
            className="flex-1 text-left disabled:opacity-50"
          >
            <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {lines.length} {lines.length === 1 ? t('billing.item') : t('billing.items')}
            </span>
            <span className="block text-2xl font-bold tnum">{formatINR(totals.totalPaise)}</span>
          </button>
          <Button
            onClick={() => setPayOpen(true)}
            disabled={lines.length === 0 || committing}
            className="px-8 py-4 text-lg"
          >
            {t('billing.bill')}
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
        {lines.length > 0 && (
          <div className="flex gap-2 mb-3">
            <Button
              variant="ghost"
              className="flex-1 py-2 text-sm"
              onClick={async () => {
                await holdCurrentCart(
                  { id: ACTIVE_DRAFT_ID, kind: 'active', lines, billDiscountPaise: 0, updatedAt: '' },
                  new Date().toLocaleTimeString(),
                );
                setLines([]);
                setCartOpen(false);
              }}
            >
              {t('billing.hold')}
            </Button>
            <Button
              variant="ghost"
              className="flex-1 py-2 text-sm"
              onClick={() => {
                setLines([]);
                void clearActiveDraft();
                setCartOpen(false);
              }}
            >
              {t('billing.clear')}
            </Button>
          </div>
        )}
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
          className="mt-4"
          onClick={() => {
            setCartOpen(false);
            setPayOpen(true);
          }}
          disabled={lines.length === 0}
        >
          {t('billing.bill')} · {formatINR(totals.totalPaise)}
        </Button>
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
          unknownBarcode && looksLikeMarketingQr(unknownBarcode)
            ? t('scan.marketingQr')
            : undefined
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
          {(heldBills ?? []).map((held) => (
            <button
              key={held.id}
              onClick={async () => {
                const resumed = await resumeHeldBill(held.id);
                if (resumed) setLines(resumed.lines);
                setHeldOpen(false);
              }}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-lg bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700"
            >
              <span className="font-medium">{held.label}</span>
              <span className="text-sm tnum">
                {held.lines.length} {t('billing.items')}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
};
