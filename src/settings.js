/**
 * Application-layer settings adapter.
 * Owns persistence, app schema normalization, and mutation of the compatibility game object.
 * Pure input schema rules live in `src/core/input/settings.js`.
 */
import { clone } from './core/input/utils.js';
import { browserRuntime } from './runtime.js';
import { createBrowserInputAdapter, createGameInputRuntime } from './app/input/browser-input-adapter.js';
import { defaultBinds, defaultGamepadBinds } from './input.js';
import { gameInputProfile } from './app/input/game-input-profile.js';
import { bindingFromLegacyGamepad, bindingFromLegacyKeyboard, normalizeInputSettings } from './core/input/settings.js';

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

const legacyActionRows = {
  left: { action: 'player.moveX', scale: -1 },
  right: { action: 'player.moveX', scale: 1 },
  jump: { action: 'player.jump' },
  dash: { action: 'player.dash' },
  attack: { action: 'player.attack' },
  pause: { action: 'system.pause' },
  restart: { action: 'system.restart' }
};

function bindingToLegacyCode(binding, row) {
  if (binding.deviceType === 'keyboard' && binding.control === 'key') return binding.code;
  if (binding.deviceType !== 'gamepad') return null;
  if (binding.control === 'button') return `PadButton${binding.index}`;
  if (binding.control === 'axisDirection') return `PadAxis${binding.index}${binding.direction < 0 ? '-' : '+'}`;
  if (binding.control === 'axis' && row.scale) return `PadAxis${binding.index}${row.scale < 0 ? '-' : '+'}`;
  return null;
}

function legacyBindsFromInput(input, device) {
  return Object.fromEntries(Object.entries(legacyActionRows).map(([legacyAction, row]) => {
    const codes = (input.bindings[row.action] || [])
      .filter(binding => binding.deviceType === device)
      .filter(binding => row.scale === undefined || binding.control === 'axis' || binding.scale === row.scale || binding.direction === row.scale)
      .map(binding => bindingToLegacyCode(binding, row))
      .filter(Boolean);
    const fallback = device === 'gamepad' ? defaultGamepadBinds[legacyAction] : defaultBinds[legacyAction];
    return [legacyAction, codes.length ? [...new Set(codes)] : clone(fallback)];
  }));
}

function legacyBindsToInputSettings(settings, keyboardBinds, gamepadBinds) {
  const normalized = normalizeInputSettings(gameInputProfile, { input: settings.input }).settings.input;
  const convertedByAction = {};
  for (const [legacyAction, row] of Object.entries(legacyActionRows)) {
    const keyboard = (keyboardBinds[legacyAction] || []).map(code => bindingFromLegacyKeyboard(code, row.scale === undefined ? {} : { scale: row.scale }));
    const gamepad = (gamepadBinds[legacyAction] || []).map(code => bindingFromLegacyGamepad(code, row.scale === undefined ? {} : { scale: row.scale }));
    convertedByAction[row.action] ??= [];
    convertedByAction[row.action].push(...keyboard, ...gamepad);
  }
  for (const [action, converted] of Object.entries(convertedByAction)) {
    const valid = converted.filter(Boolean);
    if (valid.length) normalized.bindings[action] = valid;
  }
  normalized.slots.player1.devices.gamepad.enabled = settings.input?.slots?.player1?.devices?.gamepad?.enabled !== false;
  return normalized;
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
  game.input.binds = legacyBindsFromInput(game.settings.input, 'keyboard');
  game.input.gamepadBinds = legacyBindsFromInput(game.settings.input, 'gamepad');
  game.input.useController = game.settings.input.slots.player1.devices.gamepad.enabled;
  game.input.listeningFor = null;
  game.input.controllerBindAction = null;
  game.input.bindDeadline = 0;
  game.inputRuntime = createGameInputRuntime(game.settings);
  game.inputAdapter = createBrowserInputAdapter(game.inputRuntime, { now: game.runtime?.now || browserRuntime.now });
  return game.settings;
}

export function syncSettingsFromInput(game, storage = browserRuntime.storage) {
  const settings = normalizeSettings(game.settings);
  settings.input = legacyBindsToInputSettings(settings, game.input.binds, game.input.gamepadBinds);
  settings.input.slots.player1.devices.gamepad.enabled = game.input.useController !== false;
  game.settings = saveSettings(settings, storage);
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
