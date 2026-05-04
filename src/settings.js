import { clone, defaultBinds, defaultGamepadBinds, validBinds } from './input.js';

export const SETTINGS_KEY = 'chibi.settings';
const MOTIONS = new Set(['system', 'on', 'off']);

export function defaultSettings() {
  return {
    schemaVersion: 1,
    motion: 'system',
    developerMode: false,
    controllerEnabled: true,
    keyboardBinds: clone(defaultBinds),
    gamepadBinds: clone(defaultGamepadBinds)
  };
}

function assertBoolean(value, name) {
  if (typeof value !== 'boolean') throw new Error(`${name} must be true or false.`);
}

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
  assertBoolean(source.developerMode, 'developerMode');
  assertBoolean(source.controllerEnabled, 'controllerEnabled');
  return {
    schemaVersion: 1,
    motion: source.motion,
    developerMode: source.developerMode,
    controllerEnabled: source.controllerEnabled,
    keyboardBinds: normalizeBinds(source.keyboardBinds, defaultBinds, 'keyboardBinds'),
    gamepadBinds: normalizeBinds(source.gamepadBinds, defaultGamepadBinds, 'gamepadBinds')
  };
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : defaultSettings();
  } catch (err) {
    console.warn('Falling back to default settings:', err);
    return defaultSettings();
  }
}

export function saveSettings(settings) {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function applySettingsToGame(game) {
  game.settings = normalizeSettings(game.settings);
  game.input.binds = clone(game.settings.keyboardBinds);
  game.input.gamepadBinds = clone(game.settings.gamepadBinds);
  game.input.useController = game.settings.controllerEnabled;
  game.input.listeningFor = null;
  game.input.controllerBindAction = null;
  game.input.bindDeadline = 0;
  return game.settings;
}

export function syncSettingsFromInput(game) {
  game.settings = normalizeSettings({
    ...game.settings,
    controllerEnabled: game.input.useController,
    keyboardBinds: game.input.binds,
    gamepadBinds: game.input.gamepadBinds
  });
  saveSettings(game.settings);
  return game.settings;
}

export function replaceSettings(game, json) {
  const parsed = JSON.parse(json);
  const normalized = normalizeSettings(parsed);
  game.settings = saveSettings(normalized);
  applySettingsToGame(game);
  return game.settings;
}

export function serializeSettings(game) {
  return JSON.stringify(normalizeSettings(game.settings), null, 2);
}
