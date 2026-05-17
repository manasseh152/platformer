import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { getScreenshotCaptureAssets } from '../../tools/launch-assets.manifest.js';

export const activeScreenshotSubjects = getScreenshotCaptureAssets()
  .map(asset => asset.subject)
  .filter((subject, index, subjects) => subjects.indexOf(subject) === index);

export function screenshotAssetsForProject(projectName) {
  return getScreenshotCaptureAssets({
    subjects: activeScreenshotSubjects,
    viewports: [projectName]
  });
}

export async function captureLaunchAssetScreenshot(page, asset) {
  await page.goto(asset.route);
  await page.locator(asset.waitFor).waitFor({ state: 'attached' });
  await page.locator(asset.waitFor).waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts?.ready);
  await mkdir(dirname(asset.path), { recursive: true });
  await page.screenshot({ path: asset.path, animations: 'disabled', caret: 'hide' });
}
