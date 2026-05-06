export const CELL_SIZE = Object.freeze({
  GRID: 32,
  BUILD: 16,
  TERRAIN_PRIMITIVE: 8
});
export const GRID_SIZE = CELL_SIZE.GRID;
export const BUILD_TILE_SIZE = CELL_SIZE.BUILD;
export const TERRAIN_PRIMITIVE_SIZE = CELL_SIZE.TERRAIN_PRIMITIVE;
export const ACTOR_SIZE = Object.freeze({
  PLAYER: Object.freeze({ w: 30, h: 44 }),
  SLIME: Object.freeze({ w: 37, h: 34 })
});
/**
 * @deprecated TODO(new-terrain): use GRID_SIZE/CELL_SIZE.GRID; delete after legacy terrain naming is removed.
 */
export const TILE_SIZE = GRID_SIZE;
export const WORLD_COLS = 18;
export const WORLD_ROWS = 10;
export const WORLD_WIDTH = WORLD_COLS * GRID_SIZE;
export const WORLD_HEIGHT = WORLD_ROWS * GRID_SIZE;
export const CAMERA_WIDTH = 320;
export const CAMERA_HEIGHT = 180;
// Keep camera zoom aligned to the terrain pixel grid.
// Fractional terrain scaling creates visible seams between adjacent canvas drawImage calls.
export const CAMERA_ZOOM = 0.5;
export const CAMERA_WORLD_WIDTH = CAMERA_WIDTH / CAMERA_ZOOM;
export const CAMERA_WORLD_HEIGHT = CAMERA_HEIGHT / CAMERA_ZOOM;
export const PIXEL_PERFECT = false;
export const DEBUG_CAMERA = false;
export const RESIZE_DEBOUNCE_MS = 280;
