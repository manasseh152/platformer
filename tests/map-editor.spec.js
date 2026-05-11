import { expect, test } from '@playwright/test';

async function openMapPanel(page) {
  if (await page.locator('#mapPanel').isVisible()) return;
  await page.getByRole('tab', { name: 'Map' }).click();
  if (!(await page.locator('#mapPanel').isVisible())) await page.getByRole('tab', { name: 'Map' }).click();
}

async function createBlankMap(page, cols = '4', rows = '3') {
  await openMapPanel(page);
  await page.locator('#colsInput').fill(cols);
  await page.locator('#rowsInput').fill(rows);
  await page.locator('#newButton').click();
  await page.getByRole('tab', { name: 'Edit' }).click();
}

async function editorScreenPoint(page, worldX, worldY, cols = 4, rows = 3) {
  return page.locator('#editorCanvas').evaluate((canvas, { worldX, worldY, cols, rows }) => {
    const box = canvas.getBoundingClientRect();
    const zoom = Number(canvas.dataset.zoom || 1);
    const worldWidth = cols * 32;
    const worldHeight = rows * 32;
    return {
      x: box.x + (box.width - worldWidth * zoom) / 2 + worldX * zoom,
      y: box.y + (box.height - worldHeight * zoom) / 2 + worldY * zoom
    };
  }, { worldX, worldY, cols, rows });
}

test('start screen points the map editor button at the extensionless production route', async ({ page }) => {
  await page.goto('/index.html');

  await page.getByRole('button', { name: 'Map Editor' }).click();

  await expect(page).toHaveURL(/\/editor$/);
});

test('map editor loads registered tilemaps and exports new terrainLayer format', async ({ page }) => {
  await page.goto('/editor.html');

  await expect(page.locator('h1')).toHaveText('Tilemap Editor');
  await expect(page.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true');
  await openMapPanel(page);
  await expect(page.locator('#tilemapSelect')).toContainText('Act 01 Level 1');
  await expect(page.locator('#status')).toContainText('Valid');
  await expect(page.locator('#exportText')).toHaveValue(/terrainLayer\(\{ cellSize: CELL_SIZE\.BUILD/);
  await expect(page.locator('#exportText')).toHaveValue(/gridLayer\(\{ id: 'entities', cellSize: CELL_SIZE\.GRID/);
});

test('map editor migrates legacy buildTerrain drafts from local storage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('chibi.tilemap-editor.act-01-level-1', JSON.stringify({
      id: 'act-01-level-1',
      name: 'Legacy Saved Level',
      cols: 4,
      rows: 3,
      artTileSize: 16,
      terrainRenderMode: 'contained-autotile',
      theme: 'kenney-pixel-platformer:grass',
      visibility: 'developer',
      categories: ['drafts'],
      description: 'Old editor draft.',
      layers: [
        { id: 'buildTerrain', cellSize: 16, rows: ['##......', '##......', '........', '........', '......##', '......##'] },
        { id: 'entities', cellSize: 32, rows: ['P...', '....', '...G'] }
      ]
    }));
  });

  await page.goto('/editor.html');

  await expect(page.locator('#status')).toContainText('Valid 4×3 tilemap.');
  await expect(page.locator('#exportText')).toHaveValue(/terrainLayer\(\{ cellSize: CELL_SIZE\.BUILD/);
  await expect(page.locator('#exportText')).toHaveValue(/\[K\.GRASS, K\.GRASS, null, null, null, null, null, null\]/);
});

test('map editor paints terrain into exported rows', async ({ page }) => {
  await page.goto('/editor.html');
  await createBlankMap(page);

  const point = await editorScreenPoint(page, 8, 8);
  await page.mouse.click(point.x, point.y);

  await expect(page.locator('#exportText')).toHaveValue(/\[K\.GRASS, null, null, null, null, null, null, null\]/);
  await expect(page.locator('#status')).toHaveClass(/ok/);
});

test('map editor uses a fixed viewport canvas for large maps', async ({ page }) => {
  await page.goto('/editor.html');
  await createBlankMap(page, '120', '80');

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
  await createBlankMap(page, '20', '10');
  await page.evaluate(() => { window.__mapEditorDebug.compileCount = 0; window.__mapEditorDebug.exportCount = 0; window.__mapEditorDebug.persistCount = 0; });

  const start = await editorScreenPoint(page, 320, 8, 20, 10);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i < 8; i++) {
    const point = await editorScreenPoint(page, 320 + i * 16, 8, 20, 10);
    await page.mouse.move(point.x, point.y);
  }

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
  await createBlankMap(page);

  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();

  const start = await editorScreenPoint(page, 8, 8);
  const next = await editorScreenPoint(page, 24, 8);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(next.x, next.y);
  await page.mouse.up();

  await expect(page.locator('#exportText')).toHaveValue(/\[K\.GRASS, K\.GRASS, null, null, null, null, null, null\]/);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
  await expect(page.locator('#exportText')).toHaveValue(/\[null, null, null, null, null, null, null, null\]/);
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled();

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Shift+Z');
  await expect(page.locator('#exportText')).toHaveValue(/\[K\.GRASS, K\.GRASS, null, null, null, null, null, null\]/);
});

test('map editor clears redo when a new paint stroke follows undo', async ({ page }) => {
  await page.goto('/editor.html');
  await createBlankMap(page);

  const first = await editorScreenPoint(page, 8, 8);
  await page.mouse.click(first.x, first.y);
  await expect(page.locator('#exportText')).toHaveValue(/\[K\.GRASS, null, null, null, null, null, null, null\]/);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled();

  const second = await editorScreenPoint(page, 40, 8);
  await page.mouse.click(second.x, second.y);
  await expect(page.locator('#exportText')).toHaveValue(/\[null, null, K\.GRASS, null, null, null, null, null\]/);
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
});

test('map editor exports and imports shareable map files instead of JS downloads', async ({ page }) => {
  await page.goto('/editor.html');
  await openMapPanel(page);

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
  expect(payload.draft.layers.some(layer => layer.id === 'terrain' && layer.type === 'terrain')).toBe(true);

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
          { id: 'terrain', type: 'terrain', cellSize: 16, rows: [[null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass']] },
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
  await openMapPanel(page);

  await page.locator('#nameInput').fill('Saved Local Map');
  await page.locator('#idInput').fill('saved-local-map');
  await page.getByRole('button', { name: /Save now|Save local/ }).click();

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
  await openMapPanel(page);

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
  await createBlankMap(page);
  await openMapPanel(page);

  await page.getByRole('button', { name: 'Play preview' }).click();

  await expect(page.locator('#status')).toHaveText('Add a Player P before previewing.');
  await expect(page.locator('#status')).toHaveClass(/error/);
  await expect.poll(() => page.evaluate(() => window.__openedPreviews.length)).toBe(0);
});

test('map editor tab clicks toggle the floating overlay', async ({ page }) => {
  await page.goto('/editor.html');

  await expect(page.locator('#editorOverlay')).toBeVisible();
  await page.getByRole('tab', { name: 'Edit' }).click();
  await expect(page.locator('#editorOverlay')).toBeHidden();
  await page.getByRole('tab', { name: 'Edit' }).click();
  await expect(page.locator('#editorOverlay')).toBeVisible();
  await openMapPanel(page);
  await expect(page.locator('#mapPanel')).toBeVisible();
});

test('map editor shoulder buttons switch tabs and show controller hints', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');

  await expect(page.locator('[data-editor-tab-hint="previous"]')).toBeHidden();
  await expect(page.locator('[data-editor-tab-hint="next"]')).toBeHidden();

  await page.evaluate(() => window.__setMockGamepadButton(5, true));
  await expect(page.locator('#viewPanel')).toBeVisible();
  await expect(page.locator('[data-editor-tab-hint="previous"]')).toBeVisible();
  await expect(page.locator('[data-editor-tab-hint="previous"] .input-hint__icon')).toHaveAttribute('alt', 'LB');
  await expect(page.locator('[data-editor-tab-hint="next"]')).toBeVisible();
  await expect(page.locator('[data-editor-tab-hint="next"] .input-hint__icon')).toHaveAttribute('alt', 'RB');
  await page.evaluate(() => window.__setMockGamepadButton(5, false));
  await page.evaluate(() => window.__setMockGamepadButton(4, true));
  await expect(page.locator('#editPanel')).toBeVisible();
});

test('map editor controller navigates and activates controls in the selected tab', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');

  await page.evaluate(() => window.__setMockGamepadButton(5, true));
  await expect(page.locator('#viewPanel')).toBeVisible();
  await page.evaluate(() => window.__setMockGamepadButton(5, false));

  await page.evaluate(() => window.__setMockGamepadButton(13, true));
  await expect(page.locator('#gridToggle')).toBeFocused();
  await expect(page.locator('#gridToggle')).toHaveClass(/controller-focus/);
  await page.evaluate(() => window.__setMockGamepadButton(13, false));

  await page.evaluate(() => window.__setMockGamepadButton(0, true));
  await expect(page.locator('#gridToggle')).not.toBeChecked();
});

test('map editor keyboard and controller use two-axis navigation inside two-column groups', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');

  await page.getByRole('button', { name: 'Grass' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Dirt' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Invisible' })).toBeFocused();
  await page.keyboard.press('KeyW');
  await expect(page.getByRole('button', { name: 'Dirt' })).toBeFocused();

  await page.getByRole('tab', { name: 'Map' }).click();
  await page.locator('#colsInput').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#rowsInput')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#resetButton')).toBeFocused();

  await page.getByRole('tab', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Grass' }).focus();
  await page.evaluate(() => window.__setMockGamepadButton(15, true));
  await expect(page.getByRole('button', { name: 'Dirt' })).toBeFocused();
  await page.evaluate(() => window.__setMockGamepadButton(15, false));
  await page.evaluate(() => window.__setMockGamepadButton(13, true));
  await expect(page.getByRole('button', { name: 'Invisible' })).toBeFocused();
});

test('map editor controller treats text inputs as focus-only controls', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');

  await page.locator('#mapTab').click();
  await expect(page.locator('#mapPanel')).toBeVisible();
  await page.locator('#nameInput').focus();
  await page.locator('#nameInput').fill('Controller Focus Test');

  await page.evaluate(() => window.__setMockGamepadButton(0, true));
  await page.waitForTimeout(120);
  await expect(page.locator('#nameInput')).toBeFocused();
  await expect(page.locator('#nameInput')).toHaveValue('Controller Focus Test');
  await page.evaluate(() => window.__setMockGamepadButton(0, false));

  await page.evaluate(() => window.__setMockGamepadButton(13, true));
  await expect(page.locator('#idInput')).toBeFocused();
  await page.evaluate(() => window.__setMockGamepadButton(13, false));
  await page.waitForTimeout(80);

  await page.keyboard.type('-keyboard-ok');
  await expect(page.locator('#idInput')).toHaveValue(/-keyboard-ok$/);

  await page.evaluate(() => window.__setMockGamepadButton(13, true));
  await expect(page.locator('#colsInput')).toBeFocused();
  await page.evaluate(() => window.__setMockGamepadButton(13, false));
  await page.waitForTimeout(80);
  await page.evaluate(() => window.__setMockGamepadButton(12, true));
  await expect(page.locator('#idInput')).toBeFocused();
});

test('map editor can disable auto-save and commit with ctrl+s', async ({ page }) => {
  await page.goto('/editor.html');
  await openMapPanel(page);
  await page.locator('#autoSaveToggle').uncheck();
  await createBlankMap(page);
  await page.evaluate(() => { window.__mapEditorDebug.persistCount = 0; });

  const point = await editorScreenPoint(page, 8, 8);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(350);

  expect(await page.evaluate(() => window.__mapEditorDebug.persistCount)).toBe(0);
  await expect(page.getByRole('button', { name: 'Save local' })).toBeEnabled();

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S');
  await expect(page.locator('#status')).toContainText('Saved locally as');
  expect(await page.evaluate(() => window.__mapEditorDebug.persistCount)).toBe(1);
  await expect(page.getByRole('button', { name: 'Saved' })).toBeDisabled();
});

test('map editor persists the floating zoom controls preference', async ({ page }) => {
  await page.goto('/editor.html');
  await page.getByRole('tab', { name: 'View' }).click();
  await expect(page.locator('#floatingViewControls')).toBeVisible();

  await page.locator('#floatingControlsToggle').uncheck();
  await expect(page.locator('#floatingViewControls')).toBeHidden();

  await page.reload();
  await page.getByRole('tab', { name: 'View' }).click();
  await expect(page.locator('#floatingControlsToggle')).not.toBeChecked();
  await expect(page.locator('#floatingViewControls')).toBeHidden();
});

test('map editor ctrl+enter opens playable preview', async ({ page }) => {
  await page.addInitScript(() => {
    window.__openedPreviews = [];
    window.open = (url, target) => {
      window.__openedPreviews.push({ url, target });
      return { focus() {} };
    };
  });
  await page.goto('/editor.html');

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');

  await expect(page.locator('#status')).toContainText('Opened playable preview');
  await expect.poll(() => page.evaluate(() => window.__openedPreviews.length)).toBe(1);
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
          { id: 'terrain', type: 'terrain', cellSize: 16, rows: [[null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass']] },
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
