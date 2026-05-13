import { commitBindRow, bindLabel } from './semantic-bind-rows.js';
import { gamepadLabel } from './input-hints.js';
import { saveSettings } from '../settings/settings.js';
import { createBrowserInputAdapter, createGameInputRuntime } from './browser-input-adapter.js';
import { setInputScheme } from './input-presentation.js';

export function pollGamepads(runtime, game) {
  if (!game) {
    game = runtime;
    runtime = { now: () => performance.now() };
  }
  const { input } = game;
  input.gamepadPressed.clear();
  input.gamepadDown.clear();
  input.latestRawGamepadPressed = [];
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let firstPad = null;
  for (const pad of pads) {
    if (!pad) continue;
    firstPad ??= pad;
    const b = pad.buttons;
    const ax = pad.axes;

    for (let i = 0; i < b.length; i++) if (b[i]?.pressed) input.gamepadDown.add(`PadButton${i}`);
    for (let i = 0; i < ax.length; i++) {
      const value = ax[i] ?? 0;
      if (value < -.35) input.gamepadDown.add(`PadAxis${i}-`);
      if (value > .35) input.gamepadDown.add(`PadAxis${i}+`);
    }

    if ((ax[0] ?? 0) < -.35 || b[14]?.pressed) input.gamepadDown.add('PadLeft');
    if ((ax[0] ?? 0) > .35 || b[15]?.pressed) input.gamepadDown.add('PadRight');
    if ((ax[1] ?? 0) < -.35 || b[12]?.pressed) input.gamepadDown.add('PadUp');
    if ((ax[1] ?? 0) > .35 || b[13]?.pressed) input.gamepadDown.add('PadDown');
    if (b[0]?.pressed) input.gamepadDown.add('PadA');
    if (b[1]?.pressed) input.gamepadDown.add('PadB');
    if (b[2]?.pressed) input.gamepadDown.add('PadX');
    if (b[3]?.pressed) input.gamepadDown.add('PadY');
    if (b[4]?.pressed) input.gamepadDown.add('PadLB');
    if (b[5]?.pressed || b[7]?.pressed) input.gamepadDown.add('PadRB');
    if (b[6]?.pressed) input.gamepadDown.add('PadLT');
    if (b[7]?.pressed) input.gamepadDown.add('PadRT');
    if (b[8]?.pressed) input.gamepadDown.add('PadBack');
    if (b[9]?.pressed) input.gamepadDown.add('PadStart');
    if (b[10]?.pressed) input.gamepadDown.add('PadLS');
    if (b[11]?.pressed) input.gamepadDown.add('PadRS');
    if (b[16]?.pressed) input.gamepadDown.add('PadGuide');
    if (b[17]?.pressed) input.gamepadDown.add('PadShare');
  }
  for (const code of input.gamepadDown) if (!input.previousGamepadDown.has(code)) input.gamepadPressed.add(code);
  input.latestRawGamepadPressed = [...input.gamepadPressed].filter(code => code.startsWith('PadButton') || code.startsWith('PadAxis'));
  if (input.gamepadPressed.size) setInputScheme(game, 'gamepad');
  input.previousGamepadDown.clear();
  for (const code of input.gamepadDown) input.previousGamepadDown.add(code);
  updateControllerDebug(runtime, game, firstPad);
}

export function updateControllerDebug(runtime, game, pad) {
  if (!pad && game?.input === undefined) {
    pad = game;
    game = runtime;
    runtime = { now: () => performance.now() };
  }
  const { input, ui } = game;
  if (!ui.controllerName) return;
  ui.controllerName.textContent = pad ? `${pad.id} (${pad.mapping || 'unknown mapping'})` : 'None detected';
  if (ui.selectedControllerName && !ui.selectedControllerName.querySelector?.('[data-controller-select]')) {
    const selected = game.settings?.input?.slots?.player1?.devices?.gamepad?.selectedRuntimeId;
    ui.selectedControllerName.textContent = selected || (pad ? 'Auto / not selected' : 'Auto / none connected');
  }
  const rawDown = [...input.gamepadDown].filter(code => code.startsWith('PadButton') || code.startsWith('PadAxis'));
  ui.controllerInputs.textContent = rawDown.length ? rawDown.join(', ') : 'None';
  updateControllerDebugger(ui, pad, input.gamepadDown, input.controllerDebugLock);
  if (input.controllerDebugLock) return;
  if (input.controllerBindAction && input.latestRawGamepadPressed.length) {
    const action = input.controllerBindAction;
    const code = input.latestRawGamepadPressed[0];
    const captured = input.bindCapture?.snapshot?.({ controls: [legacyGamepadControlForCapture(code)] });
    if (captured?.status === 'cancelled') {
      input.controllerBindAction = null;
      input.bindCapture = null;
      input.bindDeadline = 0;
      input.suppressMenuInputOnce = true;
      setBindStatus(ui, 'Listening cancelled.');
      return;
    }
    if (captured?.status === 'captured') return finishControllerBinding(runtime, game, action, legacyCodeFromGamepadBinding(captured.binding) || code);
    return finishControllerBinding(runtime, game, action, code);
  }
}

function updateControllerDebugger(ui, pad, gamepadDown, inputLocked = false) {
  const root = ui.settingsCategoryBody?.querySelector?.('.controller-debugger');
  if (!root) return;
  root.classList.toggle('is-connected', Boolean(pad));
  root.classList.toggle('is-input-locked', inputLocked);
  for (const el of root.querySelectorAll('[data-controller-debug-code]')) {
    const down = gamepadDown.has(el.dataset.controllerDebugCode);
    el.classList.toggle('is-active', down);
    el.setAttribute('aria-pressed', down ? 'true' : 'false');
  }
  const axisValue = axis => {
    if (axis === 6 || axis === 7) return pad?.axes?.[axis] ?? pad?.buttons?.[axis]?.value ?? 0;
    return pad?.axes?.[axis] ?? 0;
  };
  const snappedAxis = axis => {
    const value = axisValue(axis);
    return Math.abs(value) < .08 ? 0 : value;
  };
  root.style.setProperty('--stick-left-x', String(snappedAxis(0)));
  root.style.setProperty('--stick-left-y', String(snappedAxis(1)));
  root.style.setProperty('--stick-right-x', String(snappedAxis(2)));
  root.style.setProperty('--stick-right-y', String(snappedAxis(3)));
  for (const el of root.querySelectorAll('[data-controller-debug-axis]')) {
    const axis = Number(el.dataset.controllerDebugAxis);
    const snapped = snappedAxis(axis);
    el.style.setProperty('--axis-value', String(snapped));
    el.classList.toggle('is-active', Math.abs(snapped) > .35);
    const valueEl = root.querySelector(`[data-controller-axis-value="${axis}"]`);
    if (valueEl) valueEl.textContent = snapped.toFixed(2);
  }
}

function legacyGamepadControlForCapture(code) {
  const button = /^PadButton(\d+)$/.exec(code);
  if (button) return { type: 'button', index: Number(button[1]), value: 1 };
  const axis = /^PadAxis(\d)([+-])$/.exec(code);
  if (axis) return { type: 'axis', index: Number(axis[1]), value: axis[2] === '+' ? 1 : -1 };
  return { type: 'unknown', value: 0 };
}

function legacyCodeFromGamepadBinding(binding) {
  if (binding?.deviceType !== 'gamepad') return null;
  if (binding.control === 'button') return `PadButton${binding.index}`;
  if (binding.control === 'axisDirection') return `PadAxis${binding.index}${binding.direction < 0 ? '-' : '+'}`;
  return null;
}

function bindingFromLegacyGamepadCode(code) {
  const button = /^PadButton(\d+)$/.exec(code);
  if (button) return { deviceType: 'gamepad', control: 'button', index: Number(button[1]) };
  const axis = /^PadAxis(\d)([+-])$/.exec(code);
  if (axis) return { deviceType: 'gamepad', control: 'axisDirection', index: Number(axis[1]), direction: axis[2] === '+' ? 1 : -1, threshold: 0.35 };
  return null;
}

function controllerName(code) {
  return gamepadLabel(bindingFromLegacyGamepadCode(code) || {}) || code;
}

function finishControllerBinding(runtime, game, action, code) {
  const { input, ui } = game;
  const binding = bindingFromLegacyGamepadCode(code);
  const result = commitBindRow(game.settings, action, binding, { device: 'controller', profileId: game.input.bindProfileId || 'controller', mode: game.input.bindMode || 'replace' });
  if (!result.ok) {
    input.bindError = { device: 'controller', action, until: runtime.now() + 1800 };
    const message = `${controllerName(code)} is already bound to ${result.conflict.label}.`;
    setBindStatus(ui, message, true);
    setControllerStatus(ui, message, true);
    return;
  }
  game.settings = saveSettings(result.settings, runtime.storage);
  game.inputRuntime = createGameInputRuntime(game.settings);
  game.inputAdapter = createBrowserInputAdapter(game.inputRuntime, { now: game.runtime?.now || runtime.now });
  input.controllerBindAction = null;
  input.bindMode = 'replace';
  input.bindProfileId = null;
  input.bindCapture = null;
  input.bindDeadline = 0;
  input.suppressMenuInputOnce = true;
  const message = `${bindLabel(action)} bound to ${controllerName(code)}.`;
  setBindStatus(ui, message);
  setControllerStatus(ui, message);
}

export function setBindStatus(ui, message, error = false) {
  const el = ui.bindStatus || ui.settingsStatus;
  if (!el) return;
  el.textContent = message;
  el.style.color = error ? '#ff9ebc' : '#9ef7ff';
}

export function setControllerStatus(ui, message, error = false) {
  if (!ui.controllerStatus) return;
  ui.controllerStatus.textContent = message;
  ui.controllerStatus.style.color = error ? '#ff9ebc' : '#9ef7ff';
}
