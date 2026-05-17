import { defineConfig, devices } from '@playwright/test';
import { launchAssetsManifest } from './tools/launch-assets.manifest.js';

const viewports = launchAssetsManifest.groups.screenshots.matrix.viewports;

export default defineConfig({
  testDir: './tests',
  testMatch: /launch-assets-capture\.spec\.js/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    deviceScaleFactor: 1
  },
  webServer: {
    command: 'bun run build && bunx vite preview --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_ENABLE_CAPTURE_MODE: 'true'
    }
  },
  projects: viewports.map(viewport => ({
    name: viewport.id,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.id.startsWith('mobile-'),
      hasTouch: viewport.id.startsWith('mobile-')
    }
  }))
});
