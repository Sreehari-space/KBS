/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Teal → mint, after the Starling reference ───────────────────────
        // The design language is borrowed; the brand is not. No wordmark, no
        // logo, and the hues are shifted off Starling's exact pair so this
        // reads as KBS rather than as a bank's livery.
        //
        // Every value below is contrast-checked. The two that matter most:
        // `brand-primary` on white is 5.5:1 (a lighter teal measured 3.7:1 and
        // failed for small text), and `accent-ink` on `accent` is 10.4:1.
        'brand-primary': '#0f766e',
        'brand-primary-hover': '#115e56',
        // The primary is too dark to read as TEXT on a dark surface, so this
        // is the same role lightened for dark mode only.
        'brand-on-dark': '#5eead4',

        // The signature move of the reference: a bright mint fill carrying
        // near-black ink. Reserved for the ONE primary action on a screen.
        accent: '#2ee8c8',
        'accent-hover': '#25d3b5',
        'accent-ink': '#06251f',

        // The hero gradient behind the headline number. It starts at
        // `brand-primary` rather than anything brighter so that even small
        // white text on the lightest band clears 4.5:1.
        'hero-from': '#0f766e',
        'hero-to': '#062e29',

        'brand-secondary': '#047857',
        'brand-secondary-hover': '#065f46',

        // Warm near-white page with pure-white cards floating on it — the
        // separation is the background gap, not a border.
        'light-bg': '#f4f5f4',
        'dark-bg': '#0a1211',
        'light-surface': '#ffffff',
        'dark-surface': '#17211f',
        'light-line': '#e6e9e8',
        'dark-line': '#26332f',
        'light-text': '#16211f',
        'dark-text': '#f2f5f4',
        'light-text-secondary': '#5f6e6b',
        'dark-text-secondary': '#9aa8a5',
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
      backgroundImage: {
        // Behind the one number that matters on a screen.
        hero: 'linear-gradient(180deg, #0f766e 0%, #0b544c 45%, #062e29 100%)',
      },
      boxShadow: {
        // Cards are separated by the background gap, not by a border or a
        // heavy drop shadow. This is barely there on purpose.
        card: '0 1px 2px rgb(16 32 29 / 0.04), 0 6px 16px -8px rgb(16 32 29 / 0.10)',
        pill: '0 1px 2px rgb(6 37 31 / 0.10)',
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
        pop: {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
        breathe: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
      },
      animation: {
        'sheet-in': 'sheet-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'sheet-out': 'sheet-out 140ms cubic-bezier(0.4, 0, 1, 1)',
        'dialog-in': 'dialog-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'dialog-out': 'dialog-out 130ms cubic-bezier(0.4, 0, 1, 1)',
        'fade-in': 'fade-in 160ms ease-out',
        'fade-out': 'fade-out 130ms ease-in',
        'row-in': 'row-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        pop: 'pop 220ms ease-out',
        breathe: 'breathe 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
