import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('start settings, motion persistence, controls, advanced, and JSON settings', async ({ page }) => {
  const body = page.locator('body');
  const pauseScreen = page.locator('#pauseScreen');

  await expect(page.locator('#startScreen')).toBeVisible();
  await expect(page.locator('#startSettingsButton')).toHaveText('Settings');
  await expect(page.locator('#startSettingsButton')).toBeVisible();

  await page.locator('#startSettingsButton').click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'settings');
  await expect(page.locator('#menuTitle')).toHaveText('Settings');
  await expect(page.locator('#motionStatus')).toContainText('System is currently');

  await page.getByRole('button', { name: 'Off' }).click();
  await expect(body).toHaveClass(/\bmotion-reduce\b/);
  await page.reload();
  await expect(body).toHaveClass(/\bmotion-reduce\b/);
  await page.locator('#startSettingsButton').click();
  await expect(page.getByRole('button', { name: 'Off' })).toHaveClass(/\bactive\b/);

  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'controls');
  await expect(page.locator('#bindList .bind-row')).toHaveCount(7);
  await expect(page.locator('#bindList')).toContainText('Move Left');
  await expect(page.getByRole('button', { name: 'Keyboard', exact: true })).toHaveClass(/\bactive\b/);
  await page.getByRole('button', { name: 'Controller', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Controller', exact: true })).toHaveClass(/\bactive\b/);
  await expect(page.locator('#bindList')).toContainText('A / Cross');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'settings');

  await page.getByRole('button', { name: 'Advanced' }).click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'advanced');
  await expect(page.locator('#developerMode')).toBeVisible();
  await expect(page.locator('#developerTools')).toBeHidden();
  await page.locator('#developerMode').check();
  await expect(page.locator('#developerTools')).toBeVisible();
  await page.reload();
  await page.locator('#startSettingsButton').click();
  await page.getByRole('button', { name: 'Advanced' }).click();
  await expect(page.locator('#developerMode')).toBeChecked();

  await page.getByRole('button', { name: 'Dump app settings' }).click();
  const dumped = await page.locator('#settingsJson').inputValue();
  expect(dumped).toContain('schemaVersion');
  expect(dumped).toContain('motion');
  expect(dumped).toContain('developerMode');
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

  await page.locator('#developerMode').check();
  await expect(page.locator('#developerTools')).toBeVisible();
  await page.locator('#settingsJson').fill('{ invalid');
  await page.getByRole('button', { name: 'Replace app settings' }).click();
  await expect(page.locator('#settingsJsonStatus')).toContainText('Replace failed');
});

test('pause flow and controls defaults', async ({ page }) => {
  const body = page.locator('body');
  const pauseScreen = page.locator('#pauseScreen');
  const startScreen = page.locator('#startScreen');
  const canvas = page.locator('#game');

  await page.locator('#startButton').click();
  await expect(body).toHaveClass(/\bplaying\b/);
  await expect(startScreen).toBeHidden();
  await expect(startScreen).toHaveCSS('visibility', 'hidden');
  await expect(startScreen).toHaveCSS('transition-duration', '0s');
  await expect(canvas).toHaveCSS('opacity', '1');

  await page.keyboard.press('Escape');
  await expect(body).toHaveClass(/\bpaused\b/);
  await expect(pauseScreen).toHaveCSS('opacity', '1');

  await page.keyboard.press('Escape');
  await expect(body).not.toHaveClass(/\bpaused\b/);
  await expect(pauseScreen).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(body).toHaveClass(/\bpaused\b/);

  await pauseScreen.getByRole('button', { name: 'Settings' }).click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'settings');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'main');
  await expect(pauseScreen.getByRole('button', { name: 'Continue' })).toBeVisible();

  await pauseScreen.getByRole('button', { name: 'Settings' }).click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'settings');
  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'controls');
  await page.getByRole('button', { name: 'Defaults' }).click();
  await expect(page.locator('#bindStatus')).toContainText('Restored keyboard defaults');
  await expect(page.locator('#bindList .bind-row').filter({ hasText: 'Move Left' })).toContainText('A / ←');

  await page.getByRole('button', { name: 'Controller', exact: true }).click();
  await page.getByRole('button', { name: 'Defaults' }).click();
  await expect(page.locator('#bindStatus')).toContainText('Restored controller defaults');

  await page.locator('#controlsBackButton').click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'settings');
  await page.locator('#settingsBackButton').click();
  await pauseScreen.getByRole('button', { name: 'Continue' }).click();
  await expect(body).not.toHaveClass(/\bpaused\b/);
  await expect(pauseScreen).toBeHidden();
  await expect(pauseScreen).toHaveCSS('visibility', 'hidden');
  await expect(pauseScreen).toHaveCSS('transition-duration', '0s');
});
