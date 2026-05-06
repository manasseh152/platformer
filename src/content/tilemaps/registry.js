import { createCatalogRegistry } from '../../catalog/registry.js';
import { act01Level1 } from './definitions/act-01-level-1.js';
import { movementGymMap } from './definitions/movement-gym-map.js';
import { finishGateGymMap } from './definitions/finish-gate-gym-map.js';
import { enemyZooMap } from './definitions/enemy-zoo-map.js';

function assertTilemapScene(definition) {
  if (definition.kind !== 'tilemap-scene' || !definition.layers || !definition.objects || !definition.tileSize || !definition.cols || !definition.rows) {
    throw new Error(`${definition.id} must be a parsed tilemap scene`);
  }
}

const registry = createCatalogRegistry({
  name: 'tilemap-scenes',
  allowedKinds: ['tilemap-scene'],
  validateEntry: assertTilemapScene
});

export const act01Level1TilemapScene = registry.register(act01Level1);
export const movementGymMapTilemapScene = registry.register(movementGymMap);
export const finishGateGymMapTilemapScene = registry.register(finishGateGymMap);
export const enemyZooMapTilemapScene = registry.register(enemyZooMap);

export const tilemapScenes = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getTilemapSceneById(id) {
  return registry.getById(id);
}

export function getAllTilemapScenes() {
  return registry.getAll();
}

export function getDefaultTilemapScene() {
  return act01Level1TilemapScene;
}
