import { assertCatalog } from '../catalog/metadata.js';
import { act01Level1 } from './act-01-level-1.js';
import { legacyMovementLab } from './legacy-movement-lab.js';
import { legacyHazardLab } from './legacy-hazard-lab.js';
import { legacyEnemyZoo } from './legacy-enemy-zoo.js';
import { gateLab } from './gate-lab.js';

export const level = act01Level1;
export const gymLevel = legacyMovementLab;
export const hazardGymLevel = legacyHazardLab;
export const enemyZooLevel = legacyEnemyZoo;
export const gateLabLevel = gateLab;

export const levels = {
  [act01Level1.id]: act01Level1,
  [legacyMovementLab.id]: legacyMovementLab,
  [legacyHazardLab.id]: legacyHazardLab,
  [legacyEnemyZoo.id]: legacyEnemyZoo,
  [gateLab.id]: gateLab
};

function assertLevel(level) {
  if (!level.tiles || !level.tileSize || !level.cols || !level.rows) throw new Error(`${level.id} must be a parsed tilemap level`);
}

assertCatalog(Object.values(levels), { allowedKinds: ['tilemap-level'] });
Object.values(levels).forEach(assertLevel);

export function getLevelById(id) {
  return levels[id] ?? null;
}

export function getAllLevels() {
  return Object.values(levels);
}

export function getDefaultLevel() {
  return act01Level1;
}
