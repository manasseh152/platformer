import { parseTilemap, withLevelMeta } from '../tilemap.js';
import { developerBackdropRows } from './developer-backdrop.js';

export const finishGateGymMapDefinition = {
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
  kind: 'tilemap-level',
  categories: ['gyms'],
  visibility: 'developer',
  description: 'Tilemap fixture for finish gate trigger sizing, camera framing, and completion flow.'
});
