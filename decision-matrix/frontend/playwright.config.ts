import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: true,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 5174',
        url: 'http://127.0.0.1:5174',
        reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === 'true',
        env: { VITE_E2E_MAP_HOOK: 'true' },
      },
});
