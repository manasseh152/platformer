import { defineTilemap, gridLayer } from '../../../core/tilemaps/tilemap.js';
import { finishGateObject, playerSpawner, slimeSpawner, solidTerrain } from '../objects.js';

export const enemyZooMapDefinition = {
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
    '#...............#####..#',
    '#......................#',
    '#.......#####..........#',
    '#......................#',
    '#..#####......#####....#',
    '#......................#',
    '#......####............#',
    '#......................#',
    '#.#####.....#####..##..#',
    '########################'
  
      ]
    }),
    gridLayer({
      id: 'entities',
      symbols: { P: playerSpawner, E: slimeSpawner, G: finishGateObject },
      rows: [
    '........................',
    '.................E.E....',
    '........................',
    '........GGG.............',
    '........................',
    '...E...........E........',
    '........................',
    '........................',
    '........................',
    '...E.........E..........',
    '..P.....................',
    '........................'
  
      ]
    })
  ]
};

export const enemyZooMap = defineTilemap({
  id: 'enemy-zoo-map',
  name: 'Enemy Zoo Map',
  categories: ['enemy'],
  visibility: 'developer',
  description: 'Tilemap fixture documenting enemy combinations.',
  ...enemyZooMapDefinition
});
