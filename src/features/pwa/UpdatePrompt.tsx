import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui';
import { IconClose } from '@/components/icons';
import { useT } from '@/i18n/useT';

/**
 * Service-worker update prompt.
 *
 * Deliberately a prompt, never an auto-reload: reloading the page mid-bill
 * would throw away the cart. The shopkeeper decides when to take the update.
 */
export const UpdatePrompt: React.FC = () => {
  const { t } = useT();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 no-print sm:left-auto sm:w-80">
      <div className="rounded-xl bg-light-surface dark:bg-dark-surface border border-slate-200 dark:border-slate-700 shadow-lg p-4 flex items-center gap-3">
        <span className="flex-1 font-medium">{t('common.update')}</span>
        <Button className="py-2 px-4 text-sm" onClick={() => void updateServiceWorker(true)}>
          {t('common.updateNow')}
        </Button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="text-light-text-secondary dark:text-dark-text-secondary p-1"
          aria-label="Dismiss"
        >
          <IconClose className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
