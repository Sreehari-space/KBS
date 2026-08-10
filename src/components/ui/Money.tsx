import React, { useEffect, useRef, useState } from 'react';
import { formatINR } from '@/domain/money';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { Paise } from '@/domain/types';

/**
 * Money, set the way finance UIs set money.
 *
 * `formatINR` already gives Indian lakh grouping; this splits the fractional
 * part off so it can be rendered smaller and lighter. In a column of amounts
 * the rupees line up and the paise stop competing for attention — the single
 * cheapest thing that makes a table of numbers look professional.
 *
 * The split is on the LAST '.' because en-IN uses ',' for grouping and '.'
 * for the decimal, so there is exactly one of them and it is always last.
 */
export function splitAmount(formatted: string): { whole: string; fraction: string } {
  const dot = formatted.lastIndexOf('.');
  if (dot === -1) return { whole: formatted, fraction: '' };
  return { whole: formatted.slice(0, dot), fraction: formatted.slice(dot) };
}

export const Money: React.FC<{
  paise: Paise;
  className?: string;
  /** Headline figures where paise are noise (day totals, report cards). */
  hidePaise?: boolean;
}> = ({ paise, className = '', hidePaise }) => {
  const { whole, fraction } = splitAmount(formatINR(paise));
  return (
    <span className={`money ${className}`}>
      {whole}
      {!hidePaise && fraction && <span className="paise">{fraction}</span>}
    </span>
  );
};

/**
 * The same thing, but the value counts up when it changes.
 *
 * Deliberately short (260ms) and eased out, so the running total on the
 * billing bar reads as "it moved" rather than as a slot machine. Falls back to
 * an instant swap when the OS asks for reduced motion, and always lands
 * exactly on the target — the last frame writes `to`, never an interpolation.
 */
export const AnimatedMoney: React.FC<{
  paise: Paise;
  className?: string;
  hidePaise?: boolean;
  durationMs?: number;
}> = ({ paise, className, hidePaise, durationMs = 260 }) => {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(paise);
  const fromRef = useRef(paise);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || fromRef.current === paise) {
      fromRef.current = paise;
      setShown(paise);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — fast off the mark, gentle landing.
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(p >= 1 ? paise : Math.round(from + (paise - from) * eased));
      if (p < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    fromRef.current = paise;
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [paise, reduced, durationMs]);

  return <Money paise={shown} className={className ?? ''} hidePaise={hidePaise ?? false} />;
};
