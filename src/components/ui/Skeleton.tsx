import React from 'react';

/**
 * Loading placeholders.
 *
 * Screens used to render `null` (Day close) or pop in fully formed (Reports)
 * while IndexedDB answered. Both flash. A skeleton shows the SHAPE of what is
 * coming, so the layout never jumps and the wait reads as "loading" rather
 * than "empty".
 *
 * These are shapes only — no text, no aria labels of their own. The region
 * they sit in carries `aria-busy`, which is what a screen reader needs.
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-breathe rounded-lg bg-light-line dark:bg-white/10 ${className}`} />
);

/** A card the size of a Reports stat tile. */
export const SkeletonStat: React.FC = () => (
  <div className="surface p-4">
    <Skeleton className="h-3 w-16" />
    <Skeleton className="h-6 w-24 mt-2" />
  </div>
);

/** A stack of list rows — bills, customers, ledger entries. */
export const SkeletonRows: React.FC<{ rows?: number; className?: string }> = ({
  rows = 5,
  className = '',
}) => (
  <div className={`space-y-2 ${className}`} aria-hidden>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex items-center gap-3 p-4 surface">
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-5 w-16 flex-shrink-0" />
      </div>
    ))}
  </div>
);

/** The billing product grid, at the same 2/3/4-column rhythm. */
export const SkeletonTiles: React.FC<{ tiles?: number }> = ({ tiles = 6 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" aria-hidden>
    {Array.from({ length: tiles }, (_, i) => (
      <div key={i} className="p-3 surface">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5 mt-1.5" />
        <Skeleton className="h-5 w-16 mt-4" />
      </div>
    ))}
  </div>
);
