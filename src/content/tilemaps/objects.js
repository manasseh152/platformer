import { TILE_SIZE } from '../../core/constants.js';
import { defineObject } from '../../engine/scene/objects.js';
import { enemyController, health, patrol, physicsBody, playerController, renderGoal, renderTerrain, solid, spawner, terrain, transition, velocity } from '../../engine/scene/components.js';

export { defineObject } from '../../engine/scene/objects.js';
export { enemyController, health, patrol, physicsBody, playerController, renderGoal, renderTerrain, solid, spawner, terrain, transition, velocity } from '../../engine/scene/components.js';

export const solidTerrain = defineObject({
  id: 'solid-terrain',
  components: [solid(), terrain(), renderTerrain({ strategy: 'dual-grid' })]
});

export const player = defineObject({
  id: 'player',
  components: [physicsBody({ w: 34, h: 50 }), velocity(), health({ hp: 5 }), playerController()]
});

export const slime = defineObject({
  id: 'slime',
  components: [physicsBody({ w: 42, h: 38 }), velocity(), health({ hp: 3 }), enemyController(), patrol({ strategy: 'auto-platform' })]
});

export const finishGate = defineObject({
  id: 'finish-gate',
  components: [transition({ kind: 'finish' }), renderGoal()]
});

export const playerSpawner = defineObject({ id: 'player-spawner', components: [spawner(player)] });
export const slimeSpawner = defineObject({ id: 'slime-spawner', components: [spawner(slime)] });
export const finishGateObject = defineObject({ id: 'finish-gate-object', components: [spawner(finishGate)] });

export const DEFAULT_OBJECT_SIZE = TILE_SIZE;
