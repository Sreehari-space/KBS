import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    // Node by default — the domain and data layers are the bulk of the suite
    // and do not want a DOM. Component tests opt in per file with
    //   // @vitest-environment jsdom
    // which keeps the fast path fast.
    environment: 'node',
    // `.tsx` was missing, so component tests could not be written even if
    // someone tried. That is how a UI change made every credit sale
    // unreachable with a green suite.
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
