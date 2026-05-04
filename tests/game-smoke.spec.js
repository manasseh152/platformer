import { expect, test } from '@playwright/test';

test('can start, pause, inspect controls, and resume', async ({ page }) => {
  await page.goto('/');

  const startScreen = page.locator('#startScreen');
  const pauseScreen = page.locator('#pauseScreen');
  const canvas = page.locator('#game');

  await expect(startScreen).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chibi Knight', level: 1 })).toBeVisible();

  await startScreen.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('body')).toHaveClass(/\bplaying\b/);
  await expect(canvas).toHaveCSS('opacity', '1');

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveClass(/\bpaused\b/);
  await expect(pauseScreen).toHaveCSS('opacity', '1');

  await pauseScreen.getByRole('button', { name: 'Controls' }).click();
  await expect(pauseScreen).toHaveClass(/\bsettings-open\b/);
  await expect(page.locator('#settingsPanel')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('#bindList .bind-row')).toHaveCount(7);
  await expect(page.locator('#bindList')).toContainText('Move Left');
  await expect(page.getByRole('button', { name: 'Keyboard', exact: true })).toHaveClass(/\bactive\b/);
  await expect(page.locator('#bindList')).toContainText('Keyboard');
  await expect(page.getByRole('button', { name: 'Add keyboard' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Controller', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Controller', exact: true })).toHaveClass(/\bactive\b/);
  await expect(page.locator('#bindList')).toContainText('A / Cross');
  await expect(page.getByRole('button', { name: 'Replace controller' }).first()).toBeVisible();
  await expect(page.locator('.controller-debug')).not.toBeVisible();

  await page.getByRole('button', { name: 'Keyboard', exact: true }).click();
  const moveLeftRow = page.locator('#bindList .bind-row').filter({ hasText: 'Move Left' });
  await moveLeftRow.getByRole('button', { name: 'Add keyboard' }).click();
  await expect(moveLeftRow).toContainText('Press key to add…');
  await expect(moveLeftRow.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await page.keyboard.press('KeyZ');
  await expect(moveLeftRow).toContainText('Z');

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(pauseScreen).not.toHaveClass(/\bsettings-open\b/);
  await expect(pauseScreen.getByRole('button', { name: 'Continue' })).toBeVisible();

  await pauseScreen.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('body')).not.toHaveClass(/\bpaused\b/);
  await expect(canvas).toHaveCSS('opacity', '1');
});
