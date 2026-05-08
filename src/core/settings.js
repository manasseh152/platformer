const MOTIONS = new Set(['system', 'on', 'off']);
const GPU_EXTRAS = new Set(['auto', 'off']);

export function defaultSettings() {
  return normalizeSettings({});
}

function assertBoolean(value, name) {
  if (typeof value !== 'boolean') throw new Error(`${name} must be true or false.`);
}

export function normalizeSettings(candidate = {}) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Settings JSON must be an object.');
  const source = { motion: 'system', gpuExtras: 'auto', developerMode: false, speedRunMode: false, ...candidate };
  if (!MOTIONS.has(source.motion)) throw new Error('motion must be "system", "on", or "off".');
  if (!GPU_EXTRAS.has(source.gpuExtras)) throw new Error('gpuExtras must be "auto" or "off".');
  assertBoolean(source.developerMode, 'developerMode');
  assertBoolean(source.speedRunMode, 'speedRunMode');
  return {
    schemaVersion: 2,
    motion: source.motion,
    gpuExtras: source.gpuExtras,
    developerMode: source.developerMode,
    speedRunMode: source.speedRunMode
  };
}
