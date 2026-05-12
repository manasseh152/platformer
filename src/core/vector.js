function assertFiniteChannel(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function isVec(value, length) {
  return Array.isArray(value) && value.length === length && value.every(channel => typeof channel === 'number' && Number.isFinite(channel));
}

function assertVec(value, length, name) {
  if (!isVec(value, length)) throw new Error(`${name} must be a Vec${length} finite-number tuple`);
  return value;
}

function tuple(...channels) {
  return Object.freeze(channels.map((channel, index) => assertFiniteChannel(channel, `vec.${index}`)));
}

export function isVec2(value) {
  return isVec(value, 2);
}

export function isVec3(value) {
  return isVec(value, 3);
}

export function isVec4(value) {
  return isVec(value, 4);
}

export function assertVec2(value, name = 'vec2') {
  return assertVec(value, 2, name);
}

export function assertVec3(value, name = 'vec3') {
  return assertVec(value, 3, name);
}

export function assertVec4(value, name = 'vec4') {
  return assertVec(value, 4, name);
}

export const Vec = Object.freeze({
  xy(x, y) {
    return tuple(x, y);
  },

  xyz(x, y, z) {
    return tuple(x, y, z);
  },

  xyzw(x, y, z, w) {
    return tuple(x, y, z, w);
  }
});
