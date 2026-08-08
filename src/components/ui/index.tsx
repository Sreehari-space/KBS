import React from 'react';
import { IconClose } from '@/components/icons';

/** Shared primitives. Deliberately small — this app has few widget types. */

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`bg-light-surface dark:bg-dark-surface rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}
  >
    {children}
  </div>
);

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-primary text-white hover:bg-brand-primary-hover active:bg-brand-primary-hover',
  secondary:
    'bg-brand-secondary text-white hover:bg-brand-secondary-hover active:bg-brand-secondary-hover',
  // A border is what makes a ghost button read as a control rather than as
  // floating text — without it these looked disabled on a white sheet.
  ghost:
    'bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-light-text dark:text-dark-text hover:bg-slate-200 dark:hover:bg-slate-600',
  danger: 'bg-red-700 text-white hover:bg-red-800',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; full?: boolean }
> = ({ variant = 'primary', full, className = '', children, ...rest }) => (
  <button
    {...rest}
    className={`px-4 py-3 rounded-md font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
      VARIANTS[variant]
    } ${full ? 'w-full' : ''} ${className}`}
  >
    {children}
  </button>
);

export const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, hint, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">
      {label}
    </span>
    {children}
    {hint && (
      <span className="block text-xs mt-1 text-light-text-secondary dark:text-dark-text-secondary">
        {hint}
      </span>
    )}
  </label>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...rest
}) => (
  <input
    {...rest}
    className={`w-full px-3 py-2.5 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary ${className}`}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <select
    {...rest}
    className={`w-full px-3 py-2.5 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary ${className}`}
  >
    {children}
  </select>
);

export const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}> = ({ checked, onChange, label, hint }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex items-start gap-3 w-full text-left py-2"
  >
    <span
      className={`mt-0.5 flex-shrink-0 w-11 h-6 rounded-full transition-colors relative ${
        checked ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </span>
    <span>
      <span className="block font-medium">{label}</span>
      {hint && (
        <span className="block text-xs text-light-text-secondary dark:text-dark-text-secondary">
          {hint}
        </span>
      )}
    </span>
  </button>
);

/** Bottom sheet on phones, centred dialog on wide screens. */
export const Sheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Blocks backdrop dismissal — used where a stray tap would lose work. */
  persistent?: boolean;
}> = ({ open, onClose, title, children, persistent }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center no-print">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={persistent ? undefined : onClose}
        aria-hidden
      />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-light-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl shadow-2xl">
        {title && (
          <div className="sticky top-0 bg-light-surface dark:bg-dark-surface px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-light-text-secondary dark:text-dark-text-secondary"
              aria-label="Close"
            >
              <IconClose className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-5 pb-safe">{children}</div>
      </div>
    </div>
  );
};

export const Banner: React.FC<{
  tone: 'warning' | 'danger' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
}> = ({ tone, children, onDismiss }) => {
  const tones = {
    warning: 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100',
    danger: 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-900 dark:text-red-100',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100',
  };
  return (
    <div className={`border rounded-md px-4 py-3 text-sm flex items-start gap-3 ${tones[tone]}`}>
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="opacity-60 hover:opacity-100 flex-shrink-0"
          aria-label="Dismiss"
        >
          <IconClose className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<{ title: string; hint?: string; icon?: React.ReactNode }> = ({
  title,
  hint,
  icon,
}) => (
  <div className="text-center py-12 px-6 text-light-text-secondary dark:text-dark-text-secondary">
    {icon && <div className="flex justify-center mb-3 opacity-40">{icon}</div>}
    <p className="font-medium">{title}</p>
    {hint && <p className="text-sm mt-1">{hint}</p>}
  </div>
);
