import { expect, test } from '@playwright/test';
import { gameInputProfile } from '#/app/input/game-input-profile.js';
import { applyCapturedBinding, createBindCapture, createInputRuntime, findBindingConflict, normalizeInputSettings } from '#/core/input/index.js';
import { hintPartsForAction, textHintForAction } from '#/app/input/input-hints.js';
import { renderTabInputHints } from '#/app/input/input-presentation.js';
import { rowHintParts } from '#/app/input/semantic-bind-rows.js';

function key(runtime, type, code, modifiers = {}) {
  runtime.handleEvent({ type, device: { type: 'keyboard', id: 'keyboard' }, control: { type: 'key', code }, timestamp: runtime.state.frame, modifiers });
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

test('press edges survive down and up events queued in the same frame', () => {
  const input = createInputRuntime(gameInputProfile);

  input.beginFrame();
  key(input, 'control-down', 'Escape');
  key(input, 'control-up', 'Escape');

  expect(input.wasPressed('system.pause')).toBe(true);
  expect(input.isDown('system.pause')).toBe(false);
  expect(input.wasReleased('system.pause')).toBe(true);
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

test('axis actions press when crossing the effective deadzone threshold', () => {
  const input = createInputRuntime(gameInputProfile);

  input.beginFrame();
  gamepad(input, [{ type: 'axis', index: 1, value: 0.2 }]);
  expect(input.route(['menu']).wasPressed('menu.navigateY')).toBe(false);

  input.beginFrame();
  gamepad(input, [{ type: 'axis', index: 1, value: 0.7 }]);
  expect(input.route(['menu']).wasPressed('menu.navigateY')).toBe(true);
  expect(input.route(['menu']).value('menu.navigateY')).toBeGreaterThan(0);
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

test('global devtools pause can consume KeyP before gameplay pause sees it', () => {
  const input = createInputRuntime(gameInputProfile);

  input.beginFrame();
  key(input, 'control-down', 'KeyP');

  const global = input.route(['global'], 'player1');
  const gameplay = input.route(['gameplay'], 'player1');

  expect(global.wasPressed('devtools.pause')).toBe(true);
  expect(gameplay.wasPressed('system.pause')).toBe(true);

  global.consume('devtools.pause');

  expect(global.wasPressed('devtools.pause')).toBe(false);
  expect(gameplay.wasPressed('system.pause')).toBe(false);
});

test('editor tab actions default to gamepad shoulder buttons', () => {
  const input = createInputRuntime(gameInputProfile);

  input.beginFrame();
  gamepad(input, [
    { type: 'button', index: 4, value: 1 },
    { type: 'button', index: 5, value: 0 }
  ]);
  expect(input.route(['editor']).wasPressed('editor.previousTab')).toBe(true);
  expect(input.route(['editor']).wasPressed('editor.nextTab')).toBe(false);

  input.beginFrame();
  gamepad(input, [
    { type: 'button', index: 4, value: 0 },
    { type: 'button', index: 5, value: 1 }
  ]);
  expect(input.route(['editor']).wasPressed('editor.nextTab')).toBe(true);
});

test('keyboard combo bindings require declared modifiers', () => {
  const input = createInputRuntime(gameInputProfile);

  input.beginFrame();
  key(input, 'control-down', 'KeyS');
  expect(input.route(['editor']).wasPressed('editor.save')).toBe(false);

  input.beginFrame();
  key(input, 'control-up', 'KeyS');
  key(input, 'control-down', 'KeyS', { ctrl: true });
  expect(input.route(['editor']).wasPressed('editor.save')).toBe(true);

  input.beginFrame();
  key(input, 'control-up', 'KeyS', { ctrl: true });
  key(input, 'control-down', 'KeyZ', { ctrl: true, shift: true });
  const editor = input.route(['editor']);
  expect(editor.wasPressed('editor.redo')).toBe(true);
  expect(editor.wasPressed('editor.undo')).toBe(false);
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

test('input hints derive controls from semantic bindings and explicit input scheme', () => {
  const { settings } = normalizeInputSettings(gameInputProfile, {});
  const input = createInputRuntime(gameInputProfile, settings);

  expect(textHintForAction(gameInputProfile, settings, 'menu.settings', { inputScheme: 'wasd' })).toBe('Tab Settings');
  expect(hintPartsForAction(gameInputProfile, settings, 'player.moveX', { inputScheme: 'arrows', axisScale: -1 }).parts.map(part => part.label)).toEqual(['←']);

  input.beginFrame();
  gamepad(input, [{ type: 'button', index: 3, value: 1 }]);
  expect(input.wasPressed('menu.settings')).toBe(true);
  expect(hintPartsForAction(gameInputProfile, settings, 'menu.settings', { runtime: input, inputScheme: 'gamepad', iconPack: 'xbox' }).parts[0]).toMatchObject({ label: 'Y', icon: '/assets/kenney-input-prompts/xbox/xbox_button_y.svg' });
  expect(hintPartsForAction(gameInputProfile, settings, 'player.dash', { runtime: input, inputScheme: 'gamepad', iconPack: 'xbox' }).parts.map(part => part.icon)).toEqual([
    '/assets/kenney-input-prompts/xbox/xbox_rb.svg',
    '/assets/kenney-input-prompts/xbox/xbox_rt.svg'
  ]);
  expect(hintPartsForAction(gameInputProfile, settings, 'menu.navigateY', { runtime: input, inputScheme: 'gamepad', iconPack: 'xbox' }).parts.map(part => part.icon)).toEqual([
    '/assets/kenney-input-prompts/xbox/xbox_stick_l_vertical.svg',
    '/assets/kenney-input-prompts/xbox/xbox_dpad_up.svg'
  ]);
  expect(rowHintParts(settings, 'left', 'controller', { iconPack: 'xbox' }).map(part => part.icon)).toEqual([
    '/assets/kenney-input-prompts/xbox/xbox_stick_l_left.svg',
    '/assets/kenney-input-prompts/xbox/xbox_dpad_left.svg'
  ]);
  expect(rowHintParts(settings, 'right', 'controller', { iconPack: 'xbox' }).map(part => part.icon)).toEqual([
    '/assets/kenney-input-prompts/xbox/xbox_stick_l_right.svg',
    '/assets/kenney-input-prompts/xbox/xbox_dpad_right.svg'
  ]);
  expect(hintPartsForAction(gameInputProfile, settings, 'menu.settings', { runtime: input, inputScheme: 'wasd', iconPack: 'xbox' }).parts[0]).toMatchObject({ label: 'Tab', icon: '/assets/kenney-input-prompts/keyboard/keyboard_tab.svg' });
  expect(rowHintParts(settings, 'jump', 'keyboard', { iconPack: 'xbox' }).map(part => part.icon)).toEqual([
    '/assets/kenney-input-prompts/keyboard/keyboard_w.svg',
    '/assets/kenney-input-prompts/keyboard/keyboard_space.svg',
    '/assets/kenney-input-prompts/keyboard/keyboard_arrow_up.svg'
  ]);
  expect(rowHintParts(settings, 'dash', 'keyboard', { iconPack: 'xbox' }).map(part => part.icon)).toEqual([
    '/assets/kenney-input-prompts/keyboard/keyboard_shift.svg',
    '/assets/kenney-input-prompts/keyboard/keyboard_shift.svg',
    '/assets/kenney-input-prompts/keyboard/keyboard_k.svg'
  ]);
});

test('tab input hints only display when controller input is active', () => {
  const { settings } = normalizeInputSettings(gameInputProfile, {});
  const input = createInputRuntime(gameInputProfile, settings);
  input.beginFrame();
  gamepad(input, [{ type: 'button', index: 4, value: 1 }]);

  const hintEl = { dataset: { inputAction: 'menu.previousTab' }, hidden: true, innerHTML: '' };
  const root = { querySelectorAll: selector => selector === '[data-input-tab-hint]' ? [hintEl] : [] };

  renderTabInputHints({ inputScheme: 'wasd' }, root, { profile: gameInputProfile, settings, runtime: input });
  expect(hintEl.hidden).toBe(true);

  expect(input.wasPressed('menu.previousTab')).toBe(true);
  renderTabInputHints({ inputScheme: 'wasd' }, root, { profile: gameInputProfile, settings, runtime: input });
  expect(hintEl.hidden).toBe(false);
  expect(hintEl.innerHTML).toContain('LB');

  renderTabInputHints({ inputScheme: 'wasd' }, root, { profile: gameInputProfile, settings, runtime: input, consoleActive: false });
  expect(hintEl.hidden).toBe(true);
});

test('bind capture captures keyboard bindings, supports cancel, and prevents duplicates', () => {
  const capture = createBindCapture({ actionId: 'player.jump', deviceType: 'keyboard', cancelBindings: [{ deviceType: 'keyboard', control: 'key', code: 'Escape' }] });
  expect(capture.event({ code: 'Escape' })).toMatchObject({ status: 'cancelled', reason: 'user' });

  const second = createBindCapture({ actionId: 'player.jump', deviceType: 'keyboard' });
  const result = second.event({ code: 'KeyJ', modifiers: { shift: false } });
  expect(result).toEqual({ status: 'captured', actionId: 'player.jump', binding: { deviceType: 'keyboard', control: 'key', code: 'KeyJ' } });

  const { settings } = normalizeInputSettings(gameInputProfile, {});
  expect(findBindingConflict(settings, 'player.jump', { deviceType: 'keyboard', control: 'key', code: 'KeyJ' })).toMatchObject({ actionId: 'player.attack' });
  expect(applyCapturedBinding(settings, 'player.jump', result.binding).ok).toBe(false);
});

test('bind capture captures gamepad buttons and axis directions', () => {
  const button = createBindCapture({ actionId: 'player.dash', deviceType: 'gamepad' });
  expect(button.snapshot({ controls: [{ type: 'button', index: 5, value: 1 }] })).toMatchObject({ status: 'captured', binding: { deviceType: 'gamepad', control: 'button', index: 5 } });

  const axis = createBindCapture({ actionId: 'player.moveX', deviceType: 'gamepad' });
  expect(axis.snapshot({ threshold: 0.35, controls: [{ type: 'axis', index: 0, value: -0.8 }] })).toMatchObject({ status: 'captured', binding: { deviceType: 'gamepad', control: 'axisDirection', index: 0, direction: -1, threshold: 0.35 } });
});

test('explicit controller selection persists runtime/fingerprint and avoids silent switching after disconnect', () => {
  const { settings } = normalizeInputSettings(gameInputProfile, {});
  const input = createInputRuntime(gameInputProfile, settings);

  input.beginFrame();
  gamepad(input, [{ type: 'button', index: 0, value: 0 }], 'gamepad:0');
  input.updateDeviceSnapshot({ device: { type: 'gamepad', runtimeId: 'gamepad:1', id: 'other', fingerprint: 'other' }, controls: [{ type: 'button', index: 0, value: 0 }] });

  expect(input.selectGamepad('player1', 'gamepad:0')).toMatchObject({ ok: true });
  expect(input.settings.input.slots.player1.devices.gamepad).toMatchObject({ selectedRuntimeId: 'gamepad:0', selectedFingerprint: 'pad' });

  input.unregisterDevice('gamepad:0');
  input.beginFrame();
  input.updateDeviceSnapshot({ device: { type: 'gamepad', runtimeId: 'gamepad:1', id: 'other', fingerprint: 'other' }, controls: [{ type: 'button', index: 0, value: 1 }] });
  expect(input.wasPressed('player.jump')).toBe(false);
});
