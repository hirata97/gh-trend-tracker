import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@gh-trend-tracker/shared': new URL('../../shared/src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
