import { expect, test } from '@playwright/test';

function localDraft({ id = 'local-play-map', name = 'Local Play Map', updatedAt = 2000, player = true } = {}) {
  return {
    id,
    name,
    cols: 4,
    rows: 3,
    artTileSize: 16,
    terrainRenderMode: 'contained-autotile',
    theme: 'kenney-pixel-platformer:grass',
    visibility: 'public',
    categories: ['local'],
    description: 'Saved in Playwright.',
    updatedAt,
    layers: [
      { id: 'terrain', type: 'terrain', cellSize: 16, rows: [[null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass']] },
      { id: 'entities', cellSize: 32, rows: [player ? 'P...' : '....', '....', '...G'] }
    ]
  };
}

test('developer mode presents Scenario Browser with tabs for acts local gyms and zoos', async ({ page }) => {
  await page.goto('/');
  await page.locator('#startSettingsButton').click();
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.locator('[data-setting-row="developer-mode"]').click();
  await page.locator('#settingsCategoryBackButton').click();
  await page.locator('#settingsBackButton').click();
  await page.locator('#startLevelSelectButton').click();

  await expect(page.locator('#menuTitle')).toHaveText('Scenario Browser');
  await expect(page.getByRole('tab', { name: 'Acts' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Local \(0\)/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Gyms' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Zoos' })).toBeVisible();
  await expect(page.locator('#levelSelectList [data-scenario-source="campaigns"] h3')).toHaveText('Act 01');

  await page.getByRole('tab', { name: 'Gyms' }).click();
  await expect(page.locator('#levelSelectList [data-scenario-source="gyms"] h3')).toHaveText('Gyms');
  await expect(page.locator('button[data-scenario-id="ui-navigation-gym"]')).toContainText('CI');

  await page.getByRole('tab', { name: 'Zoos' }).click();
  await expect(page.locator('#levelSelectList [data-scenario-source="zoos"] h3')).toHaveText('Zoos');
});

test('public mode keeps Level Select copy and hides developer tabs', async ({ page }) => {
  await page.goto('/');
  await page.locator('#startLevelSelectButton').click();

  await expect(page.locator('#menuTitle')).toHaveText('Level Select');
  await expect(page.getByRole('tab', { name: 'Acts' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Local \(0\)/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Gyms' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Zoos' })).toHaveCount(0);
  await expect(page.locator('button[data-scenario-id="act-01-level-1"]')).toBeVisible();
  await expect(page.locator('button[data-scenario-id="movement-gym"]')).toHaveCount(0);
});

test('local tab lists saved drafts and launches them as local scenarios', async ({ page }) => {
  await page.addInitScript(draft => localStorage.setItem('chibi.tilemap-editor.local-play-map', JSON.stringify(draft)), localDraft());
  await page.goto('/');
  await page.locator('#startLevelSelectButton').click();
  await page.getByRole('tab', { name: /Local \(1\)/ }).click();

  await expect(page.getByText('Local Play Map')).toBeVisible();
  await expect(page.getByText(/local-play-map/)).toBeVisible();
  await page.locator('button[data-scenario-id="local:local-play-map"]').click();
  await expect(page.locator('#selectedLevelSummary')).toContainText('Local Play Map');
  await page.locator('#startButton').click();
  await expect(page.locator('body')).toHaveAttribute('data-tilemap-id', 'local:local-play-map');
});

test('same-device local scenario URL launches a saved draft', async ({ page }) => {
  await page.addInitScript(draft => localStorage.setItem('chibi.tilemap-editor.url-map', JSON.stringify(draft)), localDraft({ id: 'url-map', name: 'URL Map' }));
  await page.goto('/index.html?scenario=local:url-map&autorun=1');
  await expect(page.locator('body')).toHaveAttribute('data-tilemap-id', 'local:url-map');
  await expect(page.locator('#hudLevelName')).toContainText('URL Map');
});

test('local tab shows unplayable drafts disabled', async ({ page }) => {
  await page.addInitScript(draft => localStorage.setItem('chibi.tilemap-editor.needs-player', JSON.stringify(draft)), localDraft({ id: 'needs-player', name: 'Needs Player', player: false }));
  await page.goto('/');
  await page.locator('#startLevelSelectButton').click();
  await page.getByRole('tab', { name: /Local \(1\)/ }).click();

  await expect(page.getByText('Needs Player', { exact: true })).toBeVisible();
  await expect(page.getByText(/Needs Player P/)).toBeVisible();
  await expect(page.locator('button[data-scenario-id="local:needs-player"]')).toBeDisabled();
});
