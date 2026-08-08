import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // never auto-reload; a forced reload mid-bill loses the cart
      // No `includeAssets` — workbox.globPatterns below already covers fonts
      // and icons, and listing them twice precaches every file twice.
      manifest: {
        name: 'KBS — Store Billing',
        short_name: 'KBS',
        description: 'Offline billing and credit ledger for small stores',
        lang: 'ta',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f8fafc',
        theme_color: '#4f46e5',
        categories: ['business', 'productivity', 'finance'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the whole shell. After removing the CDN imports there are
        // no runtime network requests left to cache, so no runtime handlers.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  // NOTE: the previous `define` block inlined GEMINI_API_KEY into the client
  // bundle, where anyone could read it (doc 01, D8). AI features now read a
  // key the shop owner enters in Settings, stored on their own device.
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
