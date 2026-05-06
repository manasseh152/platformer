import { expect, test } from '@playwright/test';

async function enableDeveloperMode(page) {
  await page.locator('#startSettingsButton').click();
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.locator('[data-setting-row="developer-mode"]').click();
  await expect(page.locator('#developerTools')).toBeVisible();
  await page.locator('#settingsCategoryBackButton').click();
  await page.locator('#settingsBackButton').click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('developer toolbox is gated by Developer Mode and gameplay state', async ({ page }) => {
  await expect(page.locator('#devtoolToggle')).toBeHidden();
  await page.keyboard.press('Backquote');
  await expect(page.locator('#devtoolPanel')).toBeHidden();

  await enableDeveloperMode(page);
  await expect(page.locator('#devtoolToggle')).toBeHidden();

  await page.locator('#startButton').click();
  await expect(page.locator('body')).toHaveClass(/\bplaying\b/);
  await expect(page.locator('#devtoolToggle')).toBeVisible();

  await page.keyboard.press('Backquote');
  await expect(page.locator('#devtoolPanel')).toBeVisible();
  await expect(page.locator('#devtoolPanel')).toContainText('Toolbox');
  await expect(page.locator('[data-devtool-section="session"]')).toContainText('Session');
  await expect(page.locator('[data-devtool-value="session.tilemap"]')).toContainText('Act 01 Level 1');
  await expect(page.locator('[data-devtool-value="session.player-position"]')).toContainText(/\d+, \d+/);

  const snapshot = await page.evaluate(() => window.__gym.snapshot().devTools);
  expect(snapshot.open).toBe(true);
  expect(snapshot.visible).toBe(true);
  expect(snapshot.sections.find(section => section.id === 'session').items.map(item => item.kind)).toContain('value');
  expect(snapshot.sections.find(section => section.id === 'render').items.map(item => item.id)).toEqual(expect.arrayContaining(['show-collision-cells', 'show-collision-rects', 'show-physics-body-rects', 'use-raw-terrain-debug-render']));
});

test('developer toolbox collision toggles update session-only debug flags', async ({ page }) => {
  await enableDeveloperMode(page);
  await page.locator('#startButton').click();
  await page.keyboard.press('Backquote');

  await page.locator('[data-devtool-toggle="render.show-collision-cells"]').check();
  await page.locator('[data-devtool-toggle="render.show-collision-rects"]').check();
  await page.locator('[data-devtool-toggle="render.show-physics-body-rects"]').check();
  await page.locator('[data-devtool-toggle="render.use-raw-terrain-debug-render"]').check();
  await expect(page.locator('[data-devtool-toggle="render.show-collision-cells"]')).toBeChecked();
  await expect(page.locator('[data-devtool-toggle="render.show-collision-rects"]')).toBeChecked();
  await expect(page.locator('[data-devtool-toggle="render.show-physics-body-rects"]')).toBeChecked();
  await expect(page.locator('[data-devtool-toggle="render.use-raw-terrain-debug-render"]')).toBeChecked();

  await page.keyboard.press('Backquote');
  await page.keyboard.press('Backquote');
  await expect(page.locator('[data-devtool-toggle="render.show-collision-cells"]')).toBeChecked();
  await expect(page.locator('[data-devtool-toggle="render.show-collision-rects"]')).toBeChecked();
  await expect(page.locator('[data-devtool-toggle="render.show-physics-body-rects"]')).toBeChecked();
  await expect(page.locator('[data-devtool-toggle="render.use-raw-terrain-debug-render"]')).toBeChecked();
});

test('developer toolbox button and keyboard close behavior are accessible', async ({ page }) => {
  await enableDeveloperMode(page);
  await page.locator('#startButton').click();

  await page.locator('#devtoolToggle').click();
  await expect(page.locator('#devtoolPanel')).toBeVisible();
  await expect(page.locator('#devtoolToggle')).toHaveAttribute('aria-expanded', 'true');

  await page.locator('#devtoolPanel').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#devtoolPanel')).toBeHidden();
  await expect(page.locator('#devtoolToggle')).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('devtoolToggle');

  await page.locator('#devtoolToggle').click();
  await expect(page.locator('#devtoolPanel')).toBeVisible();
  await page.keyboard.press('Backquote');
  await expect(page.locator('#devtoolPanel')).toBeHidden();
});

test('developer toolbox closes and hides while paused or when Developer Mode is disabled', async ({ page }) => {
  await enableDeveloperMode(page);
  await page.locator('#startButton').click();
  await page.keyboard.press('Backquote');
  await expect(page.locator('#devtoolPanel')).toBeVisible();

  await page.keyboard.press('KeyP');
  await expect(page.locator('body')).toHaveClass(/\bpaused\b/);
  await expect(page.locator('#devtoolToggle')).toBeHidden();
  await expect(page.locator('#devtoolPanel')).toBeHidden();

  await page.locator('#settingsButton').click();
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.locator('[data-setting-row="developer-mode"]').click();
  await expect(page.locator('#developerTools')).toBeHidden();
  await page.locator('#settingsCategoryBackButton').click();
  await page.locator('#settingsBackButton').click();
  await page.locator('#resumeButton').click();
  await expect(page.locator('body')).not.toHaveClass(/\bpaused\b/);
  await expect(page.locator('#devtoolToggle')).toBeHidden();

  await page.keyboard.press('Backquote');
  await expect(page.locator('#devtoolPanel')).toBeHidden();
});
