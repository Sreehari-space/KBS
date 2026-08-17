import React, { useState } from 'react';
import { NumericKeypad, appendDigit, backspace } from '@/components/ui/NumericKeypad';
import { useT } from '@/i18n/useT';

/**
 * Optional staff PIN.
 *
 * Deliberately modest: this keeps a curious customer or a child out of the
 * till screen. It is NOT encryption — the data on the device is not protected
 * by it, and the Settings copy says so rather than implying more.
 */
export const LockScreen: React.FC<{ pin: string; onUnlock: () => void }> = ({ pin, onUnlock }) => {
  const { t } = useT();
  const [entry, setEntry] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = (value: string) => {
    if (value === pin) {
      onUnlock();
    } else if (value.length >= pin.length) {
      setWrong(true);
      setTimeout(() => {
        setEntry('');
        setWrong(false);
      }, 600);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-light-bg dark:bg-dark-bg flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-1">KBS</h1>
      <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
        {t('lock.title')}
      </p>

      <div className={`flex gap-3 mb-8 ${wrong ? 'animate-pulse' : ''}`}>
        {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full border-2 ${
              wrong
                ? 'border-red-500 bg-red-500'
                : i < entry.length
                  ? 'border-brand-primary bg-brand-primary'
                  : 'border-light-line dark:border-dark-line'
            }`}
          />
        ))}
      </div>

      {wrong && <p className="text-red-500 font-medium mb-4">{t('lock.wrong')}</p>}

      <div className="w-full max-w-xs">
        <NumericKeypad
          allowDecimal={false}
          onDigit={(d) =>
            setEntry((cur) => {
              const next = appendDigit(cur === '0' ? '' : cur, d, 0);
              submit(next);
              return next;
            })
          }
          onBackspace={() => setEntry(backspace)}
        />
      </div>
    </div>
  );
};
