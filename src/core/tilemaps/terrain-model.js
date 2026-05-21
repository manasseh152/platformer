import { CELL_SIZE } from '../constants.js';
import { BRUSH_TRAIT, brushTrait } from './brushes.js';
import { brushIdToTerrainKind, terrainKindConfig } from './terrain-layer.js';

export function terrainLayer(scene) { return scene.layers?.find(layer => layer.id === 'terrain' && layer.type === 'terrain') ?? null; }
export function solidLayer(scene) { return scene.layers?.find(layer => layer.id === 'solid' && layer.type === 'brush-grid') ?? null; }
export function terrainCellSize(scene) { return scene.solid?.cellSize ?? solidLayer(scene)?.cellSize ?? terrainLayer(scene)?.cellSize ?? CELL_SIZE.BUILD; }
export function terrainKey(col, row) { return `${col},${row}`; }
export function solidCellsAt(scene, col, row) { return scene.solid?.cellMap?.get(terrainKey(col, row)) ?? []; }
export function isSolidCellAt(scene, col, row) { return solidCellsAt(scene, col, row).length > 0; }
export function terrainCellAt(scene, col, row) { return solidCellsAt(scene, col, row)[0] ?? scene.terrain?.cellMap?.get(terrainKey(col, row)) ?? null; }
export function isSolidTerrainCellAt(scene, col, row) { return isSolidCellAt(scene, col, row); }

export function normalizeSolid(scene) {
  const cells = (scene.compiledTiles ?? []).filter(tile => tile.traits?.some(trait => trait.type === BRUSH_TRAIT.SOLID));
  const cellMap = new Map();
  for (const cell of cells) {
    const key = terrainKey(cell.col, cell.row);
    const list = cellMap.get(key) ?? [];
    list.push(cell);
    cellMap.set(key, list);
  }
  const layerIds = [...new Set(cells.map(cell => cell.layerId))];
  return { layerIds, cellSize: cells[0]?.w ?? CELL_SIZE.BUILD, cells, cellMap };
}

export function normalizeTerrain(scene) {
  const cells = (scene.solid?.cells ?? []).map(cell => {
    const visual = brushTrait(cell.brush, BRUSH_TRAIT.VISUAL);
    const kind = visual?.material ? brushIdToTerrainKind(visual.material) : brushIdToTerrainKind(cell.brushId);
    return { ...cell, layer: cell.layerId, kind, terrainKind: kind };
  });
  const cellMap = new Map();
  for (const cell of cells) cellMap.set(terrainKey(cell.col, cell.row), cell);
  return { layerId: 'solid', cellSize: scene.solid?.cellSize ?? CELL_SIZE.BUILD, cells, cellMap };
}

export function isVisibleSolidCell(cell) {
  const visual = brushTrait(cell.brush, BRUSH_TRAIT.VISUAL);
  return visual?.renderer === 'contained-autotile' && Boolean(visual.material);
}

export function solidCellMaterial(cell) {
  const visual = brushTrait(cell.brush, BRUSH_TRAIT.VISUAL);
  return visual?.material ?? brushIdToTerrainKind(cell.brushId);
}

export { terrainKindConfig };
