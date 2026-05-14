import { CELL_SIZE } from '../core/constants.js';
import { terrainKindConfig } from '../core/tilemaps/terrain-layer.js';
import { TERRAIN_MASK } from '../core/tilemaps/terrain-mask.js';

export const CONTAINED_TERRAIN_DRAW_ORDER = ['base', 'edge', 'outer-corner', 'inner-corner', 'detail'];

const DEFAULT_VARIANT = Object.freeze({
  baseColor: '#a7643b',
  edgeColor: '#4f9f3a',
  innerCornerColor: '#3f7f36',
  edgeThickness: 4
});

const { N, NE, E, SE, S, SW, W, NW } = TERRAIN_MASK;

function has(mask, bit) { return (mask & bit) !== 0; }
function exposed(mask, bit) { return !has(mask, bit); }

export function selectTerrainVisualVariant(tile, _salt = 0) {
  return { ...DEFAULT_VARIANT, ...(terrainKindConfig(tile?.kind)?.visual ?? {}) };
}

function assertContainedTerrainTile(tile) {
  if (tile.w !== CELL_SIZE.BUILD || tile.h !== CELL_SIZE.BUILD) {
    throw new Error(`Contained terrain visual tile must be ${CELL_SIZE.BUILD}×${CELL_SIZE.BUILD}`);
  }
}

function assertPrimitiveInsideTile(tile, primitive) {
  const right = primitive.x + primitive.w;
  const bottom = primitive.y + primitive.h;
  if (primitive.x < tile.x || primitive.y < tile.y || right > tile.x + tile.w || bottom > tile.y + tile.h) {
    throw new Error(`Contained terrain primitive ${primitive.kind} exceeds its authored cell`);
  }
}

function rect(kind, tile, x, y, w, h, extra = {}) {
  return { kind, x: tile.x + x, y: tile.y + y, w, h, ...extra };
}

export function planContainedTerrainTileVisuals(tile, options = {}) {
  assertContainedTerrainTile(tile);
  const variant = options.variant ?? selectTerrainVisualVariant(tile, options.salt ?? 0);
  const t = variant.edgeThickness;
  const mask = tile.mask ?? 0;
  const primitives = [rect('base', tile, 0, 0, tile.w, tile.h, { color: variant.baseColor })];

  if (exposed(mask, N)) primitives.push(rect('edge', tile, 0, 0, tile.w, t, { side: 'top', color: variant.edgeColor }));
  if (exposed(mask, E)) primitives.push(rect('edge', tile, tile.w - t, 0, t, tile.h, { side: 'right', color: variant.edgeColor }));
  if (exposed(mask, S)) primitives.push(rect('edge', tile, 0, tile.h - t, tile.w, t, { side: 'bottom', color: variant.edgeColor }));
  if (exposed(mask, W)) primitives.push(rect('edge', tile, 0, 0, t, tile.h, { side: 'left', color: variant.edgeColor }));

  if (exposed(mask, N) && exposed(mask, W)) primitives.push(rect('outer-corner', tile, 0, 0, t, t, { corner: 'top-left', color: variant.edgeColor }));
  if (exposed(mask, N) && exposed(mask, E)) primitives.push(rect('outer-corner', tile, tile.w - t, 0, t, t, { corner: 'top-right', color: variant.edgeColor }));
  if (exposed(mask, S) && exposed(mask, E)) primitives.push(rect('outer-corner', tile, tile.w - t, tile.h - t, t, t, { corner: 'bottom-right', color: variant.edgeColor }));
  if (exposed(mask, S) && exposed(mask, W)) primitives.push(rect('outer-corner', tile, 0, tile.h - t, t, t, { corner: 'bottom-left', color: variant.edgeColor }));

  if (has(mask, N) && has(mask, W) && !has(mask, NW)) primitives.push(rect('inner-corner', tile, 0, 0, t, t, { corner: 'top-left', color: variant.innerCornerColor }));
  if (has(mask, N) && has(mask, E) && !has(mask, NE)) primitives.push(rect('inner-corner', tile, tile.w - t, 0, t, t, { corner: 'top-right', color: variant.innerCornerColor }));
  if (has(mask, S) && has(mask, E) && !has(mask, SE)) primitives.push(rect('inner-corner', tile, tile.w - t, tile.h - t, t, t, { corner: 'bottom-right', color: variant.innerCornerColor }));
  if (has(mask, S) && has(mask, W) && !has(mask, SW)) primitives.push(rect('inner-corner', tile, 0, tile.h - t, t, t, { corner: 'bottom-left', color: variant.innerCornerColor }));

  for (const primitive of primitives) assertPrimitiveInsideTile(tile, primitive);
  return primitives;
}
