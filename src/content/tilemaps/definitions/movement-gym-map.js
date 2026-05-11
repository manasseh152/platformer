import { CELL_SIZE } from '../../../core/constants.js';
import { defineTilemap, gridLayer } from '../../../core/tilemaps/tilemap.js';
import { TERRAIN_KIND as K, terrainLayer } from '../../../core/tilemaps/terrain-layer.js';
import { playerSpawner, slimeSpawner } from '../objects.js';

const COLS = 44;
const ROWS = 20;
const TERRAIN_COLS = COLS * 2;
const TERRAIN_ROWS = ROWS * 2;

function terrainRow(row) {
  const cells = Array(TERRAIN_COLS).fill(null);
  const segments = [];

  // Upper runway: run, dash, run+jump, and air-correction machines.
  if (row >= 12 && row <= 13) segments.push([2, 72]);

  // Jump-gap lane. The gap is intentionally narrow enough for the scripted jump arc
  // but wide enough to fail without jump input.
  if (row >= 22 && row <= 23) segments.push([2, 23], [25, 72]);

  // NPC patrol lane.
  if (row >= 34 && row <= 37) segments.push([58, 84]);

  // Bottom catch row, kept well below fixtures so failures are visible rather than
  // immediately leaving the world.
  if (row >= 38) segments.push([0, TERRAIN_COLS]);

  for (const [from, to] of segments) {
    for (let col = from; col < to; col += 1) cells[col] = K.GRASS;
  }
  return cells;
}

const terrainRows = Array.from({ length: TERRAIN_ROWS }, (_, row) => terrainRow(row));

export const movementGymMapDefinition = {
  cols: COLS,
  rows: ROWS,
  artTileSize: CELL_SIZE.BUILD,
  terrainRenderMode: 'contained-autotile',
  theme: 'kenney-pixel-platformer:grass',
  layers: [
    terrainLayer({ cellSize: CELL_SIZE.BUILD, rows: terrainRows }),
    gridLayer({
      id: 'entities',
      cellSize: CELL_SIZE.GRID,
      symbols: { P: playerSpawner, S: slimeSpawner },
      rows: [
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '..P.........................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '............................................',
        '..................S.........................',
        '............................................',
        '............................................',
        '............................................',
        '............................................'
      ]
    })
  ]
};

export const movementGymMap = defineTilemap({
  id: 'movement-gym-map',
  name: 'Movement Gym Map',
  categories: ['movement'],
  visibility: 'developer',
  description: 'Focused multi-lane fixture for movement machine validation.',
  ...movementGymMapDefinition
});
