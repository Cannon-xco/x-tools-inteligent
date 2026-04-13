import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Unit tests only - exclude integration/api tests
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'src/__tests__/api/', 'src/__tests__/setup/', 'src/__tests__/helpers/'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
