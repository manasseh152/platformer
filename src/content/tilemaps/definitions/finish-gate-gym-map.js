import { CELL_SIZE } from '../../../core/constants.js';
import { defineTilemap, gridLayer } from '../../../core/tilemaps/tilemap.js';
import { TERRAIN_KIND as K, terrainLayer } from '../../../core/tilemaps/terrain-layer.js';
import { finishGateObject, playerSpawner } from '../objects.js';

const COLS = 20;
const ROWS = 8;
const TERRAIN_COLS = COLS * 2;
const TERRAIN_ROWS = ROWS * 2;

function terrainRow(row) {
  const cells = Array(TERRAIN_COLS).fill(null);
  if (row >= 12) {
    for (let col = 0; col < TERRAIN_COLS; col += 1) cells[col] = K.GRASS;
  }
  return cells;
}

export const finishGateGymMapDefinition = {
  cols: COLS,
  rows: ROWS,
  artTileSize: CELL_SIZE.BUILD,
  terrainRenderMode: 'contained-autotile',
  theme: 'kenney-pixel-platformer:grass',
  layers: [
    terrainLayer({ cellSize: CELL_SIZE.BUILD, rows: Array.from({ length: TERRAIN_ROWS }, (_, row) => terrainRow(row)) }),
    gridLayer({
      id: 'entities',
      cellSize: CELL_SIZE.GRID,
      symbols: { P: playerSpawner, G: finishGateObject },
      rows: [
        '....................',
        '....................',
        '....................',
        '....................',
        '....................',
        '..P............GGG..',
        '....................',
        '....................'
      ]
    })
  ]
};

export const finishGateGymMap = defineTilemap({
  id: 'finish-gate-gym-map',
  name: 'Finish Gate Gym Map',
  categories: ['finish-gate'],
  visibility: 'developer',
  description: 'Minimal flat fixture for finish gate trigger sizing and completion flow.',
  ...finishGateGymMapDefinition
});
