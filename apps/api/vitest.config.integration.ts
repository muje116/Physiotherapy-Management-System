import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/integration/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./src/__tests__/integration/setup.ts'],
    testTimeout: 30000,
  },
});
