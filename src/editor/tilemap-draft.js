import { CELL_SIZE } from '../core/constants.js';
import { defineTilemap, gridLayer } from '../core/tilemaps/tilemap.js';
import { terrainLayer } from '../core/tilemaps/terrain-layer.js';
import { finishGateObject, playerSpawner, slimeSpawner } from '../content/tilemaps/objects.js';

export const EMPTY = '.';

export const SYMBOLS = {
  entities: { P: playerSpawner, E: slimeSpawner, G: finishGateObject }
};

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
      { id: 'entities', cellSize: CELL_SIZE.GRID, rows: Array.from({ length: rows }, () => lineOf(cols)) }
    ]
  };
}

export function createDraftFromTilemap(tilemap, savedDraft = null) {
  if (savedDraft) return savedDraft;
  return {
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
  };
}

export function toDefinition(draft) {
  return {
    ...draft,
    layers: draft.layers.map(layer => layer.type === 'terrain' || layer.id === 'terrain'
      ? terrainLayer({ id: 'terrain', cellSize: layer.cellSize, rows: layer.rows })
      : gridLayer({
        id: layer.id,
        cellSize: layer.cellSize,
        symbols: SYMBOLS[layer.id] ?? {},
        rows: layer.rows
      }))
  };
}

export function compileDraft(draft) {
  return defineTilemap(toDefinition(draft));
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
