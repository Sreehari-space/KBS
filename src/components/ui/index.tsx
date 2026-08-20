import React, { useEffect, useState } from 'react';
import { IconCheck, IconClose } from '@/components/icons';

/** Shared primitives. Deliberately small — this app has few widget types. */

export { Money, AnimatedMoney, splitAmount } from './Money';
export { Skeleton, SkeletonStat, SkeletonRows, SkeletonTiles } from './Skeleton';
export { Sparkline } from './Sparkline';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`surface ${className}`}>{children}</div>;

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Buttons are pills.
 *
 * The reference's signature control is a full-radius pill carrying a bright
 * mint fill and near-black ink, used once per screen for the one action that
 * matters. Everything else steps down to a neutral pill so the primary never
 * has to compete.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-hover shadow-pill',
  secondary: 'bg-brand-primary text-white hover:bg-brand-primary-hover',
  // Neutral, but still a filled shape: a ghost with no fill reads as disabled
  // on a white card, which is where most of them sit.
  ghost:
    'bg-light-surface shadow-card dark:bg-white/10 text-light-text dark:text-dark-text hover:bg-light-line dark:hover:bg-white/[0.15]',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; full?: boolean }
> = ({ variant = 'primary', full, className = '', children, ...rest }) => (
  <button
    {...rest}
    className={`px-5 py-3.5 rounded-full font-semibold transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 focus-ring ${
      VARIANTS[variant]
    } ${full ? 'w-full' : ''} ${className}`}
  >
    {children}
  </button>
);

/**
 * A pill chip: filters, segmented choices, and the translucent controls that
 * sit on the gradient hero.
 */
export const Chip: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; onHero?: boolean }
> = ({ selected, onHero, className = '', children, ...rest }) => (
  <button
    {...rest}
    aria-pressed={selected}
    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors focus-ring ${
      onHero
        ? 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm'
        : selected
          ? 'bg-brand-primary text-white'
          : 'bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text hover:bg-light-line dark:hover:bg-white/10'
    } ${className}`}
  >
    {children}
  </button>
);

/** An icon in a tinted rounded square, as the reference sets list-row icons. */
export const IconTile: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <span
    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary dark:bg-brand-on-dark/15 dark:text-brand-on-dark ${className}`}
  >
    {children}
  </span>
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

/**
 * Full width by default, unless the caller asked for a width of their own.
 *
 * Tailwind emits width utilities in size order, so `.w-full` lands *after*
 * `.w-24` in the stylesheet. Both are single-class selectors, so the later one
 * wins and a width passed through `className` loses silently — no warning, no
 * error, just the wrong layout. That is what collapsed the item-name box on
 * the onboarding screen to 26px wide: its neighbour asked for `w-24`, was given
 * 100% instead, and ate the whole row.
 *
 * Only a bare `w-*` counts. `min-w-0` and `max-w-sm` set different properties
 * and coexist with the default; a responsive `sm:w-24` is not handled and would
 * need a wrapper element instead.
 */
const fieldWidth = (className: string) => (/(?:^|\s)w-/.test(className) ? '' : 'w-full');

// `ref` is an ordinary prop in React 19, so it travels in `rest` — no
// forwardRef wrapper needed. The billing screen needs it to focus the search
// box on "/".
export const Input: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }
> = ({ className = '', ...rest }) => (
  <input
    {...rest}
    className={`${fieldWidth(className)} px-4 py-3 rounded-xl bg-light-surface dark:bg-white/[0.06] border border-transparent shadow-card focus:outline-none focus:border-brand-primary dark:focus:border-brand-on-dark ${className}`}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <select
    {...rest}
    className={`${fieldWidth(className)} px-4 py-3 rounded-xl bg-light-surface dark:bg-white/[0.06] border border-transparent shadow-card focus:outline-none focus:border-brand-primary dark:focus:border-brand-on-dark ${className}`}
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
        checked ? 'bg-brand-primary' : 'bg-light-line dark:bg-white/20'
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
        : 'border-light-line dark:border-dark-line'
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
      {/* A big top radius and a grab handle: the reference's sheets read as a
          sheet of paper pulled up over the page, not as a dialog. */}
      <div
        className={`relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-light-bg dark:bg-dark-bg rounded-t-3xl sm:rounded-3xl shadow-2xl ${
          leaving
            ? 'animate-sheet-out sm:animate-dialog-out'
            : 'animate-sheet-in sm:animate-dialog-in'
        }`}
      >
        <div className="sm:hidden pt-2.5 flex justify-center" aria-hidden>
          <span className="w-9 h-1 rounded-full bg-light-line dark:bg-dark-line" />
        </div>
        {title && (
          // Title centred with the dismiss on the right, as the reference
          // groups its sheet headers.
          <div className="sticky top-0 z-10 bg-light-bg dark:bg-dark-bg px-5 pt-3 pb-4 flex items-center gap-3">
            <h2 className="flex-1 text-center text-lg font-bold display truncate">{title}</h2>
            <button
              onClick={onClose}
              className="absolute right-4 p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-line dark:hover:bg-white/10 focus-ring"
              aria-label="Close"
            >
              <IconClose className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="px-4 pb-safe">{children}</div>
      </div>
    </div>
  );
};

export const Banner: React.FC<{
  tone: 'warning' | 'danger' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
}> = ({ tone, children, onDismiss }) => {
  // Tinted fills rather than bordered boxes, matching the card language.
  const tones = {
    warning: 'bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-100',
    danger: 'bg-red-50 dark:bg-red-500/15 text-red-900 dark:text-red-100',
    info: 'bg-brand-primary/10 dark:bg-brand-on-dark/15 text-brand-primary-hover dark:text-brand-on-dark',
  };
  return (
    <div
      className={`rounded-2xl px-4 py-3 text-sm flex items-start gap-3 animate-fade-in ${tones[tone]}`}
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
