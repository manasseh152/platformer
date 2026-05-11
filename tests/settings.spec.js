import { expect, test } from '@playwright/test';
import { applySettingsToGame, defaultSettings, saveSettings, syncSettingsFromInput } from '#/app/settings/settings.js';
import { createInputState } from '#/app/input/input-ui-state.js';
import { commitBindRow, resetBindRowsToDefaults } from '#/app/input/semantic-bind-rows.js';

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

test('semantic bind rows update one move direction without legacy bind state', () => {
  const game = gameWithSettings();
  applySettingsToGame(game);

  const result = commitBindRow(game.settings, 'left', { deviceType: 'keyboard', control: 'key', code: 'KeyQ' }, { device: 'keyboard' });

  expect(result.ok).toBe(true);
  expect(result.settings.input.bindings['player.moveX']).toEqual(expect.arrayContaining([
    expect.objectContaining({ deviceType: 'keyboard', code: 'KeyQ', scale: -1 }),
    expect.objectContaining({ deviceType: 'keyboard', code: 'KeyD', scale: 1 })
  ]));
  expect(result.settings.input.bindings['player.moveX']).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ deviceType: 'keyboard', code: 'KeyA', scale: -1 })
  ]));
});

test('semantic bind rows reject cross-action duplicate bindings and reset by device', () => {
  const game = gameWithSettings();
  applySettingsToGame(game);

  const conflict = commitBindRow(game.settings, 'jump', { deviceType: 'keyboard', control: 'key', code: 'KeyJ' }, { device: 'keyboard' });
  expect(conflict).toMatchObject({ ok: false, conflict: { rowId: 'attack', label: 'Attack' } });

  const changed = commitBindRow(game.settings, 'jump', { deviceType: 'keyboard', control: 'key', code: 'KeyQ' }, { device: 'keyboard' }).settings;
  const reset = resetBindRowsToDefaults(changed, 'keyboard');
  expect(reset.input.bindings['player.jump']).toEqual(expect.arrayContaining([
    expect.objectContaining({ deviceType: 'keyboard', code: 'Space' })
  ]));
  expect(reset.input.bindings['player.jump']).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ deviceType: 'keyboard', code: 'KeyQ' })
  ]));
});
