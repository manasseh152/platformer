import { CELL_SIZE } from '../constants.js';
import { TERRAIN_KIND, terrainKindToBrushId } from './terrain-layer.js';
import { brushGridLayer, placedAssetsLayer, solidLayer } from './layers.js';

export const EMPTY = '.';
export const DRAFT_SCHEMA_VERSION = 2;

export function layerCols(cols, cellSize) { return cols * CELL_SIZE.GRID / cellSize; }
export function layerRows(rows, cellSize) { return rows * CELL_SIZE.GRID / cellSize; }
export function lineOf(width, symbol = EMPTY) { return symbol.repeat(width); }
export function terrainLineOf(width, kind = null) { return Array.from({ length: width }, () => kind); }
export function brushLineOf(width, brushId = null) { return Array.from({ length: width }, () => brushId); }
export function replaceChar(line, index, char) { return `${line.slice(0, index)}${char}${line.slice(index + 1)}`; }

export function createBlankDraft({ id = 'new-tilemap', name = 'New Tilemap', cols = 18, rows = 10 } = {}) {
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    id,
    name,
    cols,
    rows,
    artTileSize: CELL_SIZE.BUILD,
    theme: 'kenney-pixel-platformer:grass',
    visibility: 'public',
    categories: ['local'],
    description: 'Draft tilemap authored in the browser editor.',
    layers: [
      solidLayer({ rows: Array.from({ length: layerRows(rows, CELL_SIZE.BUILD) }, () => brushLineOf(layerCols(cols, CELL_SIZE.BUILD))) }),
      placedAssetsLayer({ rows: Array.from({ length: layerRows(rows, CELL_SIZE.BUILD) }, () => lineOf(layerCols(cols, CELL_SIZE.BUILD))) }),
      brushGridLayer({ id: 'hazards', cellSize: CELL_SIZE.BUILD, accepts: ['visual', 'hazard'], z: 5, rows: Array.from({ length: layerRows(rows, CELL_SIZE.BUILD) }, () => brushLineOf(layerCols(cols, CELL_SIZE.BUILD))) })
    ]
  };
}

function legacyTerrainRows(rows) {
  return rows.map(row => Array.isArray(row)
    ? row.map(cell => cell === '#' ? 'grass' : (cell === '.' ? null : terrainKindToBrushId(cell)))
    : [...row].map(symbol => symbol === '#' ? 'grass' : null));
}

function legacyHazardRows(rows) {
  return (rows ?? []).map(row => typeof row === 'string'
    ? [...row].map(symbol => symbol === '^' ? 'spike-floor' : null)
    : row.map(cell => cell === '^' ? 'spike-floor' : cell));
}

function normalizePlacedAssetsLayer(layer) {
  const cellSize = layer.cellSize ?? CELL_SIZE.GRID;
  const rows = layer.rows ?? [];
  const normalizedRows = rows.map(row => Array.isArray(row) ? row.join('') : row);
  if (cellSize === CELL_SIZE.BUILD) return { ...layer, id: 'placedAssets', type: 'placed-assets', cellSize, objectSize: layer.objectSize ?? CELL_SIZE.GRID, rows: normalizedRows };
  const scale = cellSize / CELL_SIZE.BUILD;
  if (!Number.isInteger(scale) || scale < 1) return { ...layer, id: 'placedAssets', type: 'placed-assets', objectSize: layer.objectSize ?? CELL_SIZE.GRID, rows: normalizedRows };
  const sourceWidth = normalizedRows[0]?.length ?? 0;
  const outputRows = Array.from({ length: normalizedRows.length * scale }, () => lineOf(sourceWidth * scale));
  normalizedRows.forEach((row, rowIndex) => {
    [...row].forEach((symbol, colIndex) => {
      if (symbol !== EMPTY) outputRows[rowIndex * scale + scale - 1] = replaceChar(outputRows[rowIndex * scale + scale - 1], colIndex * scale, symbol);
    });
  });
  return { ...layer, id: 'placedAssets', type: 'placed-assets', cellSize: CELL_SIZE.BUILD, objectSize: layer.objectSize ?? cellSize, rows: outputRows };
}

export function normalizeDraft(draft) {
  if (!draft || typeof draft !== 'object' || !Array.isArray(draft.layers)) return draft;
  const layers = [];
  const hasSolid = draft.layers.some(layer => layer.id === 'solid' && layer.type === 'brush-grid');
  let migratedSolid = false;
  for (const layer of draft.layers) {
    if (layer.id === 'buildTerrain') {
      if (!hasSolid && !migratedSolid) {
        layers.push(solidLayer({ rows: legacyTerrainRows(layer.rows ?? []) }));
        migratedSolid = true;
      }
      continue;
    }
    if ((layer.id === 'terrain' || layer.type === 'terrain') && !hasSolid && !migratedSolid) {
      layers.push(solidLayer({ cellSize: layer.cellSize ?? CELL_SIZE.BUILD, rows: legacyTerrainRows(layer.rows ?? []) }));
      migratedSolid = true;
      continue;
    }
    if (layer.id === 'solid') {
      layers.push({ ...layer, type: 'brush-grid', accepts: layer.accepts ?? ['visual', 'solid'], z: layer.z ?? 0, rows: layer.rows?.map(row => [...row]) });
      continue;
    }
    if (layer.id === 'entities' || layer.id === 'placedAssets') {
      layers.push(normalizePlacedAssetsLayer(layer));
      continue;
    }
    if (layer.id === 'hazards' && layer.type !== 'brush-grid') {
      layers.push(brushGridLayer({ id: 'hazards', cellSize: layer.cellSize ?? CELL_SIZE.BUILD, accepts: ['visual', 'hazard'], z: layer.z ?? 5, rows: legacyHazardRows(layer.rows) }));
      continue;
    }
    layers.push({ ...layer, rows: layer.rows?.map(row => Array.isArray(row) ? [...row] : row) });
  }
  const cols = draft.cols ?? 1;
  const rows = draft.rows ?? 1;
  if (!layers.some(layer => layer.id === 'solid')) layers.unshift(solidLayer({ rows: Array.from({ length: layerRows(rows, CELL_SIZE.BUILD) }, () => brushLineOf(layerCols(cols, CELL_SIZE.BUILD))) }));
  if (!layers.some(layer => layer.id === 'placedAssets')) layers.push(placedAssetsLayer({ rows: Array.from({ length: layerRows(rows, CELL_SIZE.BUILD) }, () => lineOf(layerCols(cols, CELL_SIZE.BUILD))) }));
  if (!layers.some(layer => layer.id === 'hazards')) layers.push(brushGridLayer({ id: 'hazards', cellSize: CELL_SIZE.BUILD, accepts: ['visual', 'hazard'], z: 5, rows: Array.from({ length: layerRows(rows, CELL_SIZE.BUILD) }, () => brushLineOf(layerCols(cols, CELL_SIZE.BUILD))) }));
  const { terrainRenderMode, ...rest } = draft;
  return { ...rest, schemaVersion: DRAFT_SCHEMA_VERSION, layers };
}

export function createDraftFromTilemap(tilemap, savedDraft = null) {
  if (savedDraft) return normalizeDraft(savedDraft);
  return normalizeDraft({
    schemaVersion: DRAFT_SCHEMA_VERSION,
    id: tilemap.id,
    name: tilemap.name,
    cols: tilemap.cols,
    rows: tilemap.rows,
    artTileSize: tilemap.artTileSize ?? CELL_SIZE.BUILD,
    theme: tilemap.theme,
    visibility: tilemap.visibility ?? 'developer',
    categories: [...(tilemap.categories ?? [])],
    description: tilemap.description ?? '',
    layers: tilemap.layers.map(layer => ({ id: layer.id, type: layer.type, cellSize: layer.cellSize, objectSize: layer.objectSize, accepts: layer.accepts, z: layer.z, rows: layer.rows.map(row => Array.isArray(row) ? [...row] : row) }))
  });
}

export function entityLayer(draft) { return draft.layers.find(layer => layer.id === 'placedAssets' || layer.id === 'entities') ?? null; }
export function entitySymbolCount(draft, symbol) {
  const layer = entityLayer(draft);
  return layer ? layer.rows.reduce((count, row) => count + [...row].filter(ch => ch === symbol).length, 0) : 0;
}
export function hasEntitySymbol(draft, symbol) { return entitySymbolCount(draft, symbol) > 0; }
