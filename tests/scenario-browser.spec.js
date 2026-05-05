import { expect, test } from '@playwright/test';

test('developer mode presents Level Select as Scenario Browser grouped by source', async ({ page }) => {
  await page.goto('/');
  await page.locator('#startSettingsButton').click();
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.locator('[data-setting-row="developer-mode"]').click();
  await page.locator('#settingsCategoryBackButton').click();
  await page.locator('#settingsBackButton').click();
  await page.locator('#startLevelSelectButton').click();

  await expect(page.locator('#menuTitle')).toHaveText('Scenario Browser');
  await expect(page.locator('#levelSelectList [data-scenario-source="campaigns"] h3')).toHaveText('Campaigns');
  await expect(page.locator('#levelSelectList [data-scenario-source="gyms"] h3')).toHaveText('Gyms');
  await expect(page.locator('#levelSelectList [data-scenario-source="zoos"] h3')).toHaveText('Zoos');
  await expect(page.locator('button[data-scenario-id="ui-navigation-gym"]')).toContainText('CI');
});

test('public mode keeps Level Select copy and hides developer scenarios', async ({ page }) => {
  await page.goto('/');
  await page.locator('#startLevelSelectButton').click();

  await expect(page.locator('#menuTitle')).toHaveText('Level Select');
  await expect(page.locator('button[data-scenario-id="act-01-level-1"]')).toBeVisible();
  await expect(page.locator('button[data-scenario-id="movement-gym"]')).toBeVisible();
});
