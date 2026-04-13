import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/__tests__/**/*.test.ts'
    ],
    exclude: ['src/enrichment/__tests__/**'],
    // Don't auto-run setup - use live dev server DB
    setupFiles: [],
    env: {
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
