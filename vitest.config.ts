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
  },
});
