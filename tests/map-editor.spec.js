import { expect, test } from '@playwright/test';

test('start screen points the map editor button at the extensionless production route', async ({ page }) => {
  await page.goto('/index.html');

  await page.getByRole('button', { name: 'Map Editor' }).click();

  await expect(page).toHaveURL(/\/editor$/);
});

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

test('map editor uses a fixed viewport canvas for large maps', async ({ page }) => {
  await page.goto('/editor.html');
  await page.locator('#colsInput').fill('120');
  await page.locator('#rowsInput').fill('80');
  await page.locator('#newButton').click();

  const metrics = await page.locator('#editorCanvas').evaluate(canvas => ({
    backingWidth: canvas.width,
    backingHeight: canvas.height,
    cssWidth: canvas.getBoundingClientRect().width,
    cssHeight: canvas.getBoundingClientRect().height
  }));

  expect(metrics.cssWidth).toBeGreaterThan(100);
  expect(metrics.cssHeight).toBeGreaterThan(100);
  expect(metrics.backingWidth).toBeLessThan(3840);
  expect(metrics.backingHeight).toBeLessThan(2560);
});

test('map editor zoom controls change viewport zoom without resizing to world size', async ({ page }) => {
  await page.goto('/editor.html');
  const before = await page.locator('#editorCanvas').getAttribute('data-zoom');

  await page.getByRole('button', { name: 'Zoom in' }).click();

  await expect.poll(() => page.locator('#editorCanvas').getAttribute('data-zoom')).not.toBe(before);
  await expect(page.locator('#zoomReadout')).toContainText('%');
});

test('map editor defers compile/export/persist during drag and flushes after painting', async ({ page }) => {
  await page.goto('/editor.html');
  await page.locator('#colsInput').fill('20');
  await page.locator('#rowsInput').fill('10');
  await page.locator('#newButton').click();
  await page.evaluate(() => { window.__mapEditorDebug.compileCount = 0; window.__mapEditorDebug.exportCount = 0; window.__mapEditorDebug.persistCount = 0; });

  const box = await page.locator('#editorCanvas').boundingBox();
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  for (let i = 1; i < 8; i++) await page.mouse.move(box.x + 8 + i * 16, box.y + 8);

  const duringDrag = await page.evaluate(() => ({ ...window.__mapEditorDebug }));
  expect(duringDrag.compileCount).toBe(0);
  expect(duringDrag.exportCount).toBe(0);
  expect(duringDrag.persistCount).toBe(0);

  await page.mouse.up();
  await expect(page.locator('#status')).toHaveClass(/ok/);
  const afterDrag = await page.evaluate(() => ({ ...window.__mapEditorDebug }));
  expect(afterDrag.compileCount).toBe(1);
  expect(afterDrag.exportCount).toBe(1);
  expect(afterDrag.persistCount).toBe(1);
});

test('map editor undo and redo operate on a whole paint stroke', async ({ page }) => {
  await page.goto('/editor.html');
  await page.locator('#colsInput').fill('4');
  await page.locator('#rowsInput').fill('3');
  await page.locator('#newButton').click();

  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();

  const box = await page.locator('#editorCanvas').boundingBox();
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 24, box.y + 8);
  await page.mouse.up();

  await expect(page.locator('#exportText')).toHaveValue(/'##\.\.\.\.\.\.'/);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#exportText')).toHaveValue(/'\.\.\.\.\.\.\.\.'/);
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled();

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.locator('#exportText')).toHaveValue(/'##\.\.\.\.\.\.'/);
});

test('map editor clears redo when a new paint stroke follows undo', async ({ page }) => {
  await page.goto('/editor.html');
  await page.locator('#colsInput').fill('4');
  await page.locator('#rowsInput').fill('3');
  await page.locator('#newButton').click();

  const box = await page.locator('#editorCanvas').boundingBox();
  await page.mouse.click(box.x + 8, box.y + 8);
  await expect(page.locator('#exportText')).toHaveValue(/'#\.\.\.\.\.\.\.'/);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled();

  await page.mouse.click(box.x + 40, box.y + 8);
  await expect(page.locator('#exportText')).toHaveValue(/'\.\.#\.\.\.\.\.'/);
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
});

test('map editor exports and imports shareable map files instead of JS downloads', async ({ page }) => {
  await page.goto('/editor.html');

  await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export map' }).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/\.chibi-map\.json$/);
  const payload = JSON.parse(await download.createReadStream().then(stream => new Promise((resolve, reject) => {
    let text = '';
    stream.on('data', chunk => { text += chunk.toString(); });
    stream.on('end', () => resolve(text));
    stream.on('error', reject);
  })));
  expect(payload.format).toBe('chibi-tilemap-draft');
  expect(payload.draft.layers.some(layer => layer.id === 'buildTerrain')).toBe(true);

  await page.locator('#importMapInput').setInputFiles({
    name: 'shared.chibi-map.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      format: 'chibi-tilemap-draft',
      version: 1,
      draft: {
        id: 'shared-play-map',
        name: 'Shared Play Map',
        cols: 4,
        rows: 3,
        artTileSize: 16,
        terrainRenderMode: 'contained-autotile',
        theme: 'kenney-pixel-platformer:grass',
        visibility: 'developer',
        categories: ['drafts'],
        description: 'Imported in Playwright.',
        layers: [
          { id: 'buildTerrain', cellSize: 16, rows: ['........', '........', '........', '........', '........', '########'] },
          { id: 'entities', cellSize: 32, rows: ['P...', '....', '...G'] }
        ]
      }
    }))
  });

  await expect(page.locator('#status')).toHaveText('Imported Shared Play Map and saved locally. Ready to preview.');
  await expect(page.locator('#exportText')).toHaveValue(/id: 'shared-play-map'/);
});

test('map editor save local timestamps draft for Level Select', async ({ page }) => {
  await page.goto('/editor.html');

  await page.locator('#nameInput').fill('Saved Local Map');
  await page.locator('#idInput').fill('saved-local-map');
  await page.getByRole('button', { name: 'Save local' }).click();

  await expect(page.locator('#status')).toContainText('Saved locally as saved-local-map.');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chibi.tilemap-editor.saved-local-map')));
  expect(saved.name).toBe('Saved Local Map');
  expect(saved.categories).toEqual(['levels', 'act-01']);
  expect(typeof saved.updatedAt).toBe('number');
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
