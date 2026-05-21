import { BRUSH_TRAIT, brushTrait } from './brushes.js';
import { TERRAIN_MASK, normalizeTerrainMask } from './terrain-mask.js';
import { solidCellsAt, solidCellMaterial } from './terrain-model.js';

function containedVisual(cell) {
  const visual = brushTrait(cell.brush, BRUSH_TRAIT.VISUAL);
  return visual?.renderer === 'contained-autotile' ? visual : null;
}

function materialConfig(scene, materialId) {
  return scene.materialsById?.get(materialId)?.containedAutotile ?? null;
}

function visuallyConnects(scene, source, col, row) {
  const sourceMaterial = solidCellMaterial(source);
  const config = materialConfig(scene, sourceMaterial);
  if (!config) return false;
  return solidCellsAt(scene, col, row).some(neighbor => neighbor.layerId === source.layerId && containedVisual(neighbor) && config.connectsTo?.includes(solidCellMaterial(neighbor)));
}

function buildVisualNeighborMask(scene, cell) {
  let mask = 0;
  const bit = (dx, dy, value) => visuallyConnects(scene, cell, cell.col + dx, cell.row + dy) ? value : 0;
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
  return (scene.solid?.cells ?? [])
    .filter(cell => containedVisual(cell))
    .map(cell => {
      const rawMask = buildVisualNeighborMask(scene, cell);
      const material = solidCellMaterial(cell);
      return { tileId: cell.id, layer: cell.layerId === 'solid' ? 'terrain' : cell.layerId, layerId: cell.layerId, x: cell.x, y: cell.y, w: cell.w, h: cell.h, col: cell.col, row: cell.row, kind: material, material, brushId: cell.brushId, rawMask, mask: normalizeTerrainMask(rawMask) };
    });
}
