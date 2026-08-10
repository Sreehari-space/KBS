/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deliberately restrained. A till is a tool, not a consumer app:
        // ONE confident action colour (the BILL button, the active tab) and a
        // deeper green reserved for confirmation. The old indigo/emerald pair
        // read as a startup landing page.
        'brand-primary': '#1d4ed8',
        'brand-primary-hover': '#1e40af',
        // The primary is too dark to read as TEXT on the dark surface
        // (#1d4ed8 on #151f32 is ~2.5:1). This is the same role, lightened
        // for dark mode only.
        'brand-on-dark': '#93c5fd',
        'brand-secondary': '#047857',
        'brand-secondary-hover': '#065f46',
        'light-bg': '#e9eef5',
        'dark-bg': '#0b1220',
        'light-surface': '#ffffff',
        'dark-surface': '#151f32',
        'light-text': '#0f172a',
        'dark-text': '#f1f5f9',
        'light-text-secondary': '#5b6b82',
        'dark-text-secondary': '#94a3b8',
      },
      fontFamily: {
        // Noto Sans Tamil is self-hosted (public/fonts). The system fallbacks
        // all ship a Tamil face, so text stays readable even before the
        // webfont loads.
        sans: ['"Noto Sans Tamil"', 'system-ui', '"Nirmala UI"', 'Latha', 'sans-serif'],
        mono: ['"Noto Sans Tamil"', 'ui-monospace', 'monospace'],
      },
      spacing: {
        // Safe areas for phones with a notch / gesture bar. The billing screen
        // has a sticky bottom bar that must clear the gesture area.
        'safe-b': 'env(safe-area-inset-bottom)',
      },
      // ── Motion language ────────────────────────────────────────────────
      // One vocabulary, four verbs: sheets RISE, rows SETTLE, panels FADE,
      // skeletons BREATHE. Nothing runs longer than 260ms — slow animation on
      // a ₹8,000 Android feels worse than none at all. Every one of these is
      // disabled wholesale by the prefers-reduced-motion block in index.css.
      keyframes: {
        'sheet-in': {
          from: { transform: 'translateY(12%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'sheet-out': {
          from: { transform: 'translateY(0)', opacity: '1' },
          to: { transform: 'translateY(12%)', opacity: '0' },
        },
        'dialog-in': {
          from: { transform: 'scale(0.97)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'dialog-out': {
          from: { transform: 'scale(1)', opacity: '1' },
          to: { transform: 'scale(0.97)', opacity: '0' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        // A newly scanned line slides in from the right and settles, so the
        // eye tracks WHAT was just added. Doubles as scan feedback.
        'row-in': {
          from: { transform: 'translateX(10px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'pop': {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
        'breathe': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
      },
      animation: {
        'sheet-in': 'sheet-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'sheet-out': 'sheet-out 140ms cubic-bezier(0.4, 0, 1, 1)',
        'dialog-in': 'dialog-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'dialog-out': 'dialog-out 130ms cubic-bezier(0.4, 0, 1, 1)',
        'fade-in': 'fade-in 160ms ease-out',
        'fade-out': 'fade-out 130ms ease-in',
        'row-in': 'row-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'pop': 'pop 220ms ease-out',
        'breathe': 'breathe 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
