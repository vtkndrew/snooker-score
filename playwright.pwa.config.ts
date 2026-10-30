import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './pwa-tests',
  testMatch: process.env.PWA_BASELINE_DIR ? '**/legacy-update.spec.ts' : '**/app.spec.ts',
  outputDir: './test-results-pwa',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    trace: 'retain-on-failure',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
  projects: [
    { name: 'pwa-chromium', use: { channel: process.env.CI ? undefined : 'chrome' } },
    { name: 'pwa-webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'node scripts/pwa-test-server.mjs',
    url: 'http://127.0.0.1:4175/health',
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
