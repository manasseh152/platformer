const CAMERA_BUFFER_SPACE = 'camera-buffer';

function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function nonNegativeNumber(value, name) {
  const number = finiteNumber(value, name);
  if (number < 0) throw new Error(`${name} must be non-negative`);
  return number;
}

function normalizeOverscan(value = 0) {
  if (typeof value === 'number') {
    const size = nonNegativeNumber(value, 'overscan');
    return { left: size, right: size, top: size, bottom: size };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('overscan must be a number or object');
  if ('x' in value || 'y' in value) {
    const x = nonNegativeNumber(value.x ?? 0, 'overscan.x');
    const y = nonNegativeNumber(value.y ?? 0, 'overscan.y');
    return { left: x, right: x, top: y, bottom: y };
  }
  return {
    left: nonNegativeNumber(value.left ?? 0, 'overscan.left'),
    right: nonNegativeNumber(value.right ?? 0, 'overscan.right'),
    top: nonNegativeNumber(value.top ?? 0, 'overscan.top'),
    bottom: nonNegativeNumber(value.bottom ?? 0, 'overscan.bottom')
  };
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

export function renderLayer({ order = 0, space = CAMERA_BUFFER_SPACE, overscan = 0 } = {}) {
  finiteNumber(order, 'renderLayer.order');
  if (space !== CAMERA_BUFFER_SPACE) throw new Error('renderLayer.space must be "camera-buffer"');
  return { type: 'render:layer', order, space, overscan: normalizeOverscan(overscan) };
}

export function renderParallax({ x = 1, y = 1 } = {}) {
  return { type: 'render:parallax', x: finiteNumber(x, 'renderParallax.x'), y: finiteNumber(y, 'renderParallax.y') };
}

export function renderProcedural({ shader } = {}) {
  if (typeof shader !== 'string' || !shader.trim()) throw new Error('renderProcedural.shader must be a non-empty string');
  return { type: 'render:procedural', shader };
}

export function renderTexture({ asset, repeat = false, opacity = 1 } = {}) {
  if (typeof asset !== 'string' || !asset.trim()) throw new Error('renderTexture.asset must be a non-empty string');
  if (typeof repeat !== 'boolean') throw new Error('renderTexture.repeat must be true or false');
  finiteNumber(opacity, 'renderTexture.opacity');
  if (opacity < 0 || opacity > 1) throw new Error('renderTexture.opacity must be between 0 and 1');
  return { type: 'render:texture', asset, repeat, opacity };
}
