/**
 * Application-layer settings adapter over `src/core/settings.js`.
 * Owns persistence and mutation of the compatibility game object; schema rules live in core.
 */
import { clone } from './core/input.js';
import { defaultSettings, normalizeSettings } from './core/settings.js';
import { browserRuntime } from './runtime.js';
import { createBrowserInputAdapter, createGameInputRuntime } from './app/input/browser-input-adapter.js';

export { defaultSettings, normalizeSettings };

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
  game.input.binds = clone(game.settings.keyboardBinds);
  game.input.gamepadBinds = clone(game.settings.gamepadBinds);
  game.input.useController = game.settings.controllerEnabled;
  game.input.listeningFor = null;
  game.input.controllerBindAction = null;
  game.input.bindDeadline = 0;
  game.inputRuntime = createGameInputRuntime(game.settings);
  game.inputAdapter = createBrowserInputAdapter(game.inputRuntime, { now: game.runtime?.now || browserRuntime.now });
  return game.settings;
}

export function syncSettingsFromInput(game, storage = browserRuntime.storage) {
  game.settings = normalizeSettings({ ...game.settings, controllerEnabled: game.input.useController, keyboardBinds: game.input.binds, gamepadBinds: game.input.gamepadBinds });
  saveSettings(game.settings, storage);
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
