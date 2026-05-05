import { createCatalogRegistry } from '../catalog/registry.js';
import { act01Level1 } from './definitions/act-01-level-1.js';
import { movementGymMap } from './definitions/movement-gym-map.js';
import { hazardGymMap } from './definitions/hazard-gym-map.js';
import { finishGateGymMap } from './definitions/finish-gate-gym-map.js';
import { enemyZooMap } from './definitions/enemy-zoo-map.js';

function assertTilemapLevelDefinition(definition) {
  if (!definition.tiles || !definition.tileSize || !definition.cols || !definition.rows) {
    throw new Error(`${definition.id} must be a parsed tilemap level definition`);
  }
}

const registry = createCatalogRegistry({
  name: 'tilemaps',
  validateEntry: assertTilemapLevelDefinition
});

export const act01Level1TilemapLevelDefinition = registry.register(act01Level1);
export const movementGymMapTilemapLevelDefinition = registry.register(movementGymMap);
export const hazardGymMapTilemapLevelDefinition = registry.register(hazardGymMap);
export const finishGateGymMapTilemapLevelDefinition = registry.register(finishGateGymMap);
export const enemyZooMapTilemapLevelDefinition = registry.register(enemyZooMap);

export const tilemapLevelDefinitions = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getTilemapLevelDefinitionById(id) {
  return registry.getById(id);
}

export function getAllTilemapLevelDefinitions() {
  return registry.getAll();
}

export function getDefaultTilemapLevelDefinition() {
  return act01Level1TilemapLevelDefinition;
}
