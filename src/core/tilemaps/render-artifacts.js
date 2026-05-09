import { terrainKindConfig } from './terrain-layer.js';
import { TERRAIN_MASK, normalizeTerrainMask } from './terrain-mask.js';
import { terrainCellAt } from './terrain-model.js';

function terrainVisuallyConnects(scene, source, col, row) {
  const neighbor = terrainCellAt(scene, col, row);
  if (!neighbor) return false;
  const config = terrainKindConfig(source.kind);
  return Boolean(config?.connectsTo?.includes(neighbor.kind));
}

function buildVisualNeighborMask(scene, cell) {
  let mask = 0;
  const bit = (dx, dy, value) => terrainVisuallyConnects(scene, cell, cell.col + dx, cell.row + dy) ? value : 0;
  mask |= bit(0, -1, TERRAIN_MASK.N);
  mask |= bit(1, -1, TERRAIN_MASK.NE);
  mask |= bit(1, 0, TERRAIN_MASK.E);
  mask |= bit(1, 1, TERRAIN_MASK.SE);
  mask |= bit(0, 1, TERRAIN_MASK.S);
  mask |= bit(-1, 1, TERRAIN_MASK.SW);
  mask |= bit(-1, 0, TERRAIN_MASK.W);
  mask |= bit(-1, -1, TERRAIN_MASK.NW);
  return mask;
}

export function buildContainedTerrainTiles(scene) {
  return (scene.terrain?.cells ?? [])
    .filter(cell => terrainKindConfig(cell.kind)?.visible)
    .map(cell => {
      const rawMask = buildVisualNeighborMask(scene, cell);
      return { layer: 'terrain', x: cell.x, y: cell.y, w: cell.w, h: cell.h, col: cell.col, row: cell.row, kind: cell.kind, rawMask, mask: normalizeTerrainMask(rawMask) };
    });
}
