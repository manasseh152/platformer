import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { getGymById } from '../../src/content/gyms/registry.js';

async function writeSnapshot(testInfo, name, snapshot) {
  await writeFile(testInfo.outputPath(`${name}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
}

async function captureCheckpoint(page, testInfo, name) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  const snapshot = await page.evaluate(() => window.__gym.snapshot());
  await writeSnapshot(testInfo, name, snapshot);
  return snapshot;
}

const gym = getGymById('ui-navigation-gym');

test(`${gym.name}: developer mode exposes clean scenarios and loads Movement Gym`, async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.locator('#startScreen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__gym))).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('00-start-screen.png'), fullPage: true });

  await page.locator('#startSettingsButton').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'settings');
  await page.locator('[data-settings-category="advanced"]').click();
  await expect(page.locator('#menuTitle')).toHaveText('Advanced');
  await expect(page.locator('[data-setting-row="developer-mode"]')).toContainText('Off');

  await page.locator('[data-setting-row="developer-mode"]').click();
  await expect(page.locator('[data-setting-row="developer-mode"]')).toContainText('On');
  await expect.poll(() => page.evaluate(() => Boolean(window.__gym))).toBe(true);

  const developerSnapshot = await captureCheckpoint(page, testInfo, '01-developer-mode-enabled');
  expect(developerSnapshot).toMatchObject({
    scene: { id: 'gameplay', kind: 'gameplay', tilemapId: 'act-01-level-1' },
    tilemap: { id: 'act-01-level-1', name: 'Act 01 Level 1', visibility: 'public' },
    ui: { started: false, paused: false, menuPage: 'settings-category', menuOrigin: 'start' },
    settings: { developerMode: true }
  });
  expect(developerSnapshot.ui.focused?.dataset?.settingRow).toBe('developer-mode');

  await page.locator('[data-settings-back="category"]').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'settings');
  await page.locator('[data-settings-back="root"]').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'main');

  await page.locator('#startLevelSelectButton').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'level-select');
  await expect(page.getByRole('button', { name: /Act 01 Level 1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Movement Gym/ })).toBeVisible();

  const levelSelectSnapshot = await captureCheckpoint(page, testInfo, '02-level-select-with-gyms');
  expect(levelSelectSnapshot).toMatchObject({
    tilemap: { id: 'act-01-level-1' },
    ui: { menuPage: 'level-select', menuOrigin: 'start' },
    settings: { developerMode: true }
  });

  await page.getByRole('button', { name: /Movement Gym/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-tilemap-id', 'movement-gym-map');
  await expect(page.locator('#selectedLevelSummary')).toContainText('Movement Gym');

  const movementGymSnapshot = await captureCheckpoint(page, testInfo, '03-movement-gym-selected');
  expect(movementGymSnapshot).toMatchObject({
    tilemap: { id: 'movement-gym-map', name: 'Movement Gym Map', visibility: 'developer' },
    ui: { started: false, paused: false, menuPage: 'main' },
    settings: { developerMode: true }
  });
  expect(movementGymSnapshot.ui.bodyTilemapId).toBe('movement-gym-map');
  expect(movementGymSnapshot.player.hp).toBeGreaterThan(0);

  const events = await page.evaluate(() => window.__gym.events());
  await writeFile(testInfo.outputPath('events.json'), `${JSON.stringify(events, null, 2)}\n`);
  expect(events.map(event => event.type)).toContain('scene.switch');
  expect(events.map(event => event.type)).toContain('settings.change');
  expect(events).toContainEqual(expect.objectContaining({
    type: 'tilemap.switch',
    detail: { from: 'act-01-level-1', to: 'movement-gym-map' }
  }));
});
