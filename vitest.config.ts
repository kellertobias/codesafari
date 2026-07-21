import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      'tests/**/*.test.ts',
      // Viewer logic that is plain TypeScript (no DOM) is unit-tested here too.
      'viewer/src/**/*.test.ts',
    ],
    environment: 'node',
  },
});
