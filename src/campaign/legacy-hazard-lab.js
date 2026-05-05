import { parseTilemap, withLevelMeta } from '../levels/tilemap.js';
import { developerBackdropRows } from './developer-backdrop.js';

export const legacyHazardLabDefinition = {
  terrainRows: [
    '########################',
    '#......................#',
    '#................===...#',
    '#......................#',
    '#..........===.........#',
    '#......................#',
    '#.....===..............#',
    '#..........^^^.........#',
    '#..===.....===....===..#',
    '#......^^^......^^.....#',
    '#.===..===......===....#',
    '########################'
  ],
  objectRows: [
    '........................',
    '.................<G>....',
    '........................',
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
    '..r...............g.....',
    '........................',
    '..............t.........',
    '..........f.............',
    '........................',
    '.....t..................',
    '........................',
    '..f.......t......t......',
    '........................',
    '........................',
    '........................'
  ],
  backdropRows: developerBackdropRows
};

export const legacyHazardLab = withLevelMeta(parseTilemap(legacyHazardLabDefinition), {
  id: 'legacy-hazard-lab',
  name: 'Legacy Hazard Lab',
  kind: 'tilemap-level',
  categories: ['gyms', 'legacy'],
  visibility: 'developer',
  description: 'Legacy tilemap-only test map. Prefer executable gyms for hazard validation.'
});
