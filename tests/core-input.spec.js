import { expect, test } from '@playwright/test';
import { gameInputProfile } from '../src/app/input/game-input-profile.js';
import { createInputRuntime, normalizeInputSettings } from '../src/core/input/index.js';

function key(runtime, type, code) {
  runtime.handleEvent({ type, device: { type: 'keyboard', id: 'keyboard' }, control: { type: 'key', code }, timestamp: runtime.state.frame });
}

function gamepad(runtime, controls, runtimeId = 'gamepad:0') {
  runtime.updateDeviceSnapshot({ device: { type: 'gamepad', runtimeId, id: runtimeId, fingerprint: 'pad' }, controls });
}

test('keyboard actions expose press, down, release across explicit frames', () => {
  const input = createInputRuntime(gameInputProfile);

  input.beginFrame();
  key(input, 'control-down', 'Space');

  expect(input.wasPressed('player.jump')).toBe(true);
  expect(input.isDown('player.jump')).toBe(true);
  expect(input.wasReleased('player.jump')).toBe(false);

  input.beginFrame();
  expect(input.wasPressed('player.jump')).toBe(false);
  expect(input.isDown('player.jump')).toBe(true);

  key(input, 'control-up', 'Space');
  expect(input.wasReleased('player.jump')).toBe(true);
  expect(input.isDown('player.jump')).toBe(false);
});

test('gamepad buttons and selected runtime id drive assigned player slot', () => {
  const { settings } = normalizeInputSettings(gameInputProfile, {});
  settings.input.slots.player1.devices.gamepad.selectedRuntimeId = 'gamepad:1';
  const input = createInputRuntime(gameInputProfile, settings);

  input.beginFrame();
  gamepad(input, [{ type: 'button', index: 0, value: 1 }], 'gamepad:0');
  expect(input.wasPressed('player.jump')).toBe(false);

  gamepad(input, [{ type: 'button', index: 0, value: 1 }], 'gamepad:1');
  expect(input.wasPressed('player.jump')).toBe(true);
  expect(input.isDown('player.jump')).toBe(true);
});

test('gamepad axis values apply deadzone and merge with digital fallback', () => {
  const input = createInputRuntime(gameInputProfile);

  input.beginFrame();
  gamepad(input, [{ type: 'axis', index: 0, value: 0.2 }]);
  expect(input.value('player.moveX')).toBe(0);

  gamepad(input, [{ type: 'axis', index: 0, value: 0.675 }]);
  expect(input.value('player.moveX')).toBeCloseTo(0.5, 4);

  key(input, 'control-down', 'KeyA');
  expect(input.value('player.moveX')).toBe(-1);

  key(input, 'control-down', 'KeyD');
  expect(input.value('player.moveX')).toBe(0);
});

test('context routing can consume shared source edges before lower-priority actions see them', () => {
  const input = createInputRuntime(gameInputProfile);

  input.beginFrame();
  key(input, 'control-down', 'Space');

  const menu = input.route(['menu'], 'player1');
  const gameplay = input.route(['gameplay'], 'player1');

  expect(menu.wasPressed('menu.accept')).toBe(true);
  expect(gameplay.wasPressed('player.jump')).toBe(true);

  menu.consume('menu.accept');

  expect(menu.wasPressed('menu.accept')).toBe(false);
  expect(gameplay.wasPressed('player.jump')).toBe(false);
  expect(gameplay.isDown('player.jump')).toBe(true);
});

test('v1 keyboard and gamepad settings migrate to semantic structured input settings', () => {
  const { settings, warnings } = normalizeInputSettings(gameInputProfile, {
    schemaVersion: 1,
    keyboardBinds: { left: ['KeyQ'], right: ['KeyE'], jump: ['Space'], unknown: ['KeyU'] },
    gamepadBinds: { jump: ['PadButton0'], dash: ['PadButton7'] }
  });

  expect(settings.schemaVersion).toBe(2);
  expect(settings.input.bindings['player.moveX']).toContainEqual({ deviceType: 'keyboard', control: 'key', code: 'KeyQ', scale: -1 });
  expect(settings.input.bindings['player.moveX']).toContainEqual({ deviceType: 'keyboard', control: 'key', code: 'KeyE', scale: 1 });
  expect(settings.input.bindings['player.jump']).toContainEqual({ deviceType: 'gamepad', control: 'button', index: 0 });
  expect(settings.input.bindings.left).toBeUndefined();
  expect(warnings).toContainEqual({ path: 'input.legacy.unknown', code: 'unknown-legacy-action-stripped' });
});

test('normalization strips unknown actions, resets malformed bindings, and prevents no-input lockout', () => {
  const { settings, warnings } = normalizeInputSettings(gameInputProfile, {
    input: {
      slots: { player1: { devices: { keyboard: { enabled: false }, gamepad: { enabled: false } } } },
      bindings: {
        'player.jump': [{ deviceType: 'keyboard', control: 'key' }],
        'old.left': [{ deviceType: 'keyboard', control: 'key', code: 'KeyA' }]
      }
    }
  });

  expect(settings.input.slots.player1.devices.keyboard.enabled).toBe(true);
  expect(settings.input.bindings['old.left']).toBeUndefined();
  expect(settings.input.bindings['player.jump']).toEqual(gameInputProfile.defaultBindings['player.jump']);
  expect(warnings.map(warning => warning.code)).toEqual(expect.arrayContaining([
    'keyboard-reenabled-to-avoid-lockout',
    'invalid-bindings-reset',
    'unknown-action-stripped'
  ]));
});

test('last active source records display group from the binding that triggered input', () => {
  const input = createInputRuntime(gameInputProfile);

  input.beginFrame();
  key(input, 'control-down', 'ArrowRight');

  expect(input.value('player.moveX')).toBe(1);
  expect(input.lastActiveSource('player1')).toMatchObject({ deviceType: 'keyboard', deviceId: 'keyboard', displayGroup: 'arrows' });
});
