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
        'light-bg': '#f1f5f9',
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
    },
  },
  plugins: [],
};
