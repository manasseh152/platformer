import { CELL_SIZE } from '../../../core/constants.js';
import { defineTilemap, gridLayer } from '../../../core/tilemaps/tilemap.js';
import { TERRAIN_KIND as K, terrainLayer } from '../../../core/tilemaps/terrain-layer.js';
import { finishGateObject, playerSpawner, slimeSpawner } from '../objects.js';

export const movementGymMapDefinition = {
  cols: 24,
  rows: 12,
  artTileSize: CELL_SIZE.BUILD,
  terrainRenderMode: 'contained-autotile',
  theme: 'kenney-pixel-platformer:grass',
  layers: [
    terrainLayer({ cellSize: CELL_SIZE.BUILD, rows: [
      [K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS, K.GRASS, K.GRASS, null, null, null, null, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS],
      [K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS]
    ] }),
    gridLayer({
      id: 'entities',
      cellSize: CELL_SIZE.GRID,
      symbols: { P: playerSpawner, E: slimeSpawner, G: finishGateObject },
      rows: [
    '........................',
    '........................',
    '..................GGG...',
    '........................',
    '........................',
    '........................',
    '........................',
    '...P....................',
    '........................',
    '........................',
    '........................',
    '........................'

      ]
    })
  ]
};

export const movementGymMap = defineTilemap({
  id: 'movement-gym-map',
  name: 'Movement Gym Map',
  categories: ['movement'],
  visibility: 'developer',
  description: 'Tilemap fixture for movement validation scenarios.',
  ...movementGymMapDefinition
});
