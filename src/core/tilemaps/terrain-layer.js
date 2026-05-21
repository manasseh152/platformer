import { CELL_SIZE } from '../constants.js';
import { solidLayer } from './layers.js';

export const TERRAIN_KIND = Object.freeze({
  GRASS: 'grass',
  DIRT: 'dirt',
  STONE: 'stone',
  SAND: 'sand',
  LOG: 'log',
  LEAVES: 'leaves',
  INVISIBLE: 'invisible'
});

export const TERRAIN_KINDS = Object.freeze({
  [TERRAIN_KIND.GRASS]: Object.freeze({
    solid: true,
    visible: true,
    connectsTo: Object.freeze([TERRAIN_KIND.GRASS]),
    visual: Object.freeze({ baseColor: '#a7643b', edgeColor: '#4f9f3a', innerCornerColor: '#3f7f36', edgeThickness: 4 })
  }),
  [TERRAIN_KIND.DIRT]: Object.freeze({
    solid: true,
    visible: true,
    connectsTo: Object.freeze([TERRAIN_KIND.DIRT]),
    visual: Object.freeze({ baseColor: '#8f5634', edgeColor: '#b86f3d', innerCornerColor: '#6f3f25', edgeThickness: 4 })
  }),
  [TERRAIN_KIND.STONE]: Object.freeze({
    solid: true,
    visible: true,
    connectsTo: Object.freeze([TERRAIN_KIND.STONE]),
    visual: Object.freeze({ baseColor: '#66717d', edgeColor: '#9aa7b2', innerCornerColor: '#4b5660', edgeThickness: 4 })
  }),
  [TERRAIN_KIND.SAND]: Object.freeze({
    solid: true,
    visible: true,
    connectsTo: Object.freeze([TERRAIN_KIND.SAND]),
    visual: Object.freeze({ baseColor: '#d9b86f', edgeColor: '#f0d58a', innerCornerColor: '#b8914d', edgeThickness: 4 })
  }),
  [TERRAIN_KIND.LOG]: Object.freeze({
    solid: true,
    visible: true,
    connectsTo: Object.freeze([TERRAIN_KIND.LOG]),
    visual: Object.freeze({ baseColor: '#7a4a2a', edgeColor: '#a66a3f', innerCornerColor: '#4f2f1d', edgeThickness: 4 })
  }),
  [TERRAIN_KIND.LEAVES]: Object.freeze({
    solid: true,
    visible: true,
    connectsTo: Object.freeze([TERRAIN_KIND.LEAVES]),
    visual: Object.freeze({ baseColor: '#3f8f4c', edgeColor: '#62bd63', innerCornerColor: '#2e6538', edgeThickness: 4 })
  }),
  [TERRAIN_KIND.INVISIBLE]: Object.freeze({
    solid: true,
    visible: false,
    connectsTo: Object.freeze([]),
    visual: null
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

export function terrainKindToBrushId(kind) { return kind === TERRAIN_KIND.INVISIBLE ? 'invisible-solid' : kind; }
export function brushIdToTerrainKind(brushId) { return brushId === 'invisible-solid' ? TERRAIN_KIND.INVISIBLE : brushId; }
export function legacyTerrainLayerToSolid(layer) { return solidLayer({ rows: layer.rows.map(row => row.map(terrainKindToBrushId)), cellSize: layer.cellSize ?? CELL_SIZE.BUILD }); }
