import React from 'react';
import { Sheet } from '@/components/ui';
import { useT } from '@/i18n/useT';
import type { TranslationKey } from '@/i18n/en';

/** `key` is rendered literally, so write it the way it is printed on the cap. */
const SHORTCUTS: Array<{ keys: string[]; label: TranslationKey }> = [
  { keys: ['/'], label: 'keys.search' },
  { keys: ['F2'], label: 'keys.scan' },
  { keys: ['↑', '↓', '←', '→'], label: 'keys.move' },
  { keys: ['Enter'], label: 'keys.add' },
  { keys: ['+'], label: 'keys.qtyUp' },
  { keys: ['−'], label: 'keys.qtyDown' },
  { keys: ['F4'], label: 'keys.cart' },
  { keys: ['F9'], label: 'keys.pay' },
  { keys: ['Esc'], label: 'keys.close' },
  { keys: ['?'], label: 'keys.help' },
];

/**
 * The discoverable half of keyboard-first billing.
 *
 * Shortcuts nobody can find are a feature for one person — the one who wrote
 * them. This opens on `?`, and the hint chip that advertises it only appears
 * once a hardware keyboard has actually been used, so a phone never sees it.
 */
export const ShortcutsOverlay: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { t } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('keys.title')}>
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
        {t('keys.billingOnly')}
      </p>
      <dl className="divide-y divide-light-line dark:divide-dark-line">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-sm">{t(shortcut.label)}</dt>
            <dd className="flex gap-1 flex-shrink-0">
              {shortcut.keys.map((cap) => (
                <Kbd key={cap}>{cap}</Kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
};

/**
 * A key cap.
 *
 * The text colour is stated explicitly rather than inherited: these chips also
 * sit inside the primary BILL button, where inheriting `text-white` put white
 * type on a near-white cap and made the shortcut invisible.
 */
export const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="min-w-[1.75rem] text-center px-1.5 py-0.5 rounded border border-light-line dark:border-dark-line bg-light-bg dark:bg-white/10 text-light-text dark:text-dark-text text-xs font-semibold leading-normal shadow-[0_1px_0_rgb(0_0_0/0.12)]">
    {children}
  </kbd>
);
