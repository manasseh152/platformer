import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  webServer: {
    // Keep the build step in the test server command so CI still catches
    // production-bundle regressions, then run Vite dev for browser tests.
    // Several render-pipeline specs intentionally dynamic-import /src modules
    // from page.evaluate; vite preview serves only dist and cannot resolve those
    // source-module requests.
    command: 'bun run build && bunx vite --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
