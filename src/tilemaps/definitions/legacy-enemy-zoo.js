import { parseTilemap, withLevelMeta } from '../tilemap.js';
import { developerBackdropRows } from './developer-backdrop.js';

export const legacyEnemyZooDefinition = {
  terrainRows: [
    '########################',
    '#......................#',
    '#...............=====..#',
    '#......................#',
    '#.......=====..........#',
    '#......................#',
    '#..=====......=====....#',
    '#......................#',
    '#......====............#',
    '#......................#',
    '#.=====.....=====..==..#',
    '########################'
  ],
  objectRows: [
    '........................',
    '.................E.E....',
    '........................',
    '........<G>.............',
    '........................',
    '...E...........E........',
    '........................',
    '........................',
    '........................',
    '...E.........E..........',
    '..P.....................',
    '........................'
  ],
  decorRows: [
    '........................',
    '..r......t.....t.....r..',
    '........................',
    '........f...............',
    '........................',
    '...t...........t........',
    '........................',
    '........t...............',
    '........................',
    '..f.........f...........',
    '........................',
    '........................'
  ],
  backdropRows: developerBackdropRows
};

export const legacyEnemyZoo = withLevelMeta(parseTilemap(legacyEnemyZooDefinition), {
  id: 'legacy-enemy-zoo',
  name: 'Legacy Enemy Zoo',
  kind: 'tilemap-level',
  categories: ['zoos', 'legacy'],
  visibility: 'developer',
  description: 'Legacy tilemap-only zoo. Prefer executable gyms for enemy behavior validation.'
});
