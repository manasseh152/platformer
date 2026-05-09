import { TERRAIN_PRIMITIVE_SIZE } from '../constants.js';
import { terrainKindConfig } from './terrain-layer.js';
import { terrainKey } from './terrain-model.js';

export function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

function clippedWorldRect(rect, scene) {
  const x = Math.max(0, rect.x);
  const y = Math.max(0, rect.y);
  const right = Math.min(scene.worldWidth, rect.x + rect.w);
  const bottom = Math.min(scene.worldHeight, rect.y + rect.h);
  return right <= x || bottom <= y ? null : { ...rect, x, y, w: right - x, h: bottom - y };
}

function greedyMergeAabbs2D(width, height, isSolid) {
  const visited = new Uint8Array(width * height);
  const boxes = [];
  const index = (x, y) => y * width + x;
  const canUse = (x, y) => x >= 0 && x < width && y >= 0 && y < height && visited[index(x, y)] === 0 && isSolid(x, y);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!canUse(x, y)) continue;
    let boxWidth = 1;
    while (canUse(x + boxWidth, y)) boxWidth++;
    let boxHeight = 1;
    while (y + boxHeight < height) {
      let rowMatches = true;
      for (let xx = x; xx < x + boxWidth; xx++) if (!canUse(xx, y + boxHeight)) { rowMatches = false; break; }
      if (!rowMatches) break;
      boxHeight++;
    }
    for (let yy = y; yy < y + boxHeight; yy++) for (let xx = x; xx < x + boxWidth; xx++) visited[index(xx, yy)] = 1;
    boxes.push({ x, y, w: boxWidth, h: boxHeight });
  }
  return boxes;
}

function buildContainedTerrainCollisionPrimitives(scene) {
  const primitives = [];
  for (const cell of scene.terrain?.cells ?? []) {
    if (!terrainKindConfig(cell.kind)?.solid) continue;
    const startCol = Math.floor(cell.x / TERRAIN_PRIMITIVE_SIZE);
    const startRow = Math.floor(cell.y / TERRAIN_PRIMITIVE_SIZE);
    const primitiveCols = cell.w / TERRAIN_PRIMITIVE_SIZE;
    const primitiveRows = cell.h / TERRAIN_PRIMITIVE_SIZE;
    for (let row = 0; row < primitiveRows; row++) for (let col = 0; col < primitiveCols; col++) {
      primitives.push({ x: (startCol + col) * TERRAIN_PRIMITIVE_SIZE, y: (startRow + row) * TERRAIN_PRIMITIVE_SIZE, w: TERRAIN_PRIMITIVE_SIZE, h: TERRAIN_PRIMITIVE_SIZE, col: startCol + col, row: startRow + row, kind: 'terrain-primitive', terrainKind: cell.kind });
    }
  }
  return primitives;
}

export function buildContainedTerrainCollisionLayers(scene) {
  const terrainPrimitives = buildContainedTerrainCollisionPrimitives(scene);
  const solids = new Set(terrainPrimitives.map(cell => terrainKey(cell.col, cell.row)));
  const cols = Math.floor(scene.worldWidth / TERRAIN_PRIMITIVE_SIZE);
  const rows = Math.floor(scene.worldHeight / TERRAIN_PRIMITIVE_SIZE);
  return {
    terrainPrimitives,
    terrainRects: greedyMergeAabbs2D(cols, rows, (col, row) => solids.has(terrainKey(col, row)))
      .map(box => clippedWorldRect({ x: box.x * TERRAIN_PRIMITIVE_SIZE, y: box.y * TERRAIN_PRIMITIVE_SIZE, w: box.w * TERRAIN_PRIMITIVE_SIZE, h: box.h * TERRAIN_PRIMITIVE_SIZE, col: box.x, row: box.y, cols: box.w, rows: box.h, kind: 'terrain-solid' }, scene))
      .filter(Boolean)
  };
}
