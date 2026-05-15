import { CELL_SIZE } from '../core/constants.js';
import { TERRAIN_KIND, terrainKindConfig } from '../core/tilemaps/terrain-layer.js';
import { isKebabCaseId } from '../catalog/id.js';
import { compileDraft as compileTilemapDraft, hasEntitySymbol, normalizeDraft } from './tilemap-draft.js';

export const SHARE_FORMAT = 'chibi-tilemap-draft';
export const SHARE_VERSION = 1;
export const PREVIEW_STORAGE_PREFIX = 'chibi.tilemap-preview.';

export function readBooleanPreference(storage, key, defaultValue) {
  try {
    const value = storage.getItem(key);
    if (value === null) return defaultValue;
    return value === 'true';
  } catch { return defaultValue; }
}

export function writeBooleanPreference(storage, key, value) {
  storage.setItem(key, value ? 'true' : 'false');
}

export function previewStorageKey(id) {
  return `${PREVIEW_STORAGE_PREFIX}${id}`;
}

function serialiseRows(rows, indent = '    ') { return rows.map(row => `${indent}'${row}'`).join(',\n'); }
function serialiseTerrainRows(rows, indent = '    ') {
  const kindExpr = value => value === null ? 'null' : `K.${Object.entries(TERRAIN_KIND).find(([, kind]) => kind === value)?.[0] ?? 'GRASS'}`;
  return rows.map(row => `${indent}[${row.map(kindExpr).join(', ')}]`).join(',\n');
}
function camelIdentifier(id) {
  const value = id.replace(/[^a-zA-Z0-9]+(.)/g, (_, ch) => ch.toUpperCase()).replace(/^[^a-zA-Z_$]+/, '');
  return value ? `${value}Tilemap` : 'draftTilemap';
}
function escapeJs(value) { return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function cloneDraft(value) { return JSON.parse(JSON.stringify(value)); }

export function generatedTilemapModule(draft) {
  draft = normalizeDraft(draft);
  const terrain = draft.layers.find(layer => layer.id === 'terrain');
  const entities = draft.layers.find(layer => layer.id === 'entities');
  const hazards = draft.layers.find(layer => layer.id === 'hazards');
  const categories = JSON.stringify(draft.categories ?? ['drafts']);
  return `import { CELL_SIZE } from '../../../core/constants.js';
import { defineTilemap, gridLayer } from '../../../core/tilemaps/tilemap.js';
import { TERRAIN_KIND as K, terrainLayer } from '../../../core/tilemaps/terrain-layer.js';
import { finishGateObject, playerSpawner, slimeSpawner, spikeHazard } from '../objects.js';

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
    terrainLayer({ cellSize: CELL_SIZE.BUILD, rows: [
${serialiseTerrainRows(terrain.rows, '      ')}
    ] }),
    gridLayer({ id: 'entities', cellSize: CELL_SIZE.GRID, symbols: { P: playerSpawner, E: slimeSpawner, G: finishGateObject }, rows: [
${serialiseRows(entities.rows, '      ')}
    ] }),
    gridLayer({ id: 'hazards', cellSize: CELL_SIZE.BUILD, symbols: { '^': spikeHazard }, rows: [
${serialiseRows(hazards.rows, '      ')}
    ] })
  ]
});
`;
}

export function createSharePayload(draft, { now = () => new Date() } = {}) {
  return { format: SHARE_FORMAT, version: SHARE_VERSION, exportedAt: now().toISOString(), draft: cloneDraft(draft) };
}

function validateLayerRows(layer, expectedCols, expectedRows, label) {
  if (!Number.isInteger(layer.cellSize) || layer.cellSize < 1) throw new Error(`${label} has an invalid cell size.`);
  if (!Number.isInteger(expectedCols) || !Number.isInteger(expectedRows)) throw new Error(`${label} dimensions do not line up with the map grid.`);
  if (!Array.isArray(layer.rows) || layer.rows.length !== expectedRows) throw new Error(`${label} must have ${expectedRows} rows.`);
  if (label === 'terrain') {
    if (!layer.rows.every(row => Array.isArray(row) && row.length === expectedCols && row.every(cell => cell === null || terrainKindConfig(cell)))) throw new Error(`${label} rows must be ${expectedCols} terrain cells wide.`);
  } else if (!layer.rows.every(row => typeof row === 'string' && row.length === expectedCols)) throw new Error(`${label} rows must be ${expectedCols} cells wide.`);
}

export function validateImportedDraft(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Imported map is not a tilemap draft.');
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) throw new Error('Imported map needs an id.');
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) throw new Error('Imported map needs a name.');
  if (!Number.isInteger(candidate.cols) || candidate.cols < 1 || candidate.cols > 120) throw new Error('Imported map cols must be between 1 and 120.');
  if (!Number.isInteger(candidate.rows) || candidate.rows < 1 || candidate.rows > 80) throw new Error('Imported map rows must be between 1 and 80.');
  const terrain = candidate.layers?.find(layer => layer.id === 'terrain');
  const entities = candidate.layers?.find(layer => layer.id === 'entities');
  const hazards = candidate.layers?.find(layer => layer.id === 'hazards');
  if (!terrain || !entities) throw new Error('Imported map needs terrain and entities layers.');
  validateLayerRows(terrain, candidate.cols * CELL_SIZE.GRID / terrain.cellSize, candidate.rows * CELL_SIZE.GRID / terrain.cellSize, 'terrain');
  validateLayerRows(entities, candidate.cols, candidate.rows, 'entities');
  if (hazards) validateLayerRows(hazards, candidate.cols * CELL_SIZE.GRID / hazards.cellSize, candidate.rows * CELL_SIZE.GRID / hazards.cellSize, 'hazards');
  compileTilemapDraft(candidate);
}

export function draftFromSharePayload(payload) {
  const candidate = normalizeDraft(payload?.format === SHARE_FORMAT ? payload.draft : payload);
  validateImportedDraft(candidate);
  return cloneDraft(candidate);
}

export function createPreviewPayload(draft, { id, now = () => Date.now() }) {
  const previewDraft = isKebabCaseId(draft.id) ? draft : { ...draft, id: `preview-${id}` };
  return {
    storageKey: previewStorageKey(id),
    payload: { draft: previewDraft, createdAt: now() },
    url: `/index.html?previewTilemapKey=${encodeURIComponent(id)}&autorun=1&mode=developer`
  };
}

export function savedLocalStatus(draft) {
  const warning = !hasEntitySymbol(draft, 'P') ? ' Add Player P before playing.' : (!hasEntitySymbol(draft, 'G') ? ' No finish gate yet.' : ' Ready to play from Level Select.');
  return { message: `Saved locally as ${draft.id}.${warning}`, kind: hasEntitySymbol(draft, 'P') ? 'ok' : '' };
}
