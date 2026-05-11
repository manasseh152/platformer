import { createCatalogRegistry } from '../../catalog/registry.js';
import { act01Level1 } from './definitions/act-01-level-1.js';
import { act01Level2 } from './definitions/act-01-level-2.js';
import { act01Level3 } from './definitions/act-01-level-3.js';
import { movementGymMap } from './definitions/movement-gym-map.js';
import { renderingGymMap } from './definitions/rendering-gym-map.js';
import { finishGateGymMap } from './definitions/finish-gate-gym-map.js';
import { enemyZooMap } from './definitions/enemy-zoo-map.js';

function assertTilemap(definition) {
  if (definition.kind !== 'tilemap' || !definition.layers || !definition.objects || !definition.tileSize || !definition.cols || !definition.rows) {
    throw new Error(`${definition.id} must be a parsed tilemap`);
  }
}

const registry = createCatalogRegistry({
  name: 'tilemaps',
  allowedKinds: ['tilemap'],
  validateEntry: assertTilemap
});

export const act01Level1Tilemap = registry.register(act01Level1);
export const act01Level2Tilemap = registry.register(act01Level2);
export const act01Level3Tilemap = registry.register(act01Level3);
export const movementGymMapTilemap = registry.register(movementGymMap);
export const renderingGymMapTilemap = registry.register(renderingGymMap);
export const finishGateGymMapTilemap = registry.register(finishGateGymMap);
export const enemyZooMapTilemap = registry.register(enemyZooMap);

export const tilemaps = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getTilemapById(id) {
  return registry.getById(id);
}

export function getAllTilemaps() {
  return registry.getAll();
}

export function getDefaultTilemap() {
  return act01Level1Tilemap;
}
