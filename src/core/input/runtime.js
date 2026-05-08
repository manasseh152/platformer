import { bindingKey, controlKey, normalizeAxisValue } from './utils.js';
import { defaultInputSettings, normalizeInputSettings } from './settings.js';

const KEYBOARD_ID = 'keyboard';

export function createInputRuntime(profile, candidateSettings = defaultInputSettings(profile)) {
  const normalized = candidateSettings.input ? { settings: candidateSettings, warnings: [] } : normalizeInputSettings(profile, candidateSettings);
  const settings = normalized.settings;
  const state = {
    frame: 0,
    controls: new Map(),
    previousControls: new Map(),
    edges: [],
    consumedSources: new Set(),
    lastActiveSource: {},
    devices: new Map()
  };

  function beginFrame() {
    state.frame++;
    state.edges = [];
    state.consumedSources.clear();
    state.previousControls = new Map(state.controls);
  }

  function slotConfig(slot = 'player1') {
    return settings.input.slots[slot] || settings.input.slots.player1;
  }

  function assignedGamepadRuntimeId(slot = 'player1') {
    const gamepad = slotConfig(slot).devices.gamepad;
    if (!gamepad.enabled) return null;
    if (gamepad.selectedRuntimeId) return gamepad.selectedRuntimeId;
    const first = [...state.devices.values()].find(device => device.type === 'gamepad');
    return first?.runtimeId || null;
  }

  function deviceAllowed(binding, slot = 'player1') {
    const devices = slotConfig(slot).devices;
    if (binding.deviceType === 'keyboard') return devices.keyboard.enabled ? KEYBOARD_ID : null;
    if (binding.deviceType === 'gamepad') return assignedGamepadRuntimeId(slot);
    return binding.deviceId || binding.deviceType;
  }

  function rememberActive(slot, binding, deviceId) {
    state.lastActiveSource[slot] = { deviceType: binding.deviceType, deviceId, displayGroup: binding.displayGroup || null };
  }

  function setControl(device, control, value, timestamp = 0, meta = {}) {
    const deviceId = device.id || (device.type === 'keyboard' ? KEYBOARD_ID : device.runtimeId || device.type);
    const key = controlKey(deviceId, control);
    const previous = state.controls.get(key) || 0;
    const next = Math.max(-1, Math.min(1, Number(value) || 0));
    if (next === 0) state.controls.delete(key); else state.controls.set(key, next);
    const wasDown = Math.abs(previous) > 0;
    const isDown = Math.abs(next) > 0;
    if (wasDown !== isDown) state.edges.push({ id: `${state.frame}:${state.edges.length}`, sourceKey: key, type: isDown ? 'press' : 'release', value: next, timestamp, control, device: { ...device, id: deviceId }, meta });
  }

  function handleEvent(event) {
    const device = event.device || { type: 'keyboard', id: KEYBOARD_ID };
    const control = event.control || (event.code ? { type: 'key', code: event.code } : null);
    if (!control) return;
    const value = event.type === 'control-up' || event.type === 'keyup' ? 0 : 1;
    setControl(device, control, value, event.timestamp, { modifiers: event.modifiers || {} });
  }

  function updateDeviceSnapshot(snapshot) {
    const device = snapshot.device || {};
    const runtimeId = device.runtimeId || device.id || `gamepad:${device.index ?? 0}`;
    const meta = { ...device, type: device.type || 'gamepad', runtimeId, id: runtimeId };
    state.devices.set(runtimeId, meta);
    for (const control of snapshot.controls || []) {
      const normalized = control.type === 'button'
        ? { type: 'button', index: control.index }
        : control.type === 'axis'
          ? { type: 'axis', index: control.index }
          : control;
      setControl(meta, normalized, control.value, snapshot.timestamp);
    }
  }

  function bindingValue(binding, slot = 'player1') {
    const deviceId = deviceAllowed(binding, slot);
    if (!deviceId) return { value: 0, sourceKey: null, deviceId: null };
    const key = bindingKey(binding, deviceId);
    let raw = state.controls.get(key) || 0;
    if (binding.deviceType === 'gamepad' && binding.control === 'axis') {
      raw = normalizeAxisValue(raw, settings.input.gamepad.defaultDeadzone);
      if (binding.invert) raw *= -1;
      return { value: raw, sourceKey: key, deviceId };
    }
    if (binding.deviceType === 'gamepad' && binding.control === 'axisDirection') {
      const direction = binding.direction || 1;
      const threshold = binding.threshold ?? settings.input.gamepad.defaultDeadzone;
      const active = raw * direction > threshold;
      return { value: active ? (binding.scale ?? 1) : 0, sourceKey: key, deviceId };
    }
    if (Math.abs(raw) <= 0) return { value: 0, sourceKey: key, deviceId };
    return { value: binding.scale ?? 1, sourceKey: key, deviceId };
  }

  function actionBindings(actionId) { return settings.input.bindings[actionId] || []; }
  function actionDef(actionId) { return profile.actions[actionId] || { kind: 'button' }; }

  function value(actionId, options = {}) {
    const slot = options.slot || 'player1';
    const values = [];
    for (const binding of actionBindings(actionId)) {
      const resolved = bindingValue(binding, slot);
      if (resolved.value !== 0) {
        values.push(resolved.value);
        rememberActive(slot, binding, resolved.deviceId);
      }
    }
    if (!values.length) return 0;
    const positive = values.some(v => v > 0);
    const negative = values.some(v => v < 0);
    const digitalPositive = values.includes(1);
    const digitalNegative = values.includes(-1);
    if (digitalPositive && digitalNegative) return 0;
    return values.reduce((best, candidate) => Math.abs(candidate) > Math.abs(best) ? candidate : best, 0);
  }

  function isDown(actionId, options = {}) {
    const def = actionDef(actionId);
    return def.kind === 'axis1d' ? value(actionId, options) !== 0 : actionBindings(actionId).some(binding => bindingValue(binding, options.slot || 'player1').value !== 0);
  }

  function matchingEdges(actionId, type, options = {}) {
    const slot = options.slot || 'player1';
    const sourceKeys = new Set(actionBindings(actionId).map(binding => {
      const deviceId = deviceAllowed(binding, slot);
      return deviceId ? bindingKey(binding, deviceId) : null;
    }).filter(Boolean));
    return state.edges.filter(edge => edge.type === type && sourceKeys.has(edge.sourceKey) && !state.consumedSources.has(edge.sourceKey));
  }

  function wasPressed(actionId, options = {}) { return matchingEdges(actionId, 'press', options).length > 0; }
  function wasReleased(actionId, options = {}) { return matchingEdges(actionId, 'release', options).length > 0; }

  function consume(actionId, options = {}) {
    const edges = [...matchingEdges(actionId, 'press', options), ...matchingEdges(actionId, 'release', options)];
    for (const edge of edges) state.consumedSources.add(edge.sourceKey);
    return edges.length > 0;
  }

  function route(contextIds = [], slot = 'player1') {
    const ordered = [...contextIds].sort((a, b) => (profile.contexts[b]?.priority || 0) - (profile.contexts[a]?.priority || 0));
    const allowed = new Set(ordered.flatMap(context => profile.contexts[context]?.actions || []));
    const guard = actionId => { if (allowed.size && !allowed.has(actionId)) return false; return true; };
    return {
      value: actionId => guard(actionId) ? value(actionId, { slot }) : 0,
      isDown: actionId => guard(actionId) && isDown(actionId, { slot }),
      wasPressed: actionId => guard(actionId) && wasPressed(actionId, { slot }),
      wasReleased: actionId => guard(actionId) && wasReleased(actionId, { slot }),
      consume: actionId => guard(actionId) && consume(actionId, { slot }),
      contexts: ordered
    };
  }

  function endFrame() { state.edges = []; state.consumedSources.clear(); }

  return { profile, settings, warnings: normalized.warnings, state, beginFrame, endFrame, handleEvent, updateDeviceSnapshot, value, isDown, wasPressed, wasReleased, consume, route, lastActiveSource: slot => state.lastActiveSource[slot || 'player1'] || null };
}
