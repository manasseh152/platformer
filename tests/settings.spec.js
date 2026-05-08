import { expect, test } from '@playwright/test';
import { applySettingsToGame, defaultSettings, saveSettings, syncSettingsFromInput } from '../src/settings.js';
import { createInputState } from '../src/input.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function gameWithSettings(settings = defaultSettings()) {
  return {
    settings,
    input: createInputState(),
    runtime: { now: () => 0 }
  };
}

test('app settings persist structured input as source of truth', () => {
  const storage = memoryStorage();
  const saved = saveSettings({
    schemaVersion: 1,
    motion: 'on',
    developerMode: true,
    controllerEnabled: false,
    keyboardBinds: { left: ['KeyQ'], right: ['KeyE'], jump: ['Space'], dash: ['ShiftLeft'], attack: ['KeyJ'], pause: ['Escape'], restart: ['KeyR'] },
    gamepadBinds: { left: ['PadButton14'], right: ['PadButton15'], jump: ['PadButton0'], dash: ['PadButton5'], attack: ['PadButton2'], pause: ['PadButton9'], restart: ['PadButton8'] }
  }, storage);

  expect(saved.schemaVersion).toBe(2);
  expect(saved.input.bindings['player.moveX']).toBeTruthy();
  expect(saved).not.toHaveProperty('keyboardBinds');
  expect(saved.input.slots.player1.devices.gamepad.enabled).toBe(false);
  expect(storage.getItem('chibi.settings')).toContain('"input"');
  expect(storage.getItem('chibi.settings')).not.toContain('keyboardBinds');
});

test('transitional bind UI sync keeps both move directions in semantic axis binding', () => {
  const storage = memoryStorage();
  const game = gameWithSettings();
  applySettingsToGame(game);

  game.input.binds.left = ['KeyQ'];
  game.input.binds.right = ['KeyE'];
  syncSettingsFromInput(game, storage);

  const moveX = game.settings.input.bindings['player.moveX'];
  expect(moveX).toEqual(expect.arrayContaining([
    expect.objectContaining({ deviceType: 'keyboard', code: 'KeyQ', scale: -1 }),
    expect.objectContaining({ deviceType: 'keyboard', code: 'KeyE', scale: 1 })
  ]));
});
