import React from 'react';
import { IconBackspace } from '@/components/icons';
import { useT } from '@/i18n/useT';

/**
 * On-screen keypad. The billing path never relies on the device keyboard —
 * it covers half the screen, and the shopkeeper needs the running total
 * visible while typing.
 */
export const NumericKeypad: React.FC<{
  onDigit: (d: string) => void;
  onBackspace: () => void;
  allowDecimal?: boolean;
}> = ({ onDigit, onBackspace, allowDecimal = true }) => {
  const { t } = useT();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', allowDecimal ? '.' : '', '0', 'back'];

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key, i) => {
        if (key === '') return <div key={i} />;
        const isBackspace = key === 'back';
        return (
          <button
            key={i}
            type="button"
            onClick={() => (isBackspace ? onBackspace() : onDigit(key))}
            aria-label={isBackspace ? t('common.backspace') : key}
            className="py-4 text-xl font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:bg-slate-300 dark:active:bg-slate-500 tnum flex items-center justify-center"
          >
            {isBackspace ? <IconBackspace className="w-6 h-6" /> : key}
          </button>
        );
      })}
    </div>
  );
};

/** Append a digit to a numeric string, keeping it a valid decimal. */
export function appendDigit(current: string, digit: string, maxDecimals = 3): string {
  if (digit === '.') {
    return current.includes('.') ? current : current === '' ? '0.' : `${current}.`;
  }
  const [, decimals] = current.split('.');
  if (decimals !== undefined && decimals.length >= maxDecimals) return current;
  if (current === '0') return digit;
  return current + digit;
}

export const backspace = (current: string): string => current.slice(0, -1);
