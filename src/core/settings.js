import { clone, defaultBinds, defaultGamepadBinds, validBinds } from './input.js';

const MOTIONS = new Set(['system', 'on', 'off']);
const GPU_EXTRAS = new Set(['auto', 'off']);

export function defaultSettings() {
  return { schemaVersion: 1, motion: 'system', gpuExtras: 'auto', developerMode: false, controllerEnabled: true, keyboardBinds: clone(defaultBinds), gamepadBinds: clone(defaultGamepadBinds) };
}

function assertBoolean(value, name) { if (typeof value !== 'boolean') throw new Error(`${name} must be true or false.`); }

function normalizeBinds(value, defaults, name) {
  if (value === undefined) return clone(defaults);
  if (!validBinds(value, defaults)) throw new Error(`${name} must contain every action with at least one string bind.`);
  return Object.fromEntries(Object.keys(defaults).map(action => [action, [...new Set(value[action])]]));
}

export function normalizeSettings(candidate = {}) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Settings JSON must be an object.');
  const defaults = defaultSettings();
  const source = { ...defaults, ...candidate };
  if (!MOTIONS.has(source.motion)) throw new Error('motion must be "system", "on", or "off".');
  if (!GPU_EXTRAS.has(source.gpuExtras)) throw new Error('gpuExtras must be "auto" or "off".');
  assertBoolean(source.developerMode, 'developerMode');
  assertBoolean(source.controllerEnabled, 'controllerEnabled');
  return { schemaVersion: 1, motion: source.motion, gpuExtras: source.gpuExtras, developerMode: source.developerMode, controllerEnabled: source.controllerEnabled, keyboardBinds: normalizeBinds(source.keyboardBinds, defaultBinds, 'keyboardBinds'), gamepadBinds: normalizeBinds(source.gamepadBinds, defaultGamepadBinds, 'gamepadBinds') };
}
