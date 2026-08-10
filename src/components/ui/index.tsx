import React, { useEffect, useState } from 'react';
import { IconCheck, IconClose } from '@/components/icons';

/** Shared primitives. Deliberately small — this app has few widget types. */

export { Money, AnimatedMoney, splitAmount } from './Money';
export { Skeleton, SkeletonStat, SkeletonRows, SkeletonTiles } from './Skeleton';
export { Sparkline } from './Sparkline';

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
    className={`px-4 py-3 rounded-md font-semibold transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 focus-ring ${
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

// `ref` is an ordinary prop in React 19, so it travels in `rest` — no
// forwardRef wrapper needed. The billing screen needs it to focus the search
// box on "/".
export const Input: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }
> = ({ className = '', ...rest }) => (
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
    className="flex items-start gap-3 w-full text-left py-2 rounded-md focus-ring"
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

/**
 * A real checkbox affordance.
 *
 * The shelf-label list used tinted backgrounds alone to show selection, next
 * to a button reading "Print labels (0)" — nothing on the row said it could
 * be ticked. A box that fills is unambiguous at a glance and in a screenshot.
 */
export const Checkbox: React.FC<{ checked: boolean; className?: string }> = ({
  checked,
  className = '',
}) => (
  <span
    aria-hidden
    className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
      checked
        ? 'bg-brand-primary border-brand-primary text-white'
        : 'border-slate-400 dark:border-slate-500'
    } ${className}`}
  >
    {checked && <IconCheck className="w-3.5 h-3.5" />}
  </span>
);

/**
 * Bottom sheet on phones, centred dialog on wide screens.
 *
 * Enters and leaves with motion: sheets rise from the edge they belong to,
 * and leave faster than they arrive (200ms in, 140ms out) — a dismissal
 * should feel like it obeyed you instantly. The element stays mounted for the
 * length of the exit, which is why `open` is tracked in state here rather
 * than short-circuiting on the prop.
 *
 * Escape closes it. That is the keyboard contract for every overlay in the
 * app, so it lives here once rather than in each caller.
 */
export const Sheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Blocks backdrop dismissal — used where a stray tap would lose work. */
  persistent?: boolean;
}> = ({ open, onClose, title, children, persistent }) => {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    setLeaving(true);
    const id = window.setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, 140);
    return () => window.clearTimeout(id);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    // Capture phase: the topmost sheet handles Escape before the screen-level
    // shortcuts do, so Escape never skips two levels at once.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center no-print"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? undefined}
    >
      <div
        className={`absolute inset-0 bg-black/50 ${leaving ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={persistent ? undefined : onClose}
        aria-hidden
      />
      <div
        className={`relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-light-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl shadow-2xl ${
          leaving
            ? 'animate-sheet-out sm:animate-dialog-out'
            : 'animate-sheet-in sm:animate-dialog-in'
        }`}
      >
        {title && (
          <div className="sticky top-0 z-10 bg-light-surface dark:bg-dark-surface px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 rounded-md text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text focus-ring"
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
    <div
      className={`border rounded-md px-4 py-3 text-sm flex items-start gap-3 animate-fade-in ${tones[tone]}`}
    >
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="opacity-60 hover:opacity-100 flex-shrink-0 rounded focus-ring"
          aria-label="Dismiss"
        >
          <IconClose className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

/**
 * Empty states do work.
 *
 * An icon and two lines of sympathy is a dead end. Every empty screen in this
 * app knows the one thing the shopkeeper came there to do, so it offers it —
 * and `preview` lets a screen show, greyed out, what will eventually fill it.
 */
export const EmptyState: React.FC<{
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  preview?: React.ReactNode;
}> = ({ title, hint, icon, action, secondaryAction, preview }) => (
  <div className="text-center py-10 px-6 text-light-text-secondary dark:text-dark-text-secondary animate-fade-in">
    {icon && <div className="flex justify-center mb-3 opacity-40">{icon}</div>}
    <p className="font-medium text-light-text dark:text-dark-text">{title}</p>
    {hint && <p className="text-sm mt-1">{hint}</p>}
    {(action || secondaryAction) && (
      <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center items-stretch sm:items-center">
        {action && (
          <Button onClick={action.onClick} className="py-2.5 text-sm">
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="ghost" onClick={secondaryAction.onClick} className="py-2.5 text-sm">
            {secondaryAction.label}
          </Button>
        )}
      </div>
    )}
    {preview && (
      <div className="mt-6 opacity-40 pointer-events-none select-none" aria-hidden>
        {preview}
      </div>
    )}
  </div>
);
