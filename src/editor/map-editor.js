import { CELL_SIZE } from '../core/constants.js';
import { drawCollisionDebugOverlay } from '../devtools/debug-render.js';
import { getAllTilemaps, getDefaultTilemap } from '../content/tilemaps/registry.js';
import { planContainedTerrainTileVisuals } from '../render/contained-terrain.js';
import { EMPTY, compileDraft as compileTilemapDraft, createBlankDraft, createDraftFromTilemap as draftFromTilemap, hasEntitySymbol, replaceChar } from './tilemap-draft.js';
import {
  applyWorldTransform,
  clearViewport,
  clampCamera,
  createViewport,
  eventToScreenPoint,
  eventToWorld,
  panByScreenDelta,
  resetView,
  resizeViewport,
  screenToWorld,
  visibleWorldRect,
  zoomAtScreenPoint
} from './editor-viewport.js';
import { createEditorScheduler } from './editor-scheduler.js';
import { createHistory } from './editor-history.js';

const SHARE_FORMAT = 'chibi-tilemap-draft';
const SHARE_VERSION = 1;
const PREVIEW_STORAGE_PREFIX = 'chibi.tilemap-preview.';
const BRUSHES = [
  { id: 'terrain', label: 'Terrain #', layerId: 'buildTerrain', symbol: '#', cellSize: CELL_SIZE.BUILD, cursor: '#79f0c5' },
  { id: 'eraseTerrain', label: 'Erase terrain', layerId: 'buildTerrain', symbol: EMPTY, cellSize: CELL_SIZE.BUILD, cursor: '#ff8f8f' },
  { id: 'player', label: 'Player P', layerId: 'entities', symbol: 'P', cellSize: CELL_SIZE.GRID, cursor: '#78a8ff' },
  { id: 'slime', label: 'Slime E', layerId: 'entities', symbol: 'E', cellSize: CELL_SIZE.GRID, cursor: '#ff7bd5' },
  { id: 'gate', label: 'Gate G', layerId: 'entities', symbol: 'G', cellSize: CELL_SIZE.GRID, cursor: '#ffd36a' },
  { id: 'eraseEntity', label: 'Erase entity', layerId: 'entities', symbol: EMPTY, cellSize: CELL_SIZE.GRID, cursor: '#ff8f8f' }
];

const dom = {
  canvas: document.querySelector('#editorCanvas'),
  tilemapSelect: document.querySelector('#tilemapSelect'),
  colsInput: document.querySelector('#colsInput'),
  rowsInput: document.querySelector('#rowsInput'),
  newButton: document.querySelector('#newButton'),
  resetButton: document.querySelector('#resetButton'),
  zoomOutButton: document.querySelector('#zoomOutButton'),
  zoomInButton: document.querySelector('#zoomInButton'),
  resetViewButton: document.querySelector('#resetViewButton'),
  zoomReadout: document.querySelector('#zoomReadout'),
  undoButton: document.querySelector('#undoButton'),
  redoButton: document.querySelector('#redoButton'),
  brushes: document.querySelector('#brushes'),
  gridToggle: document.querySelector('#gridToggle'),
  collisionToggle: document.querySelector('#collisionToggle'),
  previewButton: document.querySelector('#previewButton'),
  copyButton: document.querySelector('#copyButton'),
  exportMapButton: document.querySelector('#exportMapButton'),
  importMapButton: document.querySelector('#importMapButton'),
  importMapInput: document.querySelector('#importMapInput'),
  exportText: document.querySelector('#exportText'),
  status: document.querySelector('#status')
};

const ctx = dom.canvas.getContext('2d');
const viewport = createViewport(dom.canvas);
const scheduler = createEditorScheduler();
const history = createHistory({ limit: 100 });
const registeredTilemaps = getAllTilemaps();
const debug = window.__mapEditorDebug = window.__mapEditorDebug ?? { compileCount: 0, exportCount: 0, persistCount: 0, renderCount: 0 };

let brush = BRUSHES[0];
let draft = createDraftFromTilemap(getDefaultTilemap());
let compiled = null;
let compiledFresh = false;
let pointer = null;
let isPainting = false;
let panPointer = null;
let lastPaintKey = null;
let keysDown = new Set();
let activePointers = new Map();
let pinch = null;

function storageKey(id) { return `chibi.tilemap-editor.${id}`; }
function viewStorageKey(id) { return `chibi.tilemap-editor-view.${id}`; }
function previewStorageKey(id) { return `${PREVIEW_STORAGE_PREFIX}${id}`; }
function worldWidth() { return draft.cols * CELL_SIZE.GRID; }
function worldHeight() { return draft.rows * CELL_SIZE.GRID; }
function terrainLayer() { return draft.layers.find(layer => layer.id === 'buildTerrain'); }
function entityLayer() { return draft.layers.find(layer => layer.id === 'entities'); }

function createDraftFromTilemap(tilemap) {
  const saved = localStorage.getItem(storageKey(tilemap.id));
  if (saved) {
    try { return JSON.parse(saved); } catch { localStorage.removeItem(storageKey(tilemap.id)); }
  }
  return draftFromTilemap(tilemap);
}

function compileDraft() {
  debug.compileCount++;
  compiled = compileTilemapDraft(draft);
  compiledFresh = true;
  return compiled;
}

function ensureCompiled() {
  if (!compiled || !compiledFresh) compileDraft();
  return compiled;
}

function serialiseRows(rows, indent = '    ') { return rows.map(row => `${indent}'${row}'`).join(',\n'); }
function camelIdentifier(id) {
  const value = id.replace(/[^a-zA-Z0-9]+(.)/g, (_, ch) => ch.toUpperCase()).replace(/^[^a-zA-Z_$]+/, '');
  return value ? `${value}Tilemap` : 'draftTilemap';
}
function escapeJs(value) { return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function cloneDraft(value) { return JSON.parse(JSON.stringify(value)); }

function generatedModule() {
  debug.exportCount++;
  const terrain = terrainLayer();
  const entities = entityLayer();
  const categories = JSON.stringify(draft.categories ?? ['drafts']);
  return `import { CELL_SIZE } from '../../../core/constants.js';
import { defineTilemap, gridLayer } from '../../../core/tilemaps/tilemap.js';
import { finishGateObject, playerSpawner, slimeSpawner, solidTerrain } from '../objects.js';

export const ${camelIdentifier(draft.id)} = defineTilemap({
  id: '${draft.id}',
  name: '${escapeJs(draft.name)}',
  cols: ${draft.cols},
  rows: ${draft.rows},
  artTileSize: CELL_SIZE.BUILD,
  terrainRenderMode: 'contained-autotile',
  theme: '${draft.theme ?? 'kenney-pixel-platformer:grass'}',
  categories: ${categories},
  visibility: '${draft.visibility ?? 'developer'}',
  description: '${escapeJs(draft.description ?? '')}',
  layers: [
    gridLayer({ id: 'buildTerrain', cellSize: CELL_SIZE.BUILD, symbols: { '#': solidTerrain }, rows: [
${serialiseRows(terrain.rows, '      ')}
    ] }),
    gridLayer({ id: 'entities', cellSize: CELL_SIZE.GRID, symbols: { P: playerSpawner, E: slimeSpawner, G: finishGateObject }, rows: [
${serialiseRows(entities.rows, '      ')}
    ] })
  ]
});
`;
}

function sharePayload() {
  return { format: SHARE_FORMAT, version: SHARE_VERSION, exportedAt: new Date().toISOString(), draft: cloneDraft(draft) };
}

function validateLayerRows(layer, expectedCols, expectedRows, label) {
  if (!Number.isInteger(layer.cellSize) || layer.cellSize < 1) throw new Error(`${label} has an invalid cell size.`);
  if (!Number.isInteger(expectedCols) || !Number.isInteger(expectedRows)) throw new Error(`${label} dimensions do not line up with the map grid.`);
  if (!Array.isArray(layer.rows) || layer.rows.length !== expectedRows) throw new Error(`${label} must have ${expectedRows} rows.`);
  if (!layer.rows.every(row => typeof row === 'string' && row.length === expectedCols)) throw new Error(`${label} rows must be ${expectedCols} cells wide.`);
}

function validateImportedDraft(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Imported map is not a tilemap draft.');
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) throw new Error('Imported map needs an id.');
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) throw new Error('Imported map needs a name.');
  if (!Number.isInteger(candidate.cols) || candidate.cols < 1 || candidate.cols > 120) throw new Error('Imported map cols must be between 1 and 120.');
  if (!Number.isInteger(candidate.rows) || candidate.rows < 1 || candidate.rows > 80) throw new Error('Imported map rows must be between 1 and 80.');
  const terrain = candidate.layers?.find(layer => layer.id === 'buildTerrain');
  const entities = candidate.layers?.find(layer => layer.id === 'entities');
  if (!terrain || !entities) throw new Error('Imported map needs buildTerrain and entities layers.');
  validateLayerRows(terrain, candidate.cols * CELL_SIZE.GRID / terrain.cellSize, candidate.rows * CELL_SIZE.GRID / terrain.cellSize, 'buildTerrain');
  validateLayerRows(entities, candidate.cols, candidate.rows, 'entities');
  compileTilemapDraft(candidate);
}

function draftFromSharePayload(payload) {
  const candidate = payload?.format === SHARE_FORMAT ? payload.draft : payload;
  validateImportedDraft(candidate);
  return cloneDraft(candidate);
}

function setStatus(message, kind = '') {
  dom.status.textContent = message;
  dom.status.className = `status ${kind}`.trim();
}

function persist() {
  debug.persistCount++;
  localStorage.setItem(storageKey(draft.id), JSON.stringify(draft));
}

function saveView() {
  localStorage.setItem(viewStorageKey(draft.id), JSON.stringify(viewport.camera));
}

function loadViewOrReset() {
  resizeViewport(viewport);
  try {
    const saved = JSON.parse(localStorage.getItem(viewStorageKey(draft.id)) || 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && Number.isFinite(saved.zoom)) {
      viewport.camera = { x: saved.x, y: saved.y, zoom: Math.max(viewport.minZoom, Math.min(viewport.maxZoom, saved.zoom)) };
      clampCamera(viewport, worldWidth(), worldHeight());
      return;
    }
  } catch {}
  resetView(viewport, worldWidth(), worldHeight());
}

function syncInputs() {
  dom.colsInput.value = draft.cols;
  dom.rowsInput.value = draft.rows;
  dom.exportText.value = generatedModule();
  updateZoomReadout();
  updateHistoryControls();
}

function updateHistoryControls() {
  if (dom.undoButton) dom.undoButton.disabled = !history.canUndo;
  if (dom.redoButton) dom.redoButton.disabled = !history.canRedo;
}

function flushPending() {
  scheduler.flush(() => {
    ensureCompiled();
    persist();
    syncInputs();
    render();
    setStatus(`Valid ${draft.cols}×${draft.rows} tilemap.`, 'ok');
  });
}

function scheduleAfterEdit() {
  compiledFresh = false;
  scheduler.scheduleDebounced(() => {
    try {
      ensureCompiled();
      persist();
      syncInputs();
      render();
      setStatus(`Valid ${draft.cols}×${draft.rows} tilemap.`, 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });
}

function scheduleRender() { scheduler.scheduleFrame(render); }

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportMap() {
  flushPending();
  downloadText(`${draft.id}.chibi-map.json`, JSON.stringify(sharePayload(), null, 2), 'application/json');
  setStatus('Exported shareable map file.', 'ok');
}

async function importMapFile(file) {
  if (!file) return;
  try {
    history.clear();
    draft = draftFromSharePayload(JSON.parse(await file.text()));
    compiledFresh = false;
    ensureCompiled();
    persist();
    dom.tilemapSelect.value = getDefaultTilemap().id;
    resetView(viewport, worldWidth(), worldHeight());
    saveView();
    syncInputs();
    render();
    setStatus(`Imported ${draft.name}. Ready to preview.`, 'ok');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    dom.importMapInput.value = '';
  }
}

function previewDraft() {
  try {
    flushPending();
    if (!hasEntitySymbol(draft, 'P')) {
      setStatus('Add a Player P before previewing.', 'error');
      return;
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(previewStorageKey(id), JSON.stringify({ draft, createdAt: Date.now() }));
    const url = `/index.html?previewTilemapKey=${encodeURIComponent(id)}&autorun=1&mode=developer`;
    const preview = window.open(url, 'chibiTilemapPreview');
    if (!preview) {
      localStorage.removeItem(previewStorageKey(id));
      setStatus('Preview popup blocked. Allow popups for this site and try again.', 'error');
      return;
    }
    const warning = hasEntitySymbol(draft, 'G') ? '' : ' No finish gate in draft.';
    setStatus(`Opened playable preview.${warning}`, hasEntitySymbol(draft, 'G') ? 'ok' : '');
  } catch (error) { setStatus(error.message, 'error'); }
}

function drawContainedTerrainTile(ctx, tile) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(tile.x, tile.y, tile.w, tile.h);
  ctx.clip();
  for (const primitive of planContainedTerrainTileVisuals(tile)) {
    ctx.fillStyle = primitive.color;
    ctx.fillRect(primitive.x, primitive.y, primitive.w, primitive.h);
  }
  ctx.restore();
}

function intersects(rect, x, y, w, h) { return x < rect.x + rect.w && x + w > rect.x && y < rect.y + rect.h && y + h > rect.y; }

function drawCompiledTerrain(ctx, rect) {
  if (!compiledFresh || !compiled?.renderLayers?.containedTerrainTiles) return false;
  for (const tile of compiled.renderLayers.containedTerrainTiles) if (intersects(rect, tile.x, tile.y, tile.w, tile.h)) drawContainedTerrainTile(ctx, tile);
  return true;
}

function visibleCellRange(layer, rect) {
  const maxRow = layer.rows.length - 1;
  const maxCol = layer.rows[0].length - 1;
  return {
    startCol: Math.max(0, Math.floor(rect.x / layer.cellSize) - 1),
    endCol: Math.min(maxCol, Math.ceil((rect.x + rect.w) / layer.cellSize) + 1),
    startRow: Math.max(0, Math.floor(rect.y / layer.cellSize) - 1),
    endRow: Math.min(maxRow, Math.ceil((rect.y + rect.h) / layer.cellSize) + 1)
  };
}

function drawDraftTerrain(ctx, rect) {
  const layer = terrainLayer();
  const range = visibleCellRange(layer, rect);
  ctx.fillStyle = '#40504a';
  for (let row = range.startRow; row <= range.endRow; row++) {
    const line = layer.rows[row];
    for (let col = range.startCol; col <= range.endCol; col++) {
      if (line[col] === EMPTY) continue;
      ctx.fillRect(col * layer.cellSize, row * layer.cellSize, layer.cellSize, layer.cellSize);
    }
  }
}

function drawGrid(ctx, rect) {
  ctx.save();
  ctx.lineWidth = 1 / viewport.camera.zoom;
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  const drawLines = (step) => {
    const startX = Math.floor(rect.x / step) * step;
    const endX = rect.x + rect.w;
    const startY = Math.floor(rect.y / step) * step;
    const endY = rect.y + rect.h;
    for (let x = startX; x <= endX; x += step) line(ctx, x, rect.y, x, endY);
    for (let y = startY; y <= endY; y += step) line(ctx, rect.x, y, endX, y);
  };
  drawLines(CELL_SIZE.BUILD);
  ctx.strokeStyle = 'rgba(121,240,197,.22)';
  drawLines(CELL_SIZE.GRID);
  ctx.restore();
}
function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

function drawEntities(ctx, rect) {
  const layer = entityLayer();
  const range = visibleCellRange(layer, rect);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 18px ui-monospace, monospace';
  for (let row = range.startRow; row <= range.endRow; row++) {
    const line = layer.rows[row];
    for (let col = range.startCol; col <= range.endCol; col++) {
      const ch = line[col];
      if (ch === EMPTY) continue;
      const px = col * CELL_SIZE.GRID;
      const py = row * CELL_SIZE.GRID;
      ctx.fillStyle = ch === 'P' ? '#78a8ff' : ch === 'E' ? '#ff7bd5' : '#ffd36a';
      ctx.globalAlpha = .88;
      ctx.fillRect(px + 4, py + 4, CELL_SIZE.GRID - 8, CELL_SIZE.GRID - 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#071018';
      ctx.fillText(ch, px + CELL_SIZE.GRID / 2, py + CELL_SIZE.GRID / 2 + 1);
    }
  }
  ctx.restore();
}

function drawCursor(ctx, cursor) {
  const layer = draft.layers.find(layer => layer.id === brush.layerId);
  if (!layer || cursor.row < 0 || cursor.row >= layer.rows.length || cursor.col < 0 || cursor.col >= layer.rows[0].length) return;
  ctx.save();
  ctx.strokeStyle = brush.cursor;
  ctx.lineWidth = 2 / viewport.camera.zoom;
  ctx.strokeRect(cursor.col * brush.cellSize + 1, cursor.row * brush.cellSize + 1, brush.cellSize - 2, brush.cellSize - 2);
  ctx.restore();
}

function render() {
  debug.renderCount++;
  resizeViewport(viewport);
  clampCamera(viewport, worldWidth(), worldHeight());
  clearViewport(ctx, viewport);
  applyWorldTransform(ctx, viewport);
  const rect = visibleWorldRect(viewport);
  ctx.fillStyle = '#090d15';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (!drawCompiledTerrain(ctx, rect)) drawDraftTerrain(ctx, rect);
  drawEntities(ctx, rect);
  if (dom.collisionToggle.checked && compiled) drawCollisionDebugOverlay(ctx, compiled, { showCollisionRects: true });
  if (dom.gridToggle.checked) drawGrid(ctx, rect);
  if (pointer) drawCursor(ctx, pointer);
  updateZoomReadout();
}

function updateZoomReadout() {
  if (dom.zoomReadout) dom.zoomReadout.textContent = `${Math.round(viewport.camera.zoom * 100)}%`;
  dom.canvas.dataset.zoom = viewport.camera.zoom.toFixed(3);
}

function pointerCell(event) {
  const point = eventToWorld(viewport, event);
  return { col: Math.floor(point.x / brush.cellSize), row: Math.floor(point.y / brush.cellSize) };
}

function paint(event) {
  const cell = pointerCell(event);
  pointer = cell;
  const key = `${brush.layerId}:${cell.col},${cell.row}:${brush.symbol}`;
  if (key === lastPaintKey) return;
  lastPaintKey = key;
  const layer = draft.layers.find(layer => layer.id === brush.layerId);
  if (!layer || cell.row < 0 || cell.row >= layer.rows.length || cell.col < 0 || cell.col >= layer.rows[0].length) { scheduleRender(); return; }
  const before = layer.rows[cell.row][cell.col];
  if (before !== brush.symbol) {
    layer.rows[cell.row] = replaceChar(layer.rows[cell.row], cell.col, brush.symbol);
    history.recordCellChange({ layerId: brush.layerId, col: cell.col, row: cell.row, before, after: brush.symbol });
    updateHistoryControls();
    scheduleAfterEdit();
    setStatus('Editing…', '');
  }
  scheduleRender();
}

function applyHistoryCellChange(change) {
  const layer = draft.layers.find(layer => layer.id === change.layerId);
  if (!layer || change.row < 0 || change.row >= layer.rows.length || change.col < 0 || change.col >= layer.rows[0].length) return;
  layer.rows[change.row] = replaceChar(layer.rows[change.row], change.col, change.value);
}

function applyHistoryAction(kind) {
  const action = kind === 'undo' ? history.undo(applyHistoryCellChange) : history.redo(applyHistoryCellChange);
  if (!action) return;
  compiledFresh = false;
  updateHistoryControls();
  scheduleAfterEdit();
  render();
  setStatus(`${kind === 'undo' ? 'Undid' : 'Redid'} ${action.label}.`, '');
}

function startPan(event) {
  const point = eventToScreenPoint(dom.canvas, event);
  panPointer = { id: event.pointerId, x: point.x, y: point.y };
  dom.canvas.setPointerCapture(event.pointerId);
}

function updatePan(event) {
  const point = eventToScreenPoint(dom.canvas, event);
  panByScreenDelta(viewport, point.x - panPointer.x, point.y - panPointer.y, worldWidth(), worldHeight());
  panPointer = { ...panPointer, x: point.x, y: point.y };
  saveView();
  scheduleRender();
}

function isPanGesture(event) { return event.button === 1 || keysDown.has('Space'); }

function buildBrushButtons() {
  dom.brushes.innerHTML = '';
  for (const candidate of BRUSHES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = candidate.label;
    button.className = candidate.id === brush.id ? 'active' : '';
    button.addEventListener('click', () => { brush = candidate; buildBrushButtons(); render(); });
    dom.brushes.append(button);
  }
}

function loadSelected(resetSaved = false) {
  const tilemap = registeredTilemaps.find(tilemap => tilemap.id === dom.tilemapSelect.value) ?? getDefaultTilemap();
  if (resetSaved) localStorage.removeItem(storageKey(tilemap.id));
  history.clear();
  draft = createDraftFromTilemap(tilemap);
  compiledFresh = false;
  ensureCompiled();
  loadViewOrReset();
  syncInputs();
  render();
  setStatus(`Valid ${draft.cols}×${draft.rows} tilemap.`, 'ok');
}

function zoomBy(factor, screenPoint = { x: viewport.width / 2, y: viewport.height / 2 }) {
  zoomAtScreenPoint(viewport, screenPoint.x, screenPoint.y, viewport.camera.zoom * factor, worldWidth(), worldHeight());
  saveView();
  render();
}

function setupTouchPinch() {
  if (activePointers.size !== 2) { pinch = null; return; }
  const points = [...activePointers.values()];
  const dx = points[1].x - points[0].x;
  const dy = points[1].y - points[0].y;
  const distance = Math.hypot(dx, dy) || 1;
  const center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  pinch = { distance, center, zoom: viewport.camera.zoom, world: screenToWorld(viewport, center.x, center.y) };
}

function updateTouchPinch() {
  if (activePointers.size !== 2 || !pinch) return;
  const points = [...activePointers.values()];
  const dx = points[1].x - points[0].x;
  const dy = points[1].y - points[0].y;
  const distance = Math.hypot(dx, dy) || 1;
  const center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  viewport.camera.zoom = Math.max(viewport.minZoom, Math.min(viewport.maxZoom, pinch.zoom * distance / pinch.distance));
  viewport.camera.x = pinch.world.x - center.x / viewport.camera.zoom;
  viewport.camera.y = pinch.world.y - center.y / viewport.camera.zoom;
  clampCamera(viewport, worldWidth(), worldHeight());
  saveView();
  scheduleRender();
}

function setup() {
  for (const tilemap of registeredTilemaps) {
    const option = document.createElement('option');
    option.value = tilemap.id;
    option.textContent = `${tilemap.name} (${tilemap.id})`;
    dom.tilemapSelect.append(option);
  }
  dom.tilemapSelect.value = draft.id;
  buildBrushButtons();
  resizeViewport(viewport);
  compileDraft();
  loadViewOrReset();
  syncInputs();

  new ResizeObserver(() => { resizeViewport(viewport); clampCamera(viewport, worldWidth(), worldHeight()); render(); }).observe(dom.canvas.parentElement);
  dom.tilemapSelect.addEventListener('change', () => loadSelected());
  dom.resetButton.addEventListener('click', () => loadSelected(true));
  dom.newButton.addEventListener('click', () => {
    history.clear();
    draft = createBlankDraft({ cols: Number(dom.colsInput.value), rows: Number(dom.rowsInput.value) });
    dom.tilemapSelect.value = getDefaultTilemap().id;
    compiledFresh = false;
    ensureCompiled();
    resetView(viewport, worldWidth(), worldHeight());
    persist(); syncInputs(); render();
  });
  dom.gridToggle.addEventListener('change', render);
  dom.collisionToggle.addEventListener('change', () => { if (dom.collisionToggle.checked) ensureCompiled(); render(); });
  dom.previewButton.addEventListener('click', previewDraft);
  dom.copyButton.addEventListener('click', async () => { flushPending(); await navigator.clipboard.writeText(dom.exportText.value); setStatus('Copied generated tilemap module.', 'ok'); });
  dom.exportMapButton.addEventListener('click', exportMap);
  dom.importMapButton.addEventListener('click', () => dom.importMapInput.click());
  dom.importMapInput.addEventListener('change', () => importMapFile(dom.importMapInput.files?.[0]));
  dom.undoButton?.addEventListener('click', () => applyHistoryAction('undo'));
  dom.redoButton?.addEventListener('click', () => applyHistoryAction('redo'));
  dom.zoomOutButton?.addEventListener('click', () => zoomBy(0.8));
  dom.zoomInButton?.addEventListener('click', () => zoomBy(1.25));
  dom.resetViewButton?.addEventListener('click', () => { resetView(viewport, worldWidth(), worldHeight()); saveView(); render(); });
  dom.canvas.addEventListener('contextmenu', event => event.preventDefault());
  dom.canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const point = eventToScreenPoint(dom.canvas, event);
    zoomBy(event.deltaY > 0 ? 0.9 : 1.1, point);
  }, { passive: false });
  dom.canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    const screen = eventToScreenPoint(dom.canvas, event);
    activePointers.set(event.pointerId, screen);
    if (activePointers.size === 2) { isPainting = false; setupTouchPinch(); return; }
    if (isPanGesture(event)) { startPan(event); return; }
    isPainting = true;
    lastPaintKey = null;
    history.beginAction('paint stroke');
    updateHistoryControls();
    dom.canvas.setPointerCapture(event.pointerId);
    paint(event);
  });
  dom.canvas.addEventListener('pointermove', event => {
    const screen = eventToScreenPoint(dom.canvas, event);
    if (activePointers.has(event.pointerId)) activePointers.set(event.pointerId, screen);
    if (pinch) { updateTouchPinch(); return; }
    if (panPointer?.id === event.pointerId) { updatePan(event); return; }
    pointer = pointerCell(event);
    if (isPainting) paint(event); else scheduleRender();
  });
  dom.canvas.addEventListener('pointerleave', () => { if (!isPainting && !panPointer) { pointer = null; scheduleRender(); } });
  addEventListener('pointerup', event => {
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) pinch = null;
    if (panPointer?.id === event.pointerId) panPointer = null;
    if (isPainting) {
      isPainting = false;
      lastPaintKey = null;
      history.commitAction();
      updateHistoryControls();
      flushPending();
    }
  });
  addEventListener('keydown', event => {
    keysDown.add(event.code);
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return;
    if (event.code === 'KeyZ' && event.shiftKey) { event.preventDefault(); applyHistoryAction('redo'); }
    else if (event.code === 'KeyZ') { event.preventDefault(); applyHistoryAction('undo'); }
    else if (event.code === 'KeyY') { event.preventDefault(); applyHistoryAction('redo'); }
  });
  addEventListener('keyup', event => { keysDown.delete(event.code); });
  addEventListener('pagehide', flushPending);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPending(); });
  render();
  setStatus(`Valid ${draft.cols}×${draft.rows} tilemap.`, 'ok');
}

setup();
