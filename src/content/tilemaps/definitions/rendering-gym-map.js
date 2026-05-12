import { CELL_SIZE } from '../../../core/constants.js';
import { defineTilemap, gridLayer } from '../../../core/tilemaps/tilemap.js';
import { TERRAIN_KIND as K, terrainLayer } from '../../../core/tilemaps/terrain-layer.js';
import { sceneObject } from '../../../engine/scene/objects.js';
import { darkAmbientLight, playerSpawner, slimeSpawner, warmTorchLight } from '../objects.js';

const COLS = 18;
const ROWS = 10;
const TERRAIN_COLS = COLS * 2;
const TERRAIN_ROWS = ROWS * 2;

function terrainRow(row) {
  const cells = Array(TERRAIN_COLS).fill(null);
  if (row >= 16 && row <= 17) {
    for (let col = 4; col < 24; col += 1) cells[col] = K.GRASS;
  }
  if (row >= 18) {
    for (let col = 0; col < TERRAIN_COLS; col += 1) cells[col] = K.GRASS;
  }
  return cells;
}

const terrainRows = Array.from({ length: TERRAIN_ROWS }, (_, row) => terrainRow(row));

function prefabObject({ id, definition, col, row }) {
  return sceneObject({
    id,
    definitionId: definition.id,
    transform: { col, row, cellSize: CELL_SIZE.GRID, x: col * CELL_SIZE.GRID, y: row * CELL_SIZE.GRID, w: CELL_SIZE.GRID, h: CELL_SIZE.GRID },
    components: definition.components
  });
}

export const renderingGymMapDefinition = {
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
      symbols: { P: playerSpawner, E: slimeSpawner },
      rows: [
        '..................',
        '..................',
        '..................',
        '..................',
        '....P..E..........',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................'
      ]
    })
  ],
  objects: [
    prefabObject({ id: 'rendering-gym-ambient-light', definition: darkAmbientLight, col: 0, row: 0 }),
    prefabObject({ id: 'rendering-gym-left-torch-light', definition: warmTorchLight, col: 4, row: 3 }),
    prefabObject({ id: 'rendering-gym-right-torch-light', definition: warmTorchLight, col: 12, row: 3 })
  ]
};

export const renderingGymMap = defineTilemap({
  id: 'rendering-gym-map',
  name: 'Rendering Gym Map',
  categories: ['rendering'],
  visibility: 'developer',
  description: 'Minimal showcase fixture for render observer gym machines.',
  ...renderingGymMapDefinition
});
