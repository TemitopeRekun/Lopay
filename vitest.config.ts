import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Test runner config kept separate from vite.config.ts so the app build is
// unaffected. jsdom + jest-dom give component tests a DOM; pure-logic tests
// (currency, errors, stores) run fine in it too.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve('./'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'android', 'ios'],
    // The form suites drive real keystrokes through userEvent, which is slow: the
    // sign-up tests each type five fields and land at 3-5s on their own. Against
    // the 5s default they passed alone and timed out whenever enough files ran in
    // parallel (or under coverage instrumentation) to contend for CPU — a flake
    // that says nothing about the code. The ceiling only bounds a genuine hang.
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      // Milestone-5 gate is scoped to the *logic layer* — the non-visual
      // TypeScript modules that carry behaviour worth locking down. The 57
      // presentational screen components are exercised by the Playwright
      // journey (M5 capstone), not brittle jsdom unit tests, so they are
      // deliberately out of the coverage denominator.
      include: [
        'services/**/*.{ts,tsx}',
        'store/**/*.ts',
        'utils/**/*.ts',
        'hooks/**/*.ts',
        'context/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.{test,spec}.{ts,tsx}',
        'services/apiTypes.ts', // pure re-export barrel of generated types
        'src/api.generated.ts', // generated, types-only
      ],
      reporter: ['text-summary', 'json-summary'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
