import { TILE_SIZE } from '../constants.js';

export function defineObject({ id, components = [] }) {
  if (!id) throw new Error('defineObject requires an id');
  return Object.freeze({ id, components: Object.freeze([...components]) });
}

export const solid = () => ({ type: 'collision:solid' });
export const terrain = (props = {}) => ({ type: 'terrain', material: props.material ?? 'grass' });
export const renderTerrain = (props = {}) => ({ type: 'render:terrain', strategy: props.strategy ?? 'dual-grid' });
export const spawner = object => ({ type: 'spawner', object });
export const physicsBody = props => ({ type: 'physics:body', ...props });
export const velocity = (props = {}) => ({ type: 'physics:velocity', ...props });
export const health = props => ({ type: 'health', ...props });
export const playerController = () => ({ type: 'controller:player' });
export const enemyController = () => ({ type: 'controller:enemy' });
export const patrol = (props = {}) => ({ type: 'ai:patrol', strategy: props.strategy ?? 'auto-platform' });
export const transition = (props = {}) => ({ type: 'transition', kind: props.kind ?? 'finish' });
export const renderGoal = () => ({ type: 'render:goal' });

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
