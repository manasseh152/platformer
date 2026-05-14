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

test('native browser back closes the editor action panel', async ({ page }) => {
  await page.goto('/editor.html');
  await expect(page.locator('#editorOverlay')).toBeVisible();

  await page.evaluate(() => history.back());

  await expect(page.locator('body')).toHaveAttribute('data-editor-panel', 'closed');
  await expect(page.locator('#editorOverlay')).toBeHidden();
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

test('map editor tabs and panels use the shared primitive contract', async ({ page }) => {
  await page.goto('/editor.html');

  await expect(page.getByRole('tablist', { name: 'Editor action groups' })).toHaveClass(/ds-tabs/);
  await expect(page.getByRole('tablist', { name: 'Editor action groups' })).toHaveClass(/ds-tabs--primary/);
  await expect(page.getByRole('tab', { name: 'Edit' })).toHaveClass(/ds-tab/);
  await expect(page.getByRole('tab', { name: 'Edit' })).toHaveAttribute('tabindex', '0');
  await expect(page.getByRole('tab', { name: 'Map' })).toHaveAttribute('tabindex', '-1');
  await expect(page.getByRole('tab', { name: 'Settings' })).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveText(['Edit', 'Map', 'View']);
  await page.getByRole('tab', { name: 'Map' }).click();
  await expect(page.locator('#mapPanel')).toHaveClass(/ds-tab-panel/);
  await expect(page.getByRole('tab', { name: 'Map' })).toHaveAttribute('tabindex', '0');
  await expect(page.getByRole('heading', { name: 'Map identity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Starting point' })).toBeVisible();
});

test('map editor tab clicks toggle the floating overlay', async ({ page }) => {
  await page.goto('/editor.html');

  await expect(page.locator('#editorOverlay')).toBeVisible();
  await expect(page.locator('#editorOverlay')).toHaveAttribute('data-collapsed', 'false');
  await page.getByRole('tab', { name: 'Edit' }).click();
  await expect(page.locator('#editorOverlay')).toBeHidden();
  await expect(page.locator('#editorOverlay')).toHaveAttribute('data-collapsed', 'true');
  await page.getByRole('tab', { name: 'Edit' }).click();
  await expect(page.locator('#editorOverlay')).toHaveAttribute('data-collapsed', 'false');
  await expect(page.locator('[data-overlay-toggle-label]')).toHaveText('Hide');
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
  await expect(page.locator('#mapPanel')).toBeVisible();
  await expect(page.locator('[data-editor-tab-hint="previous"]')).toBeVisible();
  await expect(page.locator('[data-editor-tab-hint="previous"] .input-hint__icon')).toHaveAttribute('alt', 'LB');
  await expect(page.locator('[data-editor-tab-hint="next"]')).toBeVisible();
  await expect(page.locator('[data-editor-tab-hint="next"] .input-hint__icon')).toHaveAttribute('alt', 'RB');
  await page.getByRole('tab', { name: 'Map' }).click();
  await expect(page.locator('#editorOverlay')).toHaveAttribute('data-collapsed', 'true');
  await expect(page.locator('[data-editor-tab-hint="previous"]')).toBeHidden();
  await expect(page.locator('[data-editor-tab-hint="next"]')).toBeHidden();
  await page.getByRole('tab', { name: 'Map' }).click();
  await expect(page.locator('[data-editor-tab-hint="previous"]')).toBeVisible();
  await expect(page.locator('[data-editor-tab-hint="next"]')).toBeVisible();
  await page.evaluate(() => window.__setMockGamepadButton(5, false));
  await page.evaluate(() => window.__setMockGamepadButton(4, true));
  await expect(page.locator('#editPanel')).toBeVisible();
});

test('map editor shows desktop viewport shortcuts until a controller is active', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');

  const desktopHints = page.locator('#desktopViewportHints');
  await expect(desktopHints).toBeVisible();
  await expect(desktopHints).toContainText('Paint');
  await expect(desktopHints).toContainText('Pan');
  await expect(desktopHints).toContainText('Zoom');
  await expect(desktopHints).toContainText('Undo');
  await expect(desktopHints.locator('.input-hint__icon[alt="Ctrl/⌘ + S"]')).toBeVisible();

  await page.evaluate(() => window.__setMockGamepadButton(7, true));
  await expect(page.locator('#controllerViewportHints')).toBeVisible();
  await expect(desktopHints).toBeHidden();
});

test('map editor controller hints follow panel vs canvas focus and zoom only on canvas', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');

  const before = await page.locator('#editorCanvas').getAttribute('data-zoom');
  await expect(page.locator('#controllerViewportHints')).toBeHidden();

  await page.evaluate(() => window.__setMockGamepadButton(7, true));
  await expect(page.locator('#controllerViewportHints')).toBeVisible();
  await expect(page.locator('#controllerViewportHints .input-hint__label').filter({ hasText: 'Select' })).toBeVisible();
  await expect(page.locator('#controllerViewportHints .input-hint__label').filter({ hasText: 'Pack' })).toBeHidden();
  await expect(page.locator('#controllerViewportHints .input-hint__label').filter({ hasText: 'Zoom' })).toBeHidden();
  await expect.poll(() => page.locator('#editorCanvas').getAttribute('data-zoom')).toBe(before);

  await page.evaluate(() => window.__setMockGamepadButton(7, false));
  await page.evaluate(() => window.__setMockGamepadButton(3, true));
  await expect(page.locator('#editorOverlay')).toBeHidden();
  await page.evaluate(() => window.__setMockGamepadButton(3, false));
  await page.evaluate(() => window.__setMockGamepadButton(7, true));
  await expect.poll(() => page.locator('#editorCanvas').getAttribute('data-zoom')).not.toBe(before);
  await expect(page.locator('#controllerViewportHints .input-hint__label').filter({ hasText: 'Zoom' })).toBeVisible();
  const packHint = page.locator('#controllerViewportHints [data-input-actions="editor.previousBrush editor.nextBrush"]');
  await expect(packHint.locator('.input-hint__icon').nth(0)).toHaveAttribute('alt', 'LB');
  await expect(packHint.locator('.input-hint__icon').nth(1)).toHaveAttribute('alt', 'RB');
  await expect(packHint.locator('.input-hint__label')).toHaveText('Pack');
  const zoomHint = page.locator('#controllerViewportHints [data-input-actions="editor.zoomOut editor.zoomIn"]');
  await expect(zoomHint.locator('.input-hint__icon').nth(0)).toHaveAttribute('alt', 'LT');
  await expect(zoomHint.locator('.input-hint__icon').nth(1)).toHaveAttribute('alt', 'RT');
  await expect(page.locator('#controllerPanelHint')).toBeVisible();
  await expect(page.locator('#hideOverlayButton .input-hint__label').filter({ hasText: 'Hide sidebar' })).toBeAttached();
  await expect(page.locator('#zoomReadout')).toContainText('%');
  await expect(page.locator('#zoomInButton')).toBeHidden();
});

test('map editor controller brush picker previews, commits, and cancels brushes', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  const press = async index => {
    await page.evaluate(i => window.__setMockGamepadButton(i, true), index);
    await page.waitForTimeout(80);
    await page.evaluate(i => window.__setMockGamepadButton(i, false), index);
    await page.waitForTimeout(80);
  };
  await page.goto('/editor.html');

  await press(3);
  await expect(page.locator('#editorOverlay')).toBeHidden();
  await press(1);
  await expect(page.locator('#packWheelHud')).toHaveAttribute('data-picker-open', '');
  await expect.poll(() => page.evaluate(() => window.__mapEditorDebug.controllerBrushPicker)).toMatchObject({ open: true, highlightedBrushId: 'grass', committedBrushId: 'grass' });

  await press(15);
  await expect.poll(() => page.evaluate(() => window.__mapEditorDebug.controllerBrushPicker)).toMatchObject({ open: true, highlightedBrushId: 'dirt', committedBrushId: 'grass' });
  await press(4);
  await expect.poll(() => page.evaluate(() => window.__mapEditorDebug.controllerBrushPicker)).toMatchObject({ open: true, highlightedBrushId: 'grass', committedBrushId: 'grass' });
  await press(5);
  await expect.poll(() => page.evaluate(() => window.__mapEditorDebug.controllerBrushPicker)).toMatchObject({ open: true, highlightedBrushId: 'dirt', committedBrushId: 'grass' });
  await expect(page.locator('#brushSectionTitle')).toHaveText('Selected: Grass');

  await press(0);
  await expect(page.locator('#packWheelHud')).not.toHaveAttribute('data-picker-open', '');
  await expect.poll(() => page.evaluate(() => window.__mapEditorDebug.controllerBrushPicker)).toMatchObject({ open: false, committedBrushId: 'dirt' });
  await expect(page.locator('#brushSectionTitle')).toHaveText('Selected: Dirt');

  await press(1);
  await press(4);
  await expect.poll(() => page.evaluate(() => window.__mapEditorDebug.controllerBrushPicker)).toMatchObject({ open: true, highlightedBrushId: 'grass', committedBrushId: 'dirt' });
  await press(1);
  await expect.poll(() => page.evaluate(() => window.__mapEditorDebug.controllerBrushPicker)).toMatchObject({ open: false, committedBrushId: 'dirt' });
  await expect(page.locator('#brushSectionTitle')).toHaveText('Selected: Dirt');
});

test('map editor edit tab groups pack items by editable layer', async ({ page }) => {
  await page.goto('/editor.html');

  await expect(page.getByRole('heading', { name: 'Layers' })).toBeVisible();
  await expect(page.locator('#packSectionTitle')).toHaveText('Starter asset pack');
  await expect(page.locator('#brushSectionTitle')).toHaveText('Selected: Grass');
  await expect(page.getByRole('button', { name: 'Grass' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Player P' })).toHaveCount(0);

  await page.getByRole('button', { name: /Entities/ }).click();
  await expect(page.locator('#packSectionTitle')).toHaveText('Starter asset pack');
  await expect(page.locator('#brushSectionTitle')).toHaveText('Selected: Player P');
  await expect(page.getByRole('button', { name: 'Player P' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grass' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Lights/ })).toBeDisabled();
});

test('map editor persists controller brush sensitivity and momentum settings', async ({ page }) => {
  await page.goto('/editor.html');
  await expect(page.getByRole('tab', { name: 'Settings' })).toHaveCount(0);
  await expect(page.locator('#controllerBrushSensitivityInput')).toBeHidden();
  await page.getByText('Controller cursor').click();

  await page.locator('#controllerBrushSensitivityInput').fill('8');
  await expect(page.locator('#controllerBrushSensitivityValue')).toHaveText('8');
  await page.locator('#controllerBrushMomentumToggle').check();
  await page.locator('#controllerBrushMomentumDelayInput').fill('300');
  await page.locator('#controllerBrushMomentumSpeedInput').fill('3.25');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chibi.tilemap-editor.controller-brush')));
  expect(saved).toEqual({ sensitivity: 8, momentumEnabled: true, momentumDelayMs: 300, momentumMaxSpeed: 3.25 });

  await page.reload();
  await page.getByText('Controller cursor').click();
  await expect(page.locator('#controllerBrushSensitivityInput')).toHaveValue('8');
  await expect(page.locator('#controllerBrushMomentumToggle')).toBeChecked();
  await expect(page.locator('#controllerBrushMomentumDelayInput')).toHaveValue('300');
  await expect(page.locator('#controllerBrushMomentumSpeedInput')).toHaveValue('3.25');
});

test('map editor shows a focused canvas cell as soon as controller drawing starts', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');
  await createBlankMap(page, '4', '3');
  await page.evaluate(() => { window.__mapEditorDebug.cursorRenderCount = 0; window.__mapEditorDebug.cursor = null; });

  await page.evaluate(() => window.__setMockGamepadButton(3, true));

  await expect(page.locator('#editorOverlay')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__mapEditorDebug.cursorRenderCount)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__mapEditorDebug.cursor)).toEqual({ col: 4, row: 3, layerId: 'terrain', brushId: 'grass' });
});

test('map editor shows a ghost target while controller-panning and resumes drawing there', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    window.__setMockGamepadAxis = (index, value) => { pad.axes[index] = value; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');
  await createBlankMap(page, '60', '30');

  await page.evaluate(() => window.__setMockGamepadButton(3, true));
  await expect(page.locator('#editorOverlay')).toBeHidden();
  await page.evaluate(() => window.__setMockGamepadButton(3, false));

  await page.evaluate(() => window.__setMockGamepadButton(2, true));
  await expect(page.locator('body')).toHaveAttribute('data-editor-controller-mode', 'navigate');
  await page.evaluate(() => window.__setMockGamepadButton(2, false));
  await expect.poll(() => page.evaluate(() => window.__mapEditorDebug.ghostCursorRenderCount ?? 0)).toBeGreaterThan(0);
  const firstGhost = await page.evaluate(() => window.__mapEditorDebug.ghostCursor);

  await page.evaluate(() => window.__setMockGamepadAxis(0, 1));
  await expect.poll(() => page.evaluate(() => window.__mapEditorDebug.ghostCursor)).not.toEqual(firstGhost);
  await page.evaluate(() => window.__setMockGamepadAxis(0, 0));
  await page.waitForTimeout(100);
  const targetGhost = await page.evaluate(() => window.__mapEditorDebug.ghostCursor);

  await page.evaluate(() => window.__setMockGamepadButton(2, true));
  await expect(page.locator('body')).toHaveAttribute('data-editor-controller-mode', 'draw');
  await expect.poll(() => page.evaluate(() => window.__mapEditorDebug.cursor)).toEqual(targetGhost);
});

test('map editor controller paints a continuous stroke while the paint button is held', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');
  await createBlankMap(page, '4', '3');

  await page.evaluate(() => window.__setMockGamepadButton(3, true));
  await expect(page.locator('#editorOverlay')).toBeHidden();
  await expect(page.locator('#editorOverlay')).toHaveAttribute('data-collapsed', 'true');
  await expect(page.locator('#controllerViewportHints .input-hint__label').filter({ hasText: 'Open panel' })).toBeVisible();
  await page.evaluate(() => window.__setMockGamepadButton(3, false));

  await page.evaluate(() => window.__setMockGamepadButton(0, true));
  await page.evaluate(() => window.__setMockGamepadButton(15, true));
  await page.waitForTimeout(260);
  await page.evaluate(() => window.__setMockGamepadButton(15, false));
  await page.evaluate(() => window.__setMockGamepadButton(0, false));

  await expect(page.locator('#exportText')).toHaveValue(/\[null, null, null, null, K\.GRASS, K\.GRASS, K\.GRASS, K\.GRASS\]/);
  await page.evaluate(() => window.__setMockGamepadButton(3, true));
  await expect(page.locator('#editorOverlay')).toHaveAttribute('data-collapsed', 'false');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
});

test('map editor controller navigates and activates controls in the selected tab', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');

  await page.evaluate(() => window.__setMockGamepadButton(4, true));
  await expect(page.locator('#viewPanel')).toBeVisible();
  await page.evaluate(() => window.__setMockGamepadButton(4, false));

  await page.evaluate(() => window.__setMockGamepadButton(13, true));
  await expect(page.locator('#gridToggle')).toBeFocused();
  await expect(page.locator('#gridToggle')).toHaveClass(/controller-focus/);
  await expect(page.locator('label.check', { has: page.locator('#gridToggle') })).toHaveClass(/controller-focus/);
  await page.evaluate(() => window.__setMockGamepadButton(13, false));

  await page.evaluate(() => window.__setMockGamepadButton(0, true));
  await expect(page.locator('#gridToggle')).not.toBeChecked();
  await expect(page.locator('label.check', { has: page.locator('#gridToggle') })).toHaveCSS('box-shadow', /inset/);
});

test('map editor controller can focus and toggle details disclosures', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');

  await page.mouse.click((await editorScreenPoint(page, 8, 8)).x, (await editorScreenPoint(page, 8, 8)).y);
  await expect(page.locator('#undoButton')).toBeEnabled();
  await page.locator('#undoButton').focus();
  await page.evaluate(() => window.__setMockGamepadButton(13, true));
  await expect(page.locator('.panel-disclosure > summary')).toBeFocused();
  await page.evaluate(() => window.__setMockGamepadButton(13, false));
  await page.evaluate(() => window.__setMockGamepadButton(0, true));
  await expect(page.locator('.panel-disclosure')).toHaveAttribute('open', '');
  await expect(page.locator('#controllerBrushSensitivityInput')).toBeVisible();
  await page.evaluate(() => window.__setMockGamepadButton(0, false));

  await openMapPanel(page);
  await page.locator('#importMapButton').focus();
  await page.evaluate(() => window.__setMockGamepadButton(13, true));
  await expect(page.locator('.source-disclosure > summary')).toBeFocused();
  await page.evaluate(() => window.__setMockGamepadButton(13, false));
  await page.evaluate(() => window.__setMockGamepadButton(0, true));
  await expect(page.locator('.source-disclosure')).toHaveAttribute('open', '');
  await expect(page.locator('#exportText')).toBeVisible();
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
  await expect(page.locator('#newButton')).toBeFocused();

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
  await page.waitForTimeout(150);
  await page.locator('#idInput').focus();
  await page.locator('#idInput').fill('act-01-level-1-keyboard-ok');
  await expect(page.locator('#idInput')).toHaveValue(/-keyboard-ok$/);

  await page.locator('#colsInput').focus();
  await page.locator('#colsInput').fill('12');
  await page.evaluate(() => window.__setMockGamepadButton(0, true));
  await page.waitForTimeout(120);
  await expect(page.locator('#colsInput')).toBeFocused();
  await expect(page.locator('#colsInput')).toHaveValue('12');
  await page.evaluate(() => window.__setMockGamepadButton(0, false));
  await page.evaluate(() => window.__setMockGamepadButton(13, true));
  await expect(page.locator('#newButton')).toBeFocused();
});

test('map editor controller does not change a focused select until A opens it', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');
  await openMapPanel(page);

  const select = page.locator('#tilemapSelect');
  await select.focus();
  const firstValue = await select.inputValue();

  await page.evaluate(() => window.__setMockGamepadButton(13, true));
  await page.waitForTimeout(120);
  await expect(select).toHaveValue(firstValue);
});

test('map editor controller opens a select list and confirms an option with A', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes: [0, 0, 0, 0] };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');
  await openMapPanel(page);

  const select = page.locator('#tilemapSelect');
  await select.focus();
  const firstValue = await select.inputValue();

  await page.evaluate(() => window.__setMockGamepadButton(0, true));
  await expect(select).toHaveAttribute('data-controller-select-open', 'true');
  await expect(select).toHaveJSProperty('size', 8);
  await expect(page.locator('#status')).toContainText('D-pad or stick highlights an option');
  await page.evaluate(() => window.__setMockGamepadButton(0, false));

  await page.evaluate(() => window.__setMockGamepadButton(13, true));
  await expect.poll(() => select.inputValue()).not.toBe(firstValue);
  await expect(select).toBeFocused();
  await page.evaluate(() => window.__setMockGamepadButton(13, false));

  await page.evaluate(() => window.__setMockGamepadButton(0, true));
  await expect(select).not.toHaveAttribute('data-controller-select-open', 'true');
  await expect(select).toHaveJSProperty('size', 0);
  await expect(page.locator('#status')).toContainText('Selection confirmed');
});

test('map editor controller can highlight select options with the left stick', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const axes = [0, 0, 0, 0];
    const pad = { index: 0, id: 'Mock Controller', mapping: 'standard', buttons, axes };
    window.__setMockGamepadButton = (index, pressed) => { buttons[index] = { pressed }; };
    window.__setMockGamepadAxis = (index, value) => { axes[index] = value; };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await page.goto('/editor.html');
  await openMapPanel(page);

  const select = page.locator('#tilemapSelect');
  await select.focus();
  const firstValue = await select.inputValue();

  await page.evaluate(() => window.__setMockGamepadButton(0, true));
  await expect(select).toHaveAttribute('data-controller-select-open', 'true');
  await page.evaluate(() => window.__setMockGamepadButton(0, false));

  await page.evaluate(() => window.__setMockGamepadAxis(1, 1));
  await expect.poll(() => select.inputValue()).not.toBe(firstValue);
  await expect(select).toBeFocused();
  await page.evaluate(() => window.__setMockGamepadAxis(1, 0));

  await page.evaluate(() => window.__setMockGamepadButton(0, true));
  await expect(select).not.toHaveAttribute('data-controller-select-open', 'true');
  await expect(page.locator('#status')).toContainText('Selection confirmed');
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

test('map editor topbar actions render shortcut hints', async ({ page }) => {
  await page.goto('/editor.html');

  await expect(page.locator('#mainMenuButton .input-hint__label')).toHaveText('Main menu');
  await expect(page.locator('#quickPreviewButton .input-hint__label')).toHaveText('Preview');
  await expect(page.locator('#mainMenuButton .input-hint__icon, #mainMenuButton .ds-keycap').first()).toBeVisible();
  await expect(page.locator('#quickPreviewButton .input-hint__icon, #quickPreviewButton .ds-keycap').first()).toBeVisible();
});

test('map editor topbar preview opens without visiting the Map tab', async ({ page }) => {
  await page.addInitScript(() => {
    window.__openedPreviews = [];
    window.open = (url, target) => {
      window.__openedPreviews.push({ url, target });
      return { focus() {} };
    };
  });
  await page.goto('/editor.html');

  await expect(page.locator('#editPanel')).toBeVisible();
  await page.locator('#quickPreviewButton').click();

  await expect(page.locator('#status')).toContainText('Opened playable preview');
  await expect.poll(() => page.evaluate(() => window.__openedPreviews.length)).toBe(1);
});

test('map editor ctrl+m returns to the main menu', async ({ page }) => {
  await page.goto('/editor.html');

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+M' : 'Control+M');

  await expect(page).toHaveURL(/\/index\.html$/);
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


test('preview mode pause overlay is editor-return only and Escape resumes', async ({ page }) => {
  const key = 'playwright-preview-pause';
  await page.addInitScript(previewKey => {
    localStorage.setItem(`chibi.tilemap-preview.${previewKey}`, JSON.stringify({
      createdAt: Date.now(),
      draft: {
        id: 'playwright-preview-pause-map',
        name: 'Playwright Preview Pause Map',
        cols: 4,
        rows: 3,
        artTileSize: 16,
        terrainRenderMode: 'contained-autotile',
        theme: 'kenney-pixel-platformer:grass',
        visibility: 'developer',
        categories: ['drafts'],
        description: 'Preview pause payload from Playwright.',
        layers: [
          { id: 'terrain', type: 'terrain', cellSize: 16, rows: [[null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null], ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass']] },
          { id: 'entities', cellSize: 32, rows: ['P...', '....', '...G'] }
        ]
      }
    }));
  }, key);

  await page.goto(`/index.html?previewTilemapKey=${key}&autorun=1&mode=developer`);
  await expect.poll(() => page.locator('body').getAttribute('data-preview-tilemap-status')).toBe('loaded');

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveClass(/\bpaused\b/);
  await expect(page.locator('#pauseScreen #resumeButton')).toBeHidden();
  await expect(page.locator('#pauseScreen #levelSelectButton')).toBeHidden();
  await expect(page.locator('#pauseScreen #mainMenuButton')).toBeHidden();
  await expect(page.locator('#pauseScreen #settingsButton')).toBeVisible();
  await expect(page.locator('#pauseScreen #restartButton')).toBeVisible();
  await expect(page.locator('#pauseScreen #closeGameButton')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/\bpaused\b/);
  await expect(page).toHaveURL(/previewTilemapKey=/);

  await page.keyboard.press('Escape');
  await page.locator('#pauseScreen #closeGameButton').click();
  await expect(page).toHaveURL(/\/editor\.html$/);
});
