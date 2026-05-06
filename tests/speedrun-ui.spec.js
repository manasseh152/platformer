import { expect, test } from '@playwright/test';

async function openStartSettings(page) {
  await page.locator('#startSettingsButton').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'settings');
}

async function openCategory(page, id, title) {
  await page.locator(`[data-settings-category="${id}"]`).click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'settings-category');
  await expect(page.locator('#menuTitle')).toHaveText(title);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('player can enable Speed Run Mode and see the timer HUD during play', async ({ page }) => {
  await expect(page.locator('#speedRunHud')).toBeHidden();

  await openStartSettings(page);
  await openCategory(page, 'gameplay', 'Gameplay');
  await expect(page.locator('[data-setting-row="speed-run-mode"]')).toContainText('Off');
  await page.locator('[data-setting-row="speed-run-mode"]').click();
  await expect(page.locator('[data-setting-row="speed-run-mode"]')).toContainText('On');
  await expect(page.locator('[data-settings-action="clear-speedrun-records"]')).toBeVisible();

  await page.locator('[data-settings-back="category"]').click();
  await page.locator('[data-settings-back="root"]').click();
  await page.locator('#startButton').click();

  await expect(page.locator('body')).toHaveClass(/\bplaying\b/);
  await expect(page.locator('#speedRunHud')).toBeVisible();
  await expect(page.locator('#speedRunTimer')).toContainText(/0:0\d\.\d{3}/);
  await expect(page.locator('#speedRunBest')).toHaveText('Best --:--.---');

  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('chibi.settings')));
  expect(settings.speedRunMode).toBe(true);
});
