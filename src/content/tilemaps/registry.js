import { createCatalogRegistry } from '../../catalog/registry.js';
import { act01Level1 } from '../../core/tilemaps/definitions/act-01-level-1.js';
import { movementGymMap } from '../../core/tilemaps/definitions/movement-gym-map.js';
import { finishGateGymMap } from '../../core/tilemaps/definitions/finish-gate-gym-map.js';
import { enemyZooMap } from '../../core/tilemaps/definitions/enemy-zoo-map.js';

function assertTilemapSceneDefinition(definition) {
  if (definition.kind !== 'tilemap-scene' || !definition.layers || !definition.objects || !definition.tileSize || !definition.cols || !definition.rows) {
    throw new Error(`${definition.id} must be a parsed tilemap scene definition`);
  }
}

const registry = createCatalogRegistry({
  name: 'tilemap-scenes',
  allowedKinds: ['tilemap-scene'],
  validateEntry: assertTilemapSceneDefinition
});

export const act01Level1TilemapSceneDefinition = registry.register(act01Level1);
export const movementGymMapTilemapSceneDefinition = registry.register(movementGymMap);
export const finishGateGymMapTilemapSceneDefinition = registry.register(finishGateGymMap);
export const enemyZooMapTilemapSceneDefinition = registry.register(enemyZooMap);

export const tilemapSceneDefinitions = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getTilemapSceneDefinitionById(id) {
  return registry.getById(id);
}

export function getAllTilemapSceneDefinitions() {
  return registry.getAll();
}

export function getDefaultTilemapSceneDefinition() {
  return act01Level1TilemapSceneDefinition;
}

// Deprecated aliases while application code finishes moving to scene terminology.
export const act01Level1TilemapLevelDefinition = act01Level1TilemapSceneDefinition;
export const movementGymMapTilemapLevelDefinition = movementGymMapTilemapSceneDefinition;
export const tilemapLevelDefinitions = tilemapSceneDefinitions;
export const getTilemapLevelDefinitionById = getTilemapSceneDefinitionById;
export const getAllTilemapLevelDefinitions = getAllTilemapSceneDefinitions;
export const getDefaultTilemapLevelDefinition = getDefaultTilemapSceneDefinition;
