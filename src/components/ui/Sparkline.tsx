import React, { useId } from 'react';

/**
 * A trend line small enough to live inside a stat card.
 *
 * Inline SVG, no library, no axes, no labels — the number above it is the
 * value; this only answers "which way is it going". A flat series still draws
 * a flat line rather than collapsing to nothing, because an empty box next to
 * a number reads as a bug.
 */
export const Sparkline: React.FC<{
  values: number[];
  className?: string;
  /** Drawn in currentColor; the caller sets the colour. */
  height?: number;
  width?: number;
}> = ({ values, className = '', height = 24, width = 72 }) => {
  const gradientId = useId();
  if (values.length === 0) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  // 1px inset top and bottom so the stroke is never clipped by the viewBox.
  const y = (v: number) => height - 1 - ((v - min) / span) * (height - 2);
  const points = values.map((v, i) => `${(i * stepX).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M ${points.join(' L ')}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
