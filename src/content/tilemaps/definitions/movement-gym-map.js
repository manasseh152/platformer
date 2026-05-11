import { CELL_SIZE } from '../../../core/constants.js';
import { defineTilemap, gridLayer } from '../../../core/tilemaps/tilemap.js';
import { TERRAIN_KIND as K, terrainLayer } from '../../../core/tilemaps/terrain-layer.js';
import { playerSpawner } from '../objects.js';

const emptyTerrainRow = [K.GRASS, K.GRASS, ...Array(44).fill(null), K.GRASS, K.GRASS];
const solidTerrainRow = Array(48).fill(K.GRASS);

export const movementGymMapDefinition = {
  cols: 24,
  rows: 12,
  artTileSize: CELL_SIZE.BUILD,
  terrainRenderMode: 'contained-autotile',
  theme: 'kenney-pixel-platformer:grass',
  layers: [
    terrainLayer({ cellSize: CELL_SIZE.BUILD, rows: [
      solidTerrainRow,
      solidTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      emptyTerrainRow,
      solidTerrainRow,
      solidTerrainRow,
      solidTerrainRow,
      solidTerrainRow
    ] }),
    gridLayer({
      id: 'entities',
      cellSize: CELL_SIZE.GRID,
      symbols: { P: playerSpawner },
      rows: [
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '..P.....................',
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
  description: 'Minimal flat runway fixture for movement machine validation.',
  ...movementGymMapDefinition
});
