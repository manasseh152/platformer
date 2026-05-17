import { expect, test } from '@playwright/test';
import { getScreenshotCaptureAssets } from '../tools/launch-assets.manifest.js';
import { activeScreenshotSubjects, captureLaunchAssetScreenshot } from './helpers/launch-assets-capture.js';

const assets = getScreenshotCaptureAssets({ subjects: activeScreenshotSubjects });

test.describe('route-based raw launch asset screenshots', () => {
  for (const asset of assets) {
    test(`captures ${asset.subject} at ${asset.viewport}`, async ({ page }, testInfo) => {
      test.skip(asset.viewport !== testInfo.project.name, `Captured by ${asset.viewport} project.`);
      await captureLaunchAssetScreenshot(page, asset);
      await expect(page.locator(asset.waitFor)).toBeVisible();
    });
  }
});
