import { CELL_SIZE } from '../constants.js';

export const TERRAIN_KIND = Object.freeze({
  GRASS: 'grass',
  DIRT: 'dirt',
  STONE: 'stone',
  INVISIBLE: 'invisible'
});

export const TERRAIN_KINDS = Object.freeze({
  [TERRAIN_KIND.GRASS]: Object.freeze({
    solid: true,
    visible: true,
    connectsTo: Object.freeze([TERRAIN_KIND.GRASS]),
    palette: Object.freeze({ baseColor: '#a7643b', edgeColor: '#4f9f3a', innerCornerColor: '#3f7f36', edgeThickness: 4 })
  }),
  [TERRAIN_KIND.DIRT]: Object.freeze({
    solid: true,
    visible: true,
    connectsTo: Object.freeze([TERRAIN_KIND.DIRT]),
    palette: Object.freeze({ baseColor: '#8f5634', edgeColor: '#b86f3d', innerCornerColor: '#6f3f25', edgeThickness: 4 })
  }),
  [TERRAIN_KIND.STONE]: Object.freeze({
    solid: true,
    visible: true,
    connectsTo: Object.freeze([TERRAIN_KIND.STONE]),
    palette: Object.freeze({ baseColor: '#66717d', edgeColor: '#9aa7b2', innerCornerColor: '#4b5660', edgeThickness: 4 })
  }),
  [TERRAIN_KIND.INVISIBLE]: Object.freeze({
    solid: true,
    visible: false,
    connectsTo: Object.freeze([]),
    palette: null
  })
});

export function terrainKindConfig(kind) {
  return TERRAIN_KINDS[kind] ?? null;
}

export function isTerrainKind(kind) {
  return typeof kind === 'string' && Boolean(terrainKindConfig(kind));
}

export function terrainLayer({ id = 'terrain', cellSize = CELL_SIZE.BUILD, rows }) {
  if (id !== 'terrain') throw new Error('terrainLayer id must be terrain');
  if (cellSize !== CELL_SIZE.BUILD) throw new Error('terrain layer must use CELL_SIZE.BUILD');
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('terrain layer rows must contain at least one row');
  const width = rows[0]?.length;
  if (!Number.isInteger(width) || width < 1) throw new Error('terrain layer rows must contain at least one cell');
  rows.forEach((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== width) throw new Error(`terrain layer row ${rowIndex} must be ${width} cells wide`);
    row.forEach((kind, colIndex) => {
      if (kind !== null && !isTerrainKind(kind)) throw new Error(`terrain layer contains unknown terrain kind at ${colIndex},${rowIndex}`);
    });
  });
  return { id, type: 'terrain', cellSize, rows: rows.map(row => [...row]) };
}
