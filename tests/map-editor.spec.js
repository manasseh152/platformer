import { expect, test } from '@playwright/test';

test('map editor loads registered tilemaps and exports new gridLayer format', async ({ page }) => {
  await page.goto('/editor.html');

  await expect(page.locator('h1')).toHaveText('Tilemap Editor');
  await expect(page.locator('#tilemapSelect')).toContainText('Act 01 Level 1');
  await expect(page.locator('#status')).toContainText('Valid');
  await expect(page.locator('#exportText')).toHaveValue(/gridLayer\(\{ id: 'buildTerrain', cellSize: CELL_SIZE\.BUILD/);
  await expect(page.locator('#exportText')).toHaveValue(/gridLayer\(\{ id: 'entities', cellSize: CELL_SIZE\.GRID/);
});

test('map editor paints terrain into exported rows', async ({ page }) => {
  await page.goto('/editor.html');
  await page.locator('#colsInput').fill('4');
  await page.locator('#rowsInput').fill('3');
  await page.locator('#newButton').click();

  const box = await page.locator('#editorCanvas').boundingBox();
  await page.mouse.click(box.x + 8, box.y + 8);

  await expect(page.locator('#exportText')).toHaveValue(/'#\.\.\.\.\.\.\.'/);
  await expect(page.locator('#status')).toHaveClass(/ok/);
});

test('map editor opens a playable preview payload for the current draft', async ({ page }) => {
  await page.addInitScript(() => {
    window.__openedPreviews = [];
    window.open = (url, target) => {
      window.__openedPreviews.push({ url, target });
      return { focus() {} };
    };
  });
  await page.goto('/editor.html');

  await page.getByRole('button', { name: 'Play preview' }).click();

  await expect(page.locator('#status')).toContainText('Opened playable preview');
  const opened = await page.evaluate(() => window.__openedPreviews[0]);
  expect(opened.target).toBe('chibiTilemapPreview');
  expect(opened.url).toContain('/index.html?previewTilemapKey=');
  expect(opened.url).toContain('autorun=1');
  expect(opened.url).toContain('mode=developer');

  const payload = await page.evaluate(url => {
    const params = new URL(url, location.origin).searchParams;
    const key = `chibi.tilemap-preview.${params.get('previewTilemapKey')}`;
    return JSON.parse(localStorage.getItem(key));
  }, opened.url);
  expect(payload.draft.id).toBeTruthy();
  expect(payload.draft.layers.some(layer => layer.id === 'entities' && layer.rows.some(row => row.includes('P')))).toBe(true);
});

test('map editor blocks preview until the draft has a player spawn', async ({ page }) => {
  await page.addInitScript(() => {
    window.__openedPreviews = [];
    window.open = (url, target) => {
      window.__openedPreviews.push({ url, target });
      return { focus() {} };
    };
  });
  await page.goto('/editor.html');
  await page.locator('#colsInput').fill('4');
  await page.locator('#rowsInput').fill('3');
  await page.locator('#newButton').click();

  await page.getByRole('button', { name: 'Play preview' }).click();

  await expect(page.locator('#status')).toHaveText('Add a Player P before previewing.');
  await expect(page.locator('#status')).toHaveClass(/error/);
  await expect.poll(() => page.evaluate(() => window.__openedPreviews.length)).toBe(0);
});

test('game page consumes a preview tilemap payload and starts play', async ({ page }) => {
  const key = 'playwright-preview';
  await page.addInitScript(previewKey => {
    localStorage.setItem(`chibi.tilemap-preview.${previewKey}`, JSON.stringify({
      createdAt: Date.now(),
      draft: {
        id: 'playwright-preview-map',
        name: 'Playwright Preview Map',
        cols: 4,
        rows: 3,
        artTileSize: 16,
        terrainRenderMode: 'contained-autotile',
        theme: 'kenney-pixel-platformer:grass',
        visibility: 'developer',
        categories: ['drafts'],
        description: 'Preview payload from Playwright.',
        layers: [
          { id: 'buildTerrain', cellSize: 16, rows: ['........', '........', '........', '........', '........', '########'] },
          { id: 'entities', cellSize: 32, rows: ['P...', '....', '...G'] }
        ]
      }
    }));
  }, key);

  await page.goto(`/index.html?previewTilemapKey=${key}&autorun=1&mode=developer`);

  await expect.poll(() => page.locator('body').getAttribute('data-preview-tilemap-status')).toBe('loaded');
  await expect(page.locator('body')).toHaveClass(/playing/);
  await expect.poll(() => page.evaluate(previewKey => localStorage.getItem(`chibi.tilemap-preview.${previewKey}`), key)).toBeNull();
});
