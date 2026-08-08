import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, EmptyState, Field, Input, Select, Sheet, Toggle } from '@/components/ui';
import { IconChevronDown, IconChevronRight, IconPlus } from '@/components/icons';
import { formatINR, formatQty, parseRupeeInput, paiseToRupees } from '@/domain/money';
import {
  createProduct,
  deleteProduct,
  listCategories,
  listProducts,
  updateProduct,
} from '@/data/repositories/productRepo';
import { isTanglish, suggestNames } from '@/domain/tamil/suggest';
import { detectScript } from '@/domain/tamil/transliterate';
import { productName, unitLabel, useT } from '@/i18n/useT';
import type { Product, Unit } from '@/domain/types';

const UNITS: Unit[] = ['piece', 'packet', 'kg', 'g', 'litre', 'ml'];

type Draft = {
  id?: string;
  nameEn: string;
  nameTa: string;
  barcode: string;
  category: string;
  unit: Unit;
  price: string;
  cost: string;
  stock: string;
  low: string;
  trackStock: boolean;
  isQuickTile: boolean;
};

// Stock tracking is OFF by default: saving with tracking on and no quantity
// used to create a product that was instantly "out of stock". Turn it on
// deliberately, from More details.
const emptyDraft: Draft = {
  nameEn: '',
  nameTa: '',
  barcode: '',
  category: '',
  unit: 'piece',
  price: '',
  cost: '',
  stock: '0',
  low: '0',
  trackStock: false,
  isQuickTile: false,
};

export const InventoryScreen: React.FC = () => {
  const { t, lang } = useT();
  const products = useLiveQuery(() => listProducts(), [], [] as Product[]);
  const categories = useLiveQuery(() => listCategories(), [], [] as string[]);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showMore, setShowMore] = useState(false);
  // Once the Tamil name is typed by hand, auto-fill stops overwriting it.
  const [tamilEdited, setTamilEdited] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const visible = useMemo(() => {
    const all = products ?? [];
    const q = search.trim().toLowerCase();
    return all
      .filter(
        (p) =>
          !q ||
          p.nameEn.toLowerCase().includes(q) ||
          p.nameTa.includes(search.trim()) ||
          p.barcodes.some((b) => b.includes(q)),
      )
      .filter((p) => {
        if (filter === 'all') return true;
        if (filter === 'low') return p.trackStock && p.stockQty <= p.lowStockThreshold;
        return p.category === filter;
      });
  }, [products, search, filter]);

  const openEdit = (p: Product) => {
    setShowMore(false);
    setTamilEdited(Boolean(p.nameTa.trim()));
    setDraft({
      id: p.id,
      nameEn: p.nameEn,
      nameTa: p.nameTa,
      barcode: p.barcodes[0] ?? '',
      category: p.category,
      unit: p.unit,
      price: String(paiseToRupees(p.sellPricePaise)),
      cost: p.costPricePaise ? String(paiseToRupees(p.costPricePaise)) : '',
      stock: String(p.stockQty),
      low: String(p.lowStockThreshold),
      trackStock: p.trackStock,
      isQuickTile: p.isQuickTile,
    });
  };

  const save = async () => {
    if (!draft) return;
    const price = parseRupeeInput(draft.price);
    if (!draft.nameEn.trim() || price === null) return;

    const cost = parseRupeeInput(draft.cost);
    const payload = {
      nameEn: draft.nameEn.trim(),
      nameTa: draft.nameTa.trim(),
      barcodes: draft.barcode.trim() ? [draft.barcode.trim()] : [],
      category: draft.category.trim() || 'General',
      unit: draft.unit,
      sellPricePaise: price,
      ...(cost !== null ? { costPricePaise: cost } : {}),
      stockQty: Number(draft.stock) || 0,
      lowStockThreshold: Number(draft.low) || 0,
      trackStock: draft.trackStock,
      isQuickTile: draft.isQuickTile,
    };

    if (draft.id) await updateProduct(draft.id, payload);
    else await createProduct(payload);
    setDraft(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-4 pt-4 space-y-3">
        <div className="flex gap-2">
          <Input
            type="search"
            placeholder={t('billing.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={() => {
              setShowMore(false);
              setTamilEdited(false);
              setDraft(emptyDraft);
            }}
            className="px-4"
            aria-label={t('inv.add')}
          >
            <IconPlus className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: t('inv.all') },
            { id: 'low', label: t('inv.lowStock') },
            ...(categories ?? []).map((c) => ({ id: c, label: c })),
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-full ${
                filter === f.id
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {visible.length === 0 ? (
          <EmptyState title={t('billing.noResults')} />
        ) : (
          <div className="space-y-2">
            {visible.map((p) => {
              const low = p.trackStock && p.stockQty <= p.lowStockThreshold;
              return (
                <button
                  key={p.id}
                  onClick={() => openEdit(p)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{productName(p, lang)}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                      {p.category} · {unitLabel(p.unit, lang)}
                      {p.barcodes.length > 0 && ` · ${p.barcodes[0]}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold tnum">{formatINR(p.sellPricePaise)}</p>
                    {p.trackStock && (
                      <p
                        className={`text-xs tnum ${
                          low ? 'text-red-500 font-semibold' : 'text-light-text-secondary dark:text-dark-text-secondary'
                        }`}
                      >
                        {formatQty(p.stockQty)} {unitLabel(p.unit, lang)}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('inv.edit') : t('inv.add')}
      >
        {draft && (
          <div className="space-y-3">
            {/* Name and price are all that is required; everything else has a
                working default and lives under More details. */}
            <Field label={t('inv.name')}>
              <Input
                value={draft.nameEn}
                onChange={(e) => {
                  const typed = e.target.value;
                  const suggestion = suggestNames(typed);
                  const typedTamil = detectScript(typed) === 'tamil';
                  setDraft({
                    ...draft,
                    // Tanglish and Tamil script both resolve to a real English
                    // name; plain English is left exactly as typed.
                    nameEn:
                      (isTanglish(typed) || typedTamil) && suggestion.nameEn
                        ? suggestion.nameEn
                        : typed,
                    nameTa: tamilEdited
                      ? draft.nameTa
                      : typedTamil
                        ? typed
                        : suggestion.nameTa,
                  });
                }}
                autoFocus
                className="text-lg"
              />
            </Field>

            {(draft.nameTa || tamilEdited) && (
              <Field label={t('inv.nameTa')} hint={tamilEdited ? undefined : t('inv.autoTamil')}>
                <Input
                  value={draft.nameTa}
                  onChange={(e) => {
                    setTamilEdited(true);
                    setDraft({ ...draft, nameTa: e.target.value });
                  }}
                />
              </Field>
            )}
            <Field label={t('inv.price')}>
              <Input
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                placeholder="0"
                className="text-lg tnum"
              />
            </Field>
            <Field label={`${t('inv.barcode')} (${t('common.optional')})`}>
              <Input
                inputMode="numeric"
                value={draft.barcode}
                onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
                className="tnum"
              />
            </Field>

            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="w-full flex items-center gap-1.5 text-sm font-medium text-brand-primary dark:text-brand-on-dark py-1"
            >
              {showMore ? (
                <IconChevronDown className="w-4 h-4" />
              ) : (
                <IconChevronRight className="w-4 h-4" />
              )}
              {t('inv.moreDetails')}
            </button>

            {showMore && (
              <div className="space-y-3 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('inv.category')}>
                    <Input
                      list="kbs-categories"
                      value={draft.category}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    />
                    <datalist id="kbs-categories">
                      {(categories ?? []).map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label={t('inv.unit')}>
                    <Select
                      value={draft.unit}
                      onChange={(e) => setDraft({ ...draft, unit: e.target.value as Unit })}
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {unitLabel(u, lang)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={`${t('inv.cost')} (${t('common.optional')})`}>
                    <Input
                      inputMode="decimal"
                      value={draft.cost}
                      onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
                    />
                  </Field>
                </div>

                <Toggle
                  checked={draft.trackStock}
                  onChange={(v) => setDraft({ ...draft, trackStock: v })}
                  label={t('inv.trackStock')}
                />
                {draft.trackStock && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('inv.stock')}>
                      <Input
                        inputMode="decimal"
                        value={draft.stock}
                        onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                      />
                    </Field>
                    <Field label={t('inv.lowStockAt')}>
                      <Input
                        inputMode="decimal"
                        value={draft.low}
                        onChange={(e) => setDraft({ ...draft, low: e.target.value })}
                      />
                    </Field>
                  </div>
                )}
                <Toggle
                  checked={draft.isQuickTile}
                  onChange={(v) => setDraft({ ...draft, isQuickTile: v })}
                  label={t('inv.quickTile')}
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {draft.id && (
                <Button
                  variant="danger"
                  onClick={() => {
                    const p = (products ?? []).find((x) => x.id === draft.id);
                    if (p) setConfirmDelete(p);
                  }}
                >
                  {t('common.delete')}
                </Button>
              )}
              <Button full onClick={save}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={t('common.confirm')}
      >
        <p className="mb-4">{confirmDelete && productName(confirmDelete, lang)}</p>
        <div className="flex gap-3">
          <Button variant="ghost" full onClick={() => setConfirmDelete(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            full
            onClick={async () => {
              if (confirmDelete) await deleteProduct(confirmDelete.id);
              setConfirmDelete(null);
              setDraft(null);
            }}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Sheet>
    </div>
  );
};
