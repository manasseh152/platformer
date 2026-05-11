/**
 * Application-layer settings adapter.
 * Owns persistence, app schema normalization, and mutation of the compatibility game object.
 * Pure input schema rules live in `src/core/input/settings.js`.
 */
import { browserRuntime } from '../runtime/browser-runtime.js';
import { createBrowserInputAdapter, createGameInputRuntime } from '../input/browser-input-adapter.js';
import { gameInputProfile } from '../input/game-input-profile.js';
import { normalizeInputSettings } from '#/core/input/settings.js';

const MOTIONS = new Set(['system', 'on', 'off']);
const GPU_EXTRAS = new Set(['auto', 'off']);

function assertObject(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Settings JSON must be an object.');
}

function assertBoolean(value, name) { if (typeof value !== 'boolean') throw new Error(`${name} must be true or false.`); }

export function defaultSettings() {
  return normalizeSettings({});
}

export function normalizeSettings(candidate = {}) {
  assertObject(candidate);
  const source = { motion: 'system', gpuExtras: 'auto', developerMode: false, speedRunMode: false, ...candidate };
  if (!MOTIONS.has(source.motion)) throw new Error('motion must be "system", "on", or "off".');
  if (!GPU_EXTRAS.has(source.gpuExtras)) throw new Error('gpuExtras must be "auto" or "off".');
  assertBoolean(source.developerMode, 'developerMode');
  assertBoolean(source.speedRunMode, 'speedRunMode');
  const normalizedInput = normalizeInputSettings(gameInputProfile, source).settings.input;
  if (!source.input && typeof source.controllerEnabled === 'boolean') normalizedInput.slots.player1.devices.gamepad.enabled = source.controllerEnabled;
  return { schemaVersion: 2, motion: source.motion, gpuExtras: source.gpuExtras, developerMode: source.developerMode, speedRunMode: source.speedRunMode, input: normalizedInput };
}

export const SETTINGS_KEY = 'chibi.settings';

export function loadSettings(storage = browserRuntime.storage) {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : defaultSettings();
  } catch (err) {
    console.warn('Falling back to default settings:', err);
    return defaultSettings();
  }
}

export function saveSettings(settings, storage = browserRuntime.storage) {
  const normalized = normalizeSettings(settings);
  storage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function applySettingsToGame(game) {
  game.settings = normalizeSettings(game.settings);
  game.input.listeningFor = null;
  game.input.controllerBindAction = null;
  game.input.bindCapture = null;
  game.input.bindDeadline = 0;
  game.inputRuntime = createGameInputRuntime(game.settings);
  game.inputAdapter = createBrowserInputAdapter(game.inputRuntime, { now: game.runtime?.now || browserRuntime.now });
  return game.settings;
}

export function syncSettingsFromInput(game, storage = browserRuntime.storage) {
  game.settings = saveSettings(game.settings, storage);
  if (game.inputRuntime) {
    game.inputRuntime = createGameInputRuntime(game.settings);
    game.inputAdapter = createBrowserInputAdapter(game.inputRuntime, { now: game.runtime?.now || browserRuntime.now });
  }
  return game.settings;
}

export function replaceSettings(game, json, storage = browserRuntime.storage) {
  const parsed = JSON.parse(json);
  const normalized = normalizeSettings(parsed);
  game.settings = saveSettings(normalized, storage);
  applySettingsToGame(game);
  return game.settings;
}

export function serializeSettings(game) { return JSON.stringify(normalizeSettings(game.settings), null, 2); }
