import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/**/*.d.ts',
        'src/main.tsx',
      ],
      thresholds: {
        'src/lib/**': {
          statements: 30,
          branches: 50,
          functions: 40,
          lines: 30,
        },
        'src/pages/**': {
          statements: 77,
          branches: 60,
          functions: 22,
          lines: 77,
        },
        'src/pages/MapPage.tsx': {
          lines: 73,
        },
      },
    },
  },
});
