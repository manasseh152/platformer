import { CELL_SIZE } from '../core/constants.js';
import { drawTilemap } from '../render.js';
import { drawCollisionDebugOverlay } from '../devtools/debug-render.js';
import { getAllTilemaps, getDefaultTilemap } from '../content/tilemaps/registry.js';
import { EMPTY, compileDraft as compileTilemapDraft, createBlankDraft, createDraftFromTilemap as draftFromTilemap, hasEntitySymbol, replaceChar } from './tilemap-draft.js';

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
const registeredTilemaps = getAllTilemaps();
let brush = BRUSHES[0];
let draft = createDraftFromTilemap(getDefaultTilemap());
let compiled = null;
let pointer = null;
let isPainting = false;
let scale = 1;

function storageKey(id) { return `chibi.tilemap-editor.${id}`; }
function previewStorageKey(id) { return `${PREVIEW_STORAGE_PREFIX}${id}`; }

function createDraftFromTilemap(tilemap) {
  const saved = localStorage.getItem(storageKey(tilemap.id));
  if (saved) {
    try { return JSON.parse(saved); } catch { localStorage.removeItem(storageKey(tilemap.id)); }
  }
  return draftFromTilemap(tilemap);
}

function compileDraft() {
  compiled = compileTilemapDraft(draft);
  return compiled;
}

function serialiseRows(rows, indent = '    ') {
  return rows.map(row => `${indent}'${row}'`).join(',\n');
}

function generatedModule() {
  const terrain = draft.layers.find(layer => layer.id === 'buildTerrain');
  const entities = draft.layers.find(layer => layer.id === 'entities');
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

function camelIdentifier(id) {
  const value = id.replace(/[^a-zA-Z0-9]+(.)/g, (_, ch) => ch.toUpperCase()).replace(/^[^a-zA-Z_$]+/, '');
  return value ? `${value}Tilemap` : 'draftTilemap';
}
function escapeJs(value) { return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function cloneDraft(value) { return JSON.parse(JSON.stringify(value)); }

function sharePayload() {
  return {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    exportedAt: new Date().toISOString(),
    draft: cloneDraft(draft)
  };
}

function draftFromSharePayload(payload) {
  const candidate = payload?.format === SHARE_FORMAT ? payload.draft : payload;
  validateImportedDraft(candidate);
  return cloneDraft(candidate);
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

function validateLayerRows(layer, expectedCols, expectedRows, label) {
  if (!Number.isInteger(layer.cellSize) || layer.cellSize < 1) throw new Error(`${label} has an invalid cell size.`);
  if (!Number.isInteger(expectedCols) || !Number.isInteger(expectedRows)) throw new Error(`${label} dimensions do not line up with the map grid.`);
  if (!Array.isArray(layer.rows) || layer.rows.length !== expectedRows) throw new Error(`${label} must have ${expectedRows} rows.`);
  if (!layer.rows.every(row => typeof row === 'string' && row.length === expectedCols)) throw new Error(`${label} rows must be ${expectedCols} cells wide.`);
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportMap() {
  downloadText(`${draft.id}.chibi-map.json`, JSON.stringify(sharePayload(), null, 2), 'application/json');
  setStatus('Exported shareable map file.', 'ok');
}

async function importMapFile(file) {
  if (!file) return;
  try {
    draft = draftFromSharePayload(JSON.parse(await file.text()));
    persist();
    dom.tilemapSelect.value = getDefaultTilemap().id;
    render();
    setStatus(`Imported ${draft.name}. Ready to preview.`, 'ok');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    dom.importMapInput.value = '';
  }
}

function setStatus(message, kind = '') {
  dom.status.textContent = message;
  dom.status.className = `status ${kind}`.trim();
}

function syncInputs() {
  dom.colsInput.value = draft.cols;
  dom.rowsInput.value = draft.rows;
  dom.exportText.value = generatedModule();
}

function persist() {
  localStorage.setItem(storageKey(draft.id), JSON.stringify(draft));
}

function previewDraft() {
  try {
    compileDraft();
    if (!hasEntitySymbol(draft, 'P')) {
      setStatus('Add a Player P before previewing.', 'error');
      return;
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const key = previewStorageKey(id);
    localStorage.setItem(key, JSON.stringify({ draft, createdAt: Date.now() }));
    const url = `/index.html?previewTilemapKey=${encodeURIComponent(id)}&autorun=1&mode=developer`;
    const preview = window.open(url, 'chibiTilemapPreview');
    if (!preview) {
      localStorage.removeItem(key);
      setStatus('Preview popup blocked. Allow popups for this site and try again.', 'error');
      return;
    }
    const warning = hasEntitySymbol(draft, 'G') ? '' : ' No finish gate in draft.';
    setStatus(`Opened playable preview.${warning}`, hasEntitySymbol(draft, 'G') ? 'ok' : '');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function render() {
  try {
    compileDraft();
    dom.canvas.width = compiled.worldWidth;
    dom.canvas.height = compiled.worldHeight;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#090d15';
    ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);
    drawTilemap(ctx, compiled);
    drawEntities(ctx, compiled);
    if (dom.collisionToggle.checked) drawCollisionDebugOverlay(ctx, compiled, { showCollisionRects: true });
    if (dom.gridToggle.checked) drawGrid(ctx, compiled);
    if (pointer) drawCursor(ctx, pointer);
    syncInputs();
    setStatus(`Valid ${draft.cols}×${draft.rows} tilemap.`, 'ok');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

function drawGrid(ctx, tilemap) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  for (let x = 0; x <= tilemap.worldWidth; x += CELL_SIZE.BUILD) line(ctx, x + .5, 0, x + .5, tilemap.worldHeight);
  for (let y = 0; y <= tilemap.worldHeight; y += CELL_SIZE.BUILD) line(ctx, 0, y + .5, tilemap.worldWidth, y + .5);
  ctx.strokeStyle = 'rgba(121,240,197,.22)';
  for (let x = 0; x <= tilemap.worldWidth; x += CELL_SIZE.GRID) line(ctx, x + .5, 0, x + .5, tilemap.worldHeight);
  for (let y = 0; y <= tilemap.worldHeight; y += CELL_SIZE.GRID) line(ctx, 0, y + .5, tilemap.worldWidth, y + .5);
  ctx.restore();
}
function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

function drawEntities(ctx, tilemap) {
  const layer = draft.layers.find(layer => layer.id === 'entities');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 18px ui-monospace, monospace';
  layer.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === EMPTY) return;
    const px = x * CELL_SIZE.GRID;
    const py = y * CELL_SIZE.GRID;
    ctx.fillStyle = ch === 'P' ? '#78a8ff' : ch === 'E' ? '#ff7bd5' : '#ffd36a';
    ctx.globalAlpha = .88;
    ctx.fillRect(px + 4, py + 4, CELL_SIZE.GRID - 8, CELL_SIZE.GRID - 8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#071018';
    ctx.fillText(ch, px + CELL_SIZE.GRID / 2, py + CELL_SIZE.GRID / 2 + 1);
  }));
  ctx.restore();
}

function drawCursor(ctx, cursor) {
  ctx.save();
  ctx.strokeStyle = brush.cursor;
  ctx.lineWidth = 2;
  ctx.strokeRect(cursor.col * brush.cellSize + 1, cursor.row * brush.cellSize + 1, brush.cellSize - 2, brush.cellSize - 2);
  ctx.restore();
}

function canvasPoint(event) {
  const rect = dom.canvas.getBoundingClientRect();
  scale = dom.canvas.width / rect.width;
  return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale };
}

function pointerCell(event) {
  const point = canvasPoint(event);
  return { col: Math.floor(point.x / brush.cellSize), row: Math.floor(point.y / brush.cellSize) };
}

function paint(event) {
  const cell = pointerCell(event);
  pointer = cell;
  const layer = draft.layers.find(layer => layer.id === brush.layerId);
  if (!layer || cell.row < 0 || cell.row >= layer.rows.length || cell.col < 0 || cell.col >= layer.rows[0].length) return render();
  if (layer.rows[cell.row][cell.col] !== brush.symbol) {
    layer.rows[cell.row] = replaceChar(layer.rows[cell.row], cell.col, brush.symbol);
    persist();
  }
  render();
}

function buildBrushButtons() {
  dom.brushes.innerHTML = '';
  for (const candidate of BRUSHES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = candidate.label;
    button.className = candidate.id === brush.id ? 'active' : '';
    button.addEventListener('click', () => {
      brush = candidate;
      buildBrushButtons();
      render();
    });
    dom.brushes.append(button);
  }
}

function loadSelected(resetSaved = false) {
  const tilemap = registeredTilemaps.find(tilemap => tilemap.id === dom.tilemapSelect.value) ?? getDefaultTilemap();
  if (resetSaved) localStorage.removeItem(storageKey(tilemap.id));
  draft = createDraftFromTilemap(tilemap);
  render();
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
  dom.tilemapSelect.addEventListener('change', () => loadSelected());
  dom.resetButton.addEventListener('click', () => loadSelected(true));
  dom.newButton.addEventListener('click', () => {
    draft = createBlankDraft({ cols: Number(dom.colsInput.value), rows: Number(dom.rowsInput.value) });
    dom.tilemapSelect.value = getDefaultTilemap().id;
    render();
  });
  dom.gridToggle.addEventListener('change', render);
  dom.collisionToggle.addEventListener('change', render);
  dom.previewButton.addEventListener('click', previewDraft);
  dom.copyButton.addEventListener('click', async () => {
    await navigator.clipboard.writeText(dom.exportText.value);
    setStatus('Copied generated tilemap module.', 'ok');
  });
  dom.exportMapButton.addEventListener('click', exportMap);
  dom.importMapButton.addEventListener('click', () => dom.importMapInput.click());
  dom.importMapInput.addEventListener('change', () => importMapFile(dom.importMapInput.files?.[0]));
  dom.canvas.addEventListener('pointerdown', event => { isPainting = true; dom.canvas.setPointerCapture(event.pointerId); paint(event); });
  dom.canvas.addEventListener('pointermove', event => { pointer = pointerCell(event); if (isPainting) paint(event); else render(); });
  dom.canvas.addEventListener('pointerleave', () => { pointer = null; render(); });
  addEventListener('pointerup', () => { isPainting = false; });
  render();
}

setup();
