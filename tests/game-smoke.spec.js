import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function openStartSettings(page) {
  await page.locator('#startSettingsButton').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'settings');
}

async function openCategory(page, id, title) {
  await page.locator(`[data-settings-category="${id}"]`).click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'settings-category');
  await expect(page.locator('#settingsHubPage')).toBeHidden();
  await expect(page.locator('#settingsCategoryPage')).toBeVisible();
  await expect(page.locator('#menuTitle')).toHaveText(title);
}

test('settings hub, accessibility motion, advanced JSON, and start flow', async ({ page }) => {
  const body = page.locator('body');
  const pauseScreen = page.locator('#pauseScreen');

  await expect(page.locator('#startScreen')).toBeVisible();
  await expect(page.locator('#startSettingsButton')).toHaveText('Settings');

  await openStartSettings(page);
  await expect(page.locator('#menuTitle')).toHaveText('Settings');
  await expect(page.locator('.settings-category-card__title')).toHaveText(['Keyboard', 'Controller', 'Accessibility', 'Advanced']);

  await openCategory(page, 'accessibility', 'Accessibility');
  await expect(page.locator('[data-setting-row="motion"]')).toContainText('System');
  await page.locator('[data-setting-row="motion"]').click();
  await expect(page.locator('[data-setting-row="motion"]')).toContainText('On');
  await page.locator('[data-setting-row="motion"]').click();
  await expect(page.locator('[data-setting-row="motion"]')).toContainText('Off');
  await expect(body).toHaveClass(/\bmotion-reduce\b/);
  await page.reload();
  await expect(body).toHaveClass(/\bmotion-reduce\b/);

  await openStartSettings(page);
  await openCategory(page, 'advanced', 'Advanced');
  await expect(page.locator('[data-setting-row="developer-mode"]')).toContainText('Off');
  await expect(page.locator('#developerTools')).toBeHidden();
  await page.locator('[data-setting-row="developer-mode"]').click();
  await expect(page.locator('[data-setting-row="developer-mode"]')).toContainText('On');
  await expect(page.locator('#developerTools')).toBeVisible();

  await page.getByRole('button', { name: 'Dump app settings' }).click();
  const dumped = await page.locator('#settingsJson').inputValue();
  expect(dumped).toContain('schemaVersion');
  expect(dumped).toContain('keyboardBinds');
  expect(dumped).toContain('gamepadBinds');

  const next = JSON.parse(dumped);
  next.motion = 'on';
  next.developerMode = false;
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#settingsJson').fill(JSON.stringify(next));
  await page.getByRole('button', { name: 'Replace app settings' }).click();
  await expect(page.locator('#settingsJsonStatus')).toContainText('Replaced app settings');
  await expect(body).not.toHaveClass(/\bmotion-reduce\b/);
  await expect(page.locator('#developerTools')).toBeHidden();

  await page.locator('[data-setting-row="developer-mode"]').click();
  await page.locator('#settingsJson').fill('{ invalid');
  await page.getByRole('button', { name: 'Replace app settings' }).click();
  await expect(page.locator('#settingsJsonStatus')).toContainText('Replace failed');

  await page.locator('[data-settings-back="category"]').click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'settings');
  await page.locator('[data-settings-back="root"]').click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'main');
});

test('keyboard and controller settings rows, binds, diagnostics, and pause flow', async ({ page }) => {
  const body = page.locator('body');
  const pauseScreen = page.locator('#pauseScreen');
  const startScreen = page.locator('#startScreen');
  const canvas = page.locator('#game');

  await openStartSettings(page);
  await openCategory(page, 'keyboard', 'Keyboard');
  await expect(page.locator('.settings-section h3')).toContainText(['Movement', 'Actions', 'System']);
  await expect(page.locator('.settings-section .settings-section')).toHaveCount(0);
  await expect(page.locator('[data-bind-device="keyboard"]')).toHaveCount(7);

  await page.locator('[data-bind-device="keyboard"][data-bind-action="jump"]').click();
  await expect(page.locator('[data-bind-action="jump"]')).toContainText('Press a key');
  await page.keyboard.press('KeyZ');
  await expect(page.locator('#settingsStatus')).toContainText('Jump updated');
  await expect(page.locator('[data-bind-action="jump"]')).toContainText('Z');

  await page.locator('[data-bind-device="keyboard"][data-bind-action="attack"]').click();
  await page.keyboard.press('KeyZ');
  await expect(page.locator('#settingsStatus')).toContainText('already bound to Jump');
  await expect(page.locator('[data-bind-action="attack"]')).toHaveClass(/is-error/);

  await page.getByRole('button', { name: 'Reset Keyboard Defaults' }).click();
  await expect(page.locator('#settingsStatus')).toContainText('Restored keyboard defaults');
  await expect(page.locator('[data-bind-action="left"]')).toContainText('A');
  await expect(page.locator('[data-bind-action="left"]')).toContainText('←');

  await page.locator('[data-settings-back="category"]').click();
  await openCategory(page, 'controller', 'Controller');
  await expect(page.locator('[data-setting-row="controller-enabled"]')).toContainText('On');
  await expect(page.locator('#controllerName')).toContainText('None detected');
  await expect(page.locator('#controllerInputs')).toContainText('None');
  await page.locator('[data-setting-row="controller-enabled"]').click();
  await expect(page.locator('[data-setting-row="controller-enabled"]')).toContainText('Off');
  await page.getByRole('button', { name: 'Reset Controller Defaults' }).click();
  await expect(page.locator('#settingsStatus')).toContainText('Restored controller defaults');

  await page.locator('[data-settings-back="category"]').click();
  await page.locator('[data-settings-back="root"]').click();

  await page.locator('#startButton').click();
  await expect(body).toHaveClass(/\bplaying\b/);
  await expect(startScreen).toBeHidden();
  await expect(canvas).toHaveCSS('opacity', '1');

  await page.keyboard.press('Escape');
  await expect(body).toHaveClass(/\bpaused\b/);
  await page.locator('#settingsButton').click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'settings');
  await page.locator('[data-settings-back="root"]').click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'main');
  await pauseScreen.getByRole('button', { name: 'Continue' }).click();
  await expect(body).not.toHaveClass(/\bpaused\b/);
  await expect(pauseScreen).toBeHidden();
});
