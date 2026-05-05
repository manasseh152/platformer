import { parseTilemap, withLevelMeta } from '../tilemap.js';
import { developerBackdropRows } from './developer-backdrop.js';

export const finishGateGymMapDefinition = {
  tileSize: 36,
  artTileSize: 18,
  theme: 'kenney-pixel-platformer:grass',
  terrainRows: [
    '########################',
    '#......................#',
    '#......................#',
    '#................BBB...#',
    '#.............===BBB...#',
    '#......................#',
    '#......BBB.............#',
    '#..===.BBB.....===.....#',
    '#......................#',
    '#..===...........===...#',
    '#......................#',
    '########################'
  ],
  objectRows: [
    '........................',
    '........................',
    '........................',
    '.................<G>....',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..P.....................',
    '........................'
  ],
  decorRows: [
    '........................',
    '..g...............f.....',
    '........................',
    '..............t..t......',
    '........................',
    '......f.................',
    '........................',
    '...t..........t.........',
    '........................',
    '..f...........f.........',
    '........................',
    '........................'
  ],
  backdropRows: developerBackdropRows
};

export const finishGateGymMap = withLevelMeta(parseTilemap(finishGateGymMapDefinition), {
  id: 'finish-gate-gym-map',
  name: 'Finish Gate Gym Map',

  categories: ['finish-gate'],
  visibility: 'developer',
  description: 'Tilemap fixture for finish gate trigger sizing, camera framing, and completion flow.'
});
