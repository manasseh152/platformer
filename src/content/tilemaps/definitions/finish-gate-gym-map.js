import { defineTilemap, gridLayer } from '../../../core/tilemaps/tilemap.js';
import { finishGateObject, playerSpawner, slimeSpawner, solidTerrain } from '../objects.js';

export const finishGateGymMapDefinition = {
  cols: 24,
  rows: 12,
  artTileSize: 16,
  theme: 'kenney-pixel-platformer:grass',
  layers: [
    gridLayer({
      id: 'terrain',
      symbols: { '#': solidTerrain },
      rows: [
    '########################',
    '#......................#',
    '#......................#',
    '#................###...#',
    '#.............######...#',
    '#......................#',
    '#......###.............#',
    '#..###.###.....###.....#',
    '#......................#',
    '#..###...........###...#',
    '#......................#',
    '########################'
  
      ]
    }),
    gridLayer({
      id: 'entities',
      symbols: { P: playerSpawner, E: slimeSpawner, G: finishGateObject },
      rows: [
    '........................',
    '........................',
    '........................',
    '.................GGG....',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..P.....................',
    '........................'
  
      ]
    })
  ]
};

export const finishGateGymMap = defineTilemap({
  id: 'finish-gate-gym-map',
  name: 'Finish Gate Gym Map',
  categories: ['finish-gate'],
  visibility: 'developer',
  description: 'Tilemap fixture for finish gate trigger sizing, camera framing, and completion flow.',
  ...finishGateGymMapDefinition
});
