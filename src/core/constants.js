export const TILE_SIZE = 36;
export const WORLD_COLS = 18;
export const WORLD_ROWS = 10;
export const WORLD_WIDTH = WORLD_COLS * TILE_SIZE;
export const WORLD_HEIGHT = WORLD_ROWS * TILE_SIZE;
export const CAMERA_WIDTH = 480;
export const CAMERA_HEIGHT = 270;
// Keep the camera zoom aligned to the 18px Kenney art grid.
// Fractional art-tile scaling (for example 18 * 0.65 = 11.7px) creates visible seams
// between adjacent canvas drawImage calls in the live WebGL-presented game.
export const CAMERA_ZOOM = 0.5;
export const CAMERA_WORLD_WIDTH = CAMERA_WIDTH / CAMERA_ZOOM;
export const CAMERA_WORLD_HEIGHT = CAMERA_HEIGHT / CAMERA_ZOOM;
export const PIXEL_PERFECT = false;
export const DEBUG_CAMERA = false;
export const RESIZE_DEBOUNCE_MS = 280;
