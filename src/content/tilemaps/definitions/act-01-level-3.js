import { CELL_SIZE } from '../../../core/constants.js';
import { defineTilemap, gridLayer } from '../../../core/tilemaps/tilemap.js';
import { TERRAIN_KIND as K, terrainLayer } from '../../../core/tilemaps/terrain-layer.js';
import { finishGateObject, playerSpawner, slimeSpawner } from '../objects.js';

const BUILD_COLS = 80;
const BUILD_ROWS = 48;

function createTerrainRows() {
  const rows = Array.from({ length: BUILD_ROWS }, () => Array.from({ length: BUILD_COLS }, () => null));

  function fillRect(x, y, w, h, kind = K.STONE) {
    for (let row = y; row < y + h; row += 1) {
      for (let col = x; col < x + w; col += 1) {
        if (row >= 0 && row < BUILD_ROWS && col >= 0 && col < BUILD_COLS) rows[row][col] = kind;
      }
    }
  }

  function platform(x, y, w, depth = 2) {
    fillRect(x, y, w, 1, K.GRASS);
    if (depth > 1) fillRect(x + 1, y + 1, Math.max(0, w - 2), depth - 1, K.DIRT);
  }

  function stonePlatform(x, y, w, depth = 2) {
    fillRect(x, y, w, depth, K.STONE);
  }

  // Tutorial ascent from the starting basin into the vertical climb.
  platform(6, 42, 8, 3);
  stonePlatform(10, 44, 4, 2);
  platform(30, 40, 10, 3);
  stonePlatform(34, 43, 4, 2);
  platform(4, 34, 8, 3);
  stonePlatform(8, 37, 4, 2);
  platform(86 - 43, 34, 8, 3);
  stonePlatform(46, 37, 6, 2);

  // Mid-map stepping stones and enemy perches.
  platform(38, 12, 6, 2);
  platform(52, 14, 6, 2);
  stonePlatform(44, 16, 4, 3);
  stonePlatform(62, 15, 3, 13);
  platform(73, 12, 7, 3);

  platform(4, 10, 4, 3);
  platform(28, 50 - 16, 8, 3);
  stonePlatform(34, 37, 4, 2);
  platform(56, 60 - 18, 8, 3);

  // Climb wall on the right with small ledges leading to the gate.
  fillRect(79, 20, 1, 28, K.STONE);
  platform(69, 38, 4, 2);
  stonePlatform(70, 40, 3, 2);
  platform(60, 44, 4, 2);
  stonePlatform(61, 46, 2, 1);
  platform(76, 34, 3, 2);
  stonePlatform(77, 36, 3, 2);

  // Gate chamber and invisible safety lip copied from the editor draft intent.
  fillRect(41, 0, 20, 1, K.INVISIBLE);
  fillRect(62, 0, 4, 1, K.STONE);
  fillRect(62, 1, 3, 5, K.STONE);
  fillRect(64, 1, 1, 4, K.DIRT);
  stonePlatform(62, 6, 3, 6);

  // A few isolated stone anchors for dash/jump rhythm.
  stonePlatform(54, 8, 1, 5);
  stonePlatform(56, 10, 1, 2);
  stonePlatform(58, 10, 1, 2);

  return rows;
}

export const act01Level3Definition = {
  cols: 40,
  rows: 24,
  artTileSize: CELL_SIZE.BUILD,
  terrainRenderMode: 'contained-autotile',
  theme: 'kenney-pixel-platformer:grass',
  layers: [
    terrainLayer({ cellSize: CELL_SIZE.BUILD, rows: createTerrainRows() }),
    gridLayer({ id: 'entities', cellSize: CELL_SIZE.GRID, symbols: { P: playerSpawner, E: slimeSpawner, G: finishGateObject }, rows: [
      '........................................',
      '........................................',
      '...........E.........................GGG',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '.E......................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '.........E..............................',
      '...................................E....',
      '...P....................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................'
    ] })
  ]
};

export const act01Level3 = defineTilemap({
  id: 'act-01-level-3',
  name: 'Act 01 Level 3',
  categories: ['levels', 'act-01'],
  visibility: 'public',
  description: 'Scale the broken grass-and-stone climb to reach the high gate.',
  ...act01Level3Definition
});
