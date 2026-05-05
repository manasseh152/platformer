import { createCatalogRegistry } from '../catalog/registry.js';
import { act01Level1 } from './act-01-level-1.js';
import { legacyMovementLab } from './legacy-movement-lab.js';
import { legacyHazardLab } from './legacy-hazard-lab.js';
import { legacyEnemyZoo } from './legacy-enemy-zoo.js';
import { gateLab } from './gate-lab.js';

function assertLevel(level) {
  if (!level.tiles || !level.tileSize || !level.cols || !level.rows) throw new Error(`${level.id} must be a parsed tilemap level`);
}

const registry = createCatalogRegistry({
  name: 'campaign',
  allowedKinds: ['tilemap-level'],
  validateEntry: assertLevel
});

export const level = registry.register(act01Level1);
export const gymLevel = registry.register(legacyMovementLab);
export const hazardGymLevel = registry.register(legacyHazardLab);
export const enemyZooLevel = registry.register(legacyEnemyZoo);
export const gateLabLevel = registry.register(gateLab);

export const levels = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getLevelById(id) {
  return registry.getById(id);
}

export function getAllLevels() {
  return registry.getAll();
}

export function getDefaultLevel() {
  return level;
}
