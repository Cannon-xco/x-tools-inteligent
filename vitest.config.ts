import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Unit tests only - exclude integration/api tests
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: [
      'node_modules',
      '.next',
      'src/__tests__/api/',
      'src/__tests__/setup/',
      'src/__tests__/helpers/',
      // Legacy manual-runner stubs (use custom assert, not vitest describe/it)
      'src/enrichment/__tests__/serp-adapter.test.ts',
      'src/enrichment/__tests__/directory-adapter.test.ts',
      'src/enrichment/__tests__/social-adapter.test.ts',
      'src/enrichment/__tests__/website-adapter.test.ts',
      'src/enrichment/__tests__/whois-adapter.test.ts',
      'src/enrichment/__tests__/deep-enrich-route.test.ts',
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
