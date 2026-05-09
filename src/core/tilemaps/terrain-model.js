import { CELL_SIZE } from '../constants.js';
import { terrainKindConfig } from './terrain-layer.js';

export function terrainLayer(scene) { return scene.layers?.find(layer => layer.id === 'terrain' && layer.type === 'terrain') ?? null; }
export function terrainCellSize(scene) { return terrainLayer(scene)?.cellSize ?? CELL_SIZE.BUILD; }
export function terrainKey(col, row) { return `${col},${row}`; }
export function terrainCellAt(scene, col, row) { return scene.terrain?.cellMap?.get(terrainKey(col, row)) ?? null; }
export function isSolidTerrainCellAt(scene, col, row) { const cell = terrainCellAt(scene, col, row); return Boolean(cell && terrainKindConfig(cell.kind)?.solid); }

export function normalizeTerrain(scene) {
  const layer = terrainLayer(scene);
  const cellSize = layer.cellSize;
  const cells = [];
  const cellMap = new Map();
  layer.rows.forEach((line, row) => line.forEach((kind, col) => {
    if (kind === null) return;
    const cell = { layer: 'terrain', col, row, x: col * cellSize, y: row * cellSize, w: cellSize, h: cellSize, kind };
    cells.push(cell);
    cellMap.set(terrainKey(col, row), cell);
  }));
  return { layerId: 'terrain', cellSize, cells, cellMap };
}
