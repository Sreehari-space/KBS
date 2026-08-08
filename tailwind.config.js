/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ported verbatim from the old index.html CDN config.
        'brand-primary': '#4f46e5',
        'brand-secondary': '#10b981',
        'light-bg': '#f8fafc',
        'dark-bg': '#0f172a',
        'light-surface': '#ffffff',
        'dark-surface': '#1e293b',
        'light-text': '#0f172a',
        'dark-text': '#f8fafc',
        'light-text-secondary': '#64748b',
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
