import { createInputRuntime } from '../../core/input/index.js';
import { normalizeInputSettings } from '../../core/input/settings.js';
import { gameInputProfile } from './game-input-profile.js';

function inputSettingsFromAppSettings(settings = {}) {
  return normalizeInputSettings(gameInputProfile, settings).settings;
}

export function createGameInputRuntime(settings = {}) {
  return createInputRuntime(gameInputProfile, inputSettingsFromAppSettings(settings));
}

export function createBrowserInputAdapter(inputRuntime, { now = () => globalThis.performance?.now?.() ?? Date.now(), gamepads = () => globalThis.navigator?.getGamepads?.() || [] } = {}) {
  const queuedEvents = [];
  const connectedGamepadRuntimeIds = new Set();

  function queueKeyboardEvent(event) {
    queuedEvents.push({
      type: event.type === 'keyup' ? 'keyup' : 'keydown',
      code: event.code,
      repeat: Boolean(event.repeat),
      timestamp: event.timeStamp || now(),
      device: { type: 'keyboard', id: 'keyboard' },
      control: { type: 'key', code: event.code },
      modifiers: { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey }
    });
  }

  function syncControllerEnabled(enabled) {
    const slot = inputRuntime.settings.input.slots.player1;
    slot.devices.gamepad.enabled = enabled !== false;
  }

  function pollGamepads() {
    const seen = new Set();
    for (const pad of gamepads() || []) {
      if (!pad) continue;
      const runtimeId = `gamepad:${pad.index}`;
      seen.add(runtimeId);
      inputRuntime.updateDeviceSnapshot({
        timestamp: now(),
        device: {
          type: 'gamepad',
          runtimeId,
          index: pad.index,
          id: pad.id,
          mapping: pad.mapping || '',
          fingerprint: `${pad.id || 'unknown'}|${pad.mapping || 'unknown'}|${pad.buttons?.length || 0}|${pad.axes?.length || 0}`
        },
        controls: [
          ...Array.from(pad.buttons || [], (button, index) => ({ type: 'button', index, value: button?.pressed ? 1 : 0 })),
          ...Array.from(pad.axes || [], (value, index) => ({ type: 'axis', index, value: Number(value) || 0 }))
        ]
      });
    }
    for (const runtimeId of connectedGamepadRuntimeIds) {
      if (!seen.has(runtimeId)) inputRuntime.unregisterDevice?.(runtimeId);
    }
    connectedGamepadRuntimeIds.clear();
    for (const runtimeId of seen) connectedGamepadRuntimeIds.add(runtimeId);
  }

  function beginFrame({ controllerEnabled = true } = {}) {
    syncControllerEnabled(controllerEnabled);
    inputRuntime.beginFrame();
    for (const event of queuedEvents.splice(0)) inputRuntime.handleEvent(event);
    pollGamepads();
  }

  return { queueKeyboardEvent, beginFrame, syncControllerEnabled, pollGamepads };
}
