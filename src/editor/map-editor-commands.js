import { CELL_SIZE } from '../core/constants.js';
import { isKebabCaseId } from '../catalog/id.js';
import { compileDraft as compileTilemapDraft, hasEntitySymbol, normalizeDraft } from './tilemap-draft.js';

export const SHARE_FORMAT = 'chibi-tilemap-draft';
export const SHARE_VERSION = 2;
export const PREVIEW_STORAGE_PREFIX = 'chibi.tilemap-preview.';

export function readBooleanPreference(storage, key, defaultValue) {
  try { const value = storage.getItem(key); return value === null ? defaultValue : value === 'true'; } catch { return defaultValue; }
}
export function writeBooleanPreference(storage, key, value) { storage.setItem(key, value ? 'true' : 'false'); }
export function previewStorageKey(id) { return `${PREVIEW_STORAGE_PREFIX}${id}`; }

function serialiseStringRows(rows, indent = '    ') { return rows.map(row => `${indent}'${row}'`).join(',\n'); }
function serialiseBrushRows(rows, indent = '    ') { return rows.map(row => `${indent}[${row.map(value => value === null ? 'null' : `'${value}'`).join(', ')}]`).join(',\n'); }
function cellSizeExpr(size) { return size === CELL_SIZE.BUILD ? 'CELL_SIZE.BUILD' : (size === CELL_SIZE.GRID ? 'CELL_SIZE.GRID' : String(size)); }
function camelIdentifier(id) { const value = id.replace(/[^a-zA-Z0-9]+(.)/g, (_, ch) => ch.toUpperCase()).replace(/^[^a-zA-Z_$]+/, ''); return value ? `${value}Tilemap` : 'draftTilemap'; }
function escapeJs(value) { return String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'"); }
function cloneDraft(value) { return JSON.parse(JSON.stringify(value)); }

export function generatedTilemapModule(draft) {
  draft = normalizeDraft(draft);
  const solid = draft.layers.find(layer => layer.id === 'solid');
  const placedAssets = draft.layers.find(layer => layer.id === 'placedAssets');
  const hazards = draft.layers.find(layer => layer.id === 'hazards');
  const categories = JSON.stringify(draft.categories ?? ['drafts']);
  return `import { CELL_SIZE } from '../../../core/constants.js';
import { brushGridLayer, defineTilemap, placedAssetsLayer, solidLayer } from '../../../core/tilemaps/tilemap.js';
import { finishGateObject, playerSpawner, slimeSpawner } from '../objects.js';
import { BUILTIN_BRUSHES } from '../brushes.js';
import { BUILTIN_MATERIALS } from '../materials.js';

export const ${camelIdentifier(draft.id)} = defineTilemap({
  schemaVersion: 2,
  id: '${draft.id}',
  name: '${escapeJs(draft.name)}',
  cols: ${draft.cols},
  rows: ${draft.rows},
  artTileSize: CELL_SIZE.BUILD,
  theme: '${draft.theme ?? 'kenney-pixel-platformer:grass'}',
  categories: ${categories},
  visibility: '${draft.visibility ?? 'developer'}',
  description: '${escapeJs(draft.description ?? '')}',
  brushes: BUILTIN_BRUSHES,
  materials: BUILTIN_MATERIALS,
  layers: [
    solidLayer({ cellSize: CELL_SIZE.BUILD, rows: [
${serialiseBrushRows(solid.rows, '      ')}
    ] }),
    placedAssetsLayer({ cellSize: ${cellSizeExpr(placedAssets.cellSize ?? CELL_SIZE.BUILD)}, objectSize: CELL_SIZE.GRID, symbols: { P: playerSpawner, E: slimeSpawner, G: finishGateObject }, rows: [
${serialiseStringRows(placedAssets.rows, '      ')}
    ] }),
    brushGridLayer({ id: 'hazards', cellSize: CELL_SIZE.BUILD, accepts: ['visual', 'hazard'], z: 5, rows: [
${serialiseBrushRows(hazards.rows, '      ')}
    ] })
  ]
});
`;
}

export function createSharePayload(draft, { now = () => new Date() } = {}) { return { format: SHARE_FORMAT, version: SHARE_VERSION, exportedAt: now().toISOString(), draft: cloneDraft(normalizeDraft(draft)) }; }

function validateLayerRows(layer, expectedCols, expectedRows, label) {
  if (!Number.isInteger(layer.cellSize) || layer.cellSize < 1) throw new Error(`${label} has an invalid cell size.`);
  if (!Number.isInteger(expectedCols) || !Number.isInteger(expectedRows)) throw new Error(`${label} dimensions do not line up with the map grid.`);
  if (!Array.isArray(layer.rows) || layer.rows.length !== expectedRows) throw new Error(`${label} must have ${expectedRows} rows.`);
  if (layer.type === 'brush-grid') {
    if (!layer.rows.every(row => Array.isArray(row) && row.length === expectedCols && row.every(cell => cell === null || typeof cell === 'string'))) throw new Error(`${label} rows must be ${expectedCols} brush cells wide.`);
  } else if (!layer.rows.every(row => typeof row === 'string' && row.length === expectedCols)) throw new Error(`${label} rows must be ${expectedCols} cells wide.`);
}

export function validateImportedDraft(candidate) {
  candidate = normalizeDraft(candidate);
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Imported map is not a tilemap draft.');
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) throw new Error('Imported map needs an id.');
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) throw new Error('Imported map needs a name.');
  if (!Number.isInteger(candidate.cols) || candidate.cols < 1) throw new Error('Imported map cols must be a positive integer.');
  if (!Number.isInteger(candidate.rows) || candidate.rows < 1) throw new Error('Imported map rows must be a positive integer.');
  const solid = candidate.layers?.find(layer => layer.id === 'solid');
  const placedAssets = candidate.layers?.find(layer => layer.id === 'placedAssets');
  const hazards = candidate.layers?.find(layer => layer.id === 'hazards');
  if (!solid || !placedAssets) throw new Error('Imported map needs solid and placed assets layers.');
  validateLayerRows(solid, candidate.cols * CELL_SIZE.GRID / solid.cellSize, candidate.rows * CELL_SIZE.GRID / solid.cellSize, 'solid');
  validateLayerRows(placedAssets, candidate.cols * CELL_SIZE.GRID / placedAssets.cellSize, candidate.rows * CELL_SIZE.GRID / placedAssets.cellSize, 'placedAssets');
  if (hazards) validateLayerRows(hazards, candidate.cols * CELL_SIZE.GRID / hazards.cellSize, candidate.rows * CELL_SIZE.GRID / hazards.cellSize, 'hazards');
  compileTilemapDraft(candidate);
}

export function draftFromSharePayload(payload) { const candidate = normalizeDraft(payload?.format === SHARE_FORMAT ? payload.draft : payload); validateImportedDraft(candidate); return cloneDraft(candidate); }

export function getImportedDraftSizeWarning(draft) {
  const candidate = normalizeDraft(draft);
  if (!candidate || candidate.cols <= 128 && candidate.rows <= 128) return '';
  return `Warning: imported map is ${candidate.cols}×${candidate.rows}. Maps wider or taller than 128 cells may be slow to edit or save.`;
}

export function createPreviewPayload(draft, { id, now = () => Date.now() }) {
  const normalized = normalizeDraft(draft);
  const previewDraft = isKebabCaseId(normalized.id) ? normalized : { ...normalized, id: `preview-${id}` };
  return { storageKey: previewStorageKey(id), payload: { draft: previewDraft, createdAt: now() }, url: `/index.html?previewTilemapKey=${encodeURIComponent(id)}&autorun=1&mode=developer` };
}

export function savedLocalStatus(draft) {
  const warning = !hasEntitySymbol(draft, 'P') ? ' Add Player P before playing.' : (!hasEntitySymbol(draft, 'G') ? ' No finish gate yet.' : ' Ready to play from Level Select.');
  return { message: `Saved locally as ${draft.id}.${warning}`, kind: hasEntitySymbol(draft, 'P') ? 'ok' : '' };
}
