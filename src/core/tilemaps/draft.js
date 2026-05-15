import { CELL_SIZE } from '../constants.js';
import { TERRAIN_KIND, terrainLayer } from './terrain-layer.js';

export const EMPTY = '.';

export function layerCols(cols, cellSize) { return cols * CELL_SIZE.GRID / cellSize; }
export function layerRows(rows, cellSize) { return rows * CELL_SIZE.GRID / cellSize; }
export function lineOf(width, symbol = EMPTY) { return symbol.repeat(width); }
export function terrainLineOf(width, kind = null) { return Array.from({ length: width }, () => kind); }
export function replaceChar(line, index, char) { return `${line.slice(0, index)}${char}${line.slice(index + 1)}`; }

export function createBlankDraft({ id = 'new-tilemap', name = 'New Tilemap', cols = 18, rows = 10 } = {}) {
  return {
    id,
    name,
    cols,
    rows,
    artTileSize: CELL_SIZE.BUILD,
    terrainRenderMode: 'contained-autotile',
    theme: 'kenney-pixel-platformer:grass',
    visibility: 'public',
    categories: ['local'],
    description: 'Draft tilemap authored in the browser editor.',
    layers: [
      terrainLayer({ rows: Array.from({ length: layerRows(rows, CELL_SIZE.BUILD) }, () => terrainLineOf(layerCols(cols, CELL_SIZE.BUILD))) }),
      { id: 'entities', cellSize: CELL_SIZE.GRID, rows: Array.from({ length: rows }, () => lineOf(cols)) },
      { id: 'hazards', cellSize: CELL_SIZE.BUILD, rows: Array.from({ length: layerRows(rows, CELL_SIZE.BUILD) }, () => lineOf(layerCols(cols, CELL_SIZE.BUILD))) }
    ]
  };
}

function legacyTerrainRows(rows) {
  return rows.map(row => Array.isArray(row)
    ? row.map(cell => cell === '#' ? TERRAIN_KIND.GRASS : (cell === '.' ? null : cell))
    : [...row].map(symbol => symbol === '#' ? TERRAIN_KIND.GRASS : null));
}

export function normalizeDraft(draft) {
  if (!draft || typeof draft !== 'object' || !Array.isArray(draft.layers)) return draft;
  const layers = [];
  const hasModernTerrain = draft.layers.some(layer => layer.id === 'terrain' && layer.type === 'terrain');
  let migratedTerrain = false;
  for (const layer of draft.layers) {
    if (layer.id === 'buildTerrain') {
      if (!hasModernTerrain && !migratedTerrain) {
        layers.push({ id: 'terrain', type: 'terrain', cellSize: CELL_SIZE.BUILD, rows: legacyTerrainRows(layer.rows ?? []) });
        migratedTerrain = true;
      }
      continue;
    }
    if (layer.id === 'terrain' && layer.type !== 'terrain' && layer.rows?.every(row => typeof row === 'string' || Array.isArray(row))) {
      layers.push({ id: 'terrain', type: 'terrain', cellSize: CELL_SIZE.BUILD, rows: legacyTerrainRows(layer.rows) });
      migratedTerrain = true;
      continue;
    }
    layers.push({ ...layer, rows: layer.rows?.map(row => Array.isArray(row) ? [...row] : row) });
  }
  if (!layers.some(layer => layer.id === 'hazards')) {
    const cols = draft.cols ?? 1;
    const rows = draft.rows ?? 1;
    layers.push({ id: 'hazards', cellSize: CELL_SIZE.BUILD, rows: Array.from({ length: layerRows(rows, CELL_SIZE.BUILD) }, () => lineOf(layerCols(cols, CELL_SIZE.BUILD))) });
  }
  return { ...draft, layers };
}

export function createDraftFromTilemap(tilemap, savedDraft = null) {
  if (savedDraft) return normalizeDraft(savedDraft);
  return normalizeDraft({
    id: tilemap.id,
    name: tilemap.name,
    cols: tilemap.cols,
    rows: tilemap.rows,
    artTileSize: tilemap.artTileSize ?? CELL_SIZE.BUILD,
    terrainRenderMode: tilemap.terrainRenderMode,
    theme: tilemap.theme,
    visibility: tilemap.visibility ?? 'developer',
    categories: [...(tilemap.categories ?? [])],
    description: tilemap.description ?? '',
    layers: tilemap.layers.map(layer => ({ id: layer.id, type: layer.type, cellSize: layer.cellSize, rows: layer.rows.map(row => Array.isArray(row) ? [...row] : row) }))
  });
}

export function entityLayer(draft) {
  return draft.layers.find(layer => layer.id === 'entities') ?? null;
}

export function entitySymbolCount(draft, symbol) {
  const layer = entityLayer(draft);
  return layer ? layer.rows.reduce((count, row) => count + [...row].filter(ch => ch === symbol).length, 0) : 0;
}

export function hasEntitySymbol(draft, symbol) {
  return entitySymbolCount(draft, symbol) > 0;
}
