import { parseTilemap, withLevelMeta } from '../tilemap.js';
import { developerBackdropRows } from './developer-backdrop.js';

export const legacyMovementLabDefinition = {
  terrainRows: [
    '########################',
    '#......................#',
    '#......................#',
    '#.................===..#',
    '#.............===......#',
    '#.........===..........#',
    '#.....===..............#',
    '#......................#',
    '#..===....===....===...#',
    '#......................#',
    '#.===..............==..#',
    '########################'
  ],
  objectRows: [
    '........................',
    '........................',
    '..................<G>...',
    '........................',
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
    '..g......t.....t.....r..',
    '........................',
    '.................f......',
    '...........t............',
    '.......f................',
    '........................',
    '...t.......t......t.....',
    '........................',
    '..f...........f.....f...',
    '........................',
    '........................'
  ],
  backdropRows: developerBackdropRows
};

export const legacyMovementLab = withLevelMeta(parseTilemap(legacyMovementLabDefinition), {
  id: 'legacy-movement-lab',
  name: 'Legacy Movement Lab',
  kind: 'tilemap-level',
  categories: ['gyms', 'legacy'],
  visibility: 'developer',
  description: 'Legacy tilemap-only test map. Prefer executable gyms for movement validation.'
});
