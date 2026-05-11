import { clone } from './utils.js';

export function defaultInputSettings(profile) {
  return {
    schemaVersion: 2,
    input: {
      slots: {
        player1: {
          devices: {
            keyboard: { enabled: true },
            gamepad: { enabled: true, selectedFingerprint: null, selectedRuntimeId: null }
          }
        }
      },
      gamepad: { defaultDeadzone: 0.35, globalIconPack: null, controllerOverrides: {} },
      controllerPresentation: {},
      bindings: clone(profile.defaultBindings || {})
    }
  };
}

const oldActionMap = {
  left: { action: 'player.moveX', scale: -1 },
  right: { action: 'player.moveX', scale: 1 },
  jump: { action: 'player.jump' },
  dash: { action: 'player.dash' },
  attack: { action: 'player.attack' },
  pause: { action: 'system.pause' },
  restart: { action: 'system.restart' }
};

export function bindingFromLegacyKeyboard(code, extra = {}) {
  return { deviceType: 'keyboard', control: 'key', code, ...extra };
}

export function bindingFromLegacyGamepad(code, extra = {}) {
  const button = /^PadButton(\d+)$/.exec(code);
  if (button) return { deviceType: 'gamepad', control: 'button', index: Number(button[1]), ...extra };
  const axis = /^PadAxis(\d)([+-])$/.exec(code);
  if (axis) return { deviceType: 'gamepad', control: 'axisDirection', index: Number(axis[1]), direction: axis[2] === '+' ? 1 : -1, ...extra };
  const aliases = { PadA: 0, PadB: 1, PadX: 2, PadY: 3, PadBack: 8, PadStart: 9, PadUp: 12, PadDown: 13, PadLeft: 14, PadRight: 15 };
  if (code in aliases) return { deviceType: 'gamepad', control: 'button', index: aliases[code], ...extra };
  if (code === 'PadRB') return { deviceType: 'gamepad', control: 'button', index: 5, ...extra };
  return null;
}

function migrateLegacyBinds(candidate, defaults, warnings) {
  const bindings = clone(defaults);
  const migrated = {};
  const visit = (source, convert) => {
    if (!source || typeof source !== 'object') return;
    for (const [legacyAction, codes] of Object.entries(source)) {
      const target = oldActionMap[legacyAction];
      if (!target) { warnings.push({ path: `input.legacy.${legacyAction}`, code: 'unknown-legacy-action-stripped' }); continue; }
      if (!Array.isArray(codes)) { warnings.push({ path: `input.legacy.${legacyAction}`, code: 'invalid-legacy-action-reset' }); continue; }
      migrated[target.action] ??= [];
      for (const code of codes) {
        if (typeof code !== 'string') continue;
        const binding = convert(code, target.scale === undefined ? {} : { scale: target.scale });
        if (binding) migrated[target.action].push(binding);
      }
    }
  };
  visit(candidate.keyboardBinds, bindingFromLegacyKeyboard);
  visit(candidate.gamepadBinds, bindingFromLegacyGamepad);
  for (const [action, actionBindings] of Object.entries(migrated)) if (actionBindings.length) bindings[action] = actionBindings;
  return bindings;
}

function validBinding(binding) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return false;
  if (binding.deviceType === 'keyboard') return binding.control === 'key' && typeof binding.code === 'string';
  if (binding.deviceType === 'gamepad') {
    if (binding.control === 'button') return Number.isInteger(binding.index) && binding.index >= 0;
    if (binding.control === 'axis') return Number.isInteger(binding.index) && binding.index >= 0;
    if (binding.control === 'axisDirection') return Number.isInteger(binding.index) && [-1, 1].includes(binding.direction);
  }
  if (binding.deviceType === 'pointer') return binding.control === 'button' && Number.isInteger(binding.button);
  return false;
}

function normalizeBindings(profile, value, warnings) {
  const defaults = profile.defaultBindings || {};
  const result = {};
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  for (const actionId of Object.keys(defaults)) {
    const action = profile.actions?.[actionId] || {};
    const bindings = source[actionId];
    if (action.userRemappable === false) { result[actionId] = clone(defaults[actionId]); continue; }
    if (bindings === undefined) { result[actionId] = clone(defaults[actionId]); continue; }
    if (!Array.isArray(bindings) || !bindings.length || bindings.some(binding => !validBinding(binding))) {
      warnings.push({ path: `input.bindings.${actionId}`, code: 'invalid-bindings-reset' });
      result[actionId] = clone(defaults[actionId]);
      continue;
    }
    result[actionId] = clone(bindings);
  }
  for (const actionId of Object.keys(source)) {
    if (!(actionId in defaults)) warnings.push({ path: `input.bindings.${actionId}`, code: 'unknown-action-stripped' });
  }
  return result;
}

function normalizeSlot(slot, warnings) {
  const keyboardEnabled = slot?.devices?.keyboard?.enabled !== false;
  const gamepadSource = slot?.devices?.gamepad || {};
  let gamepadEnabled = gamepadSource.enabled !== false;
  let keyboard = { enabled: keyboardEnabled };
  if (!keyboard.enabled && !gamepadEnabled) {
    keyboard = { enabled: true };
    warnings.push({ path: 'input.slots.player1.devices.keyboard.enabled', code: 'keyboard-reenabled-to-avoid-lockout' });
  }
  return {
    devices: {
      keyboard,
      gamepad: {
        enabled: gamepadEnabled,
        selectedFingerprint: typeof gamepadSource.selectedFingerprint === 'string' ? gamepadSource.selectedFingerprint : null,
        selectedRuntimeId: typeof gamepadSource.selectedRuntimeId === 'string' ? gamepadSource.selectedRuntimeId : null
      }
    }
  };
}

export function normalizeInputSettings(profile, candidate = {}, options = {}) {
  const warnings = [];
  const defaults = defaultInputSettings(profile);
  const source = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
  const inputSource = source.input && typeof source.input === 'object' && !Array.isArray(source.input) ? source.input : null;
  const bindings = inputSource
    ? normalizeBindings(profile, inputSource.bindings, warnings)
    : migrateLegacyBinds(source, defaults.input.bindings, warnings);
  const defaultDeadzone = Number(inputSource?.gamepad?.defaultDeadzone ?? defaults.input.gamepad.defaultDeadzone);
  const settings = {
    schemaVersion: 2,
    input: {
      slots: { player1: normalizeSlot(inputSource?.slots?.player1, warnings) },
      gamepad: {
        defaultDeadzone: Number.isFinite(defaultDeadzone) && defaultDeadzone >= 0 && defaultDeadzone < 1 ? defaultDeadzone : defaults.input.gamepad.defaultDeadzone,
        globalIconPack: typeof inputSource?.gamepad?.globalIconPack === 'string' ? inputSource.gamepad.globalIconPack : null,
        controllerOverrides: inputSource?.gamepad?.controllerOverrides && typeof inputSource.gamepad.controllerOverrides === 'object' && !Array.isArray(inputSource.gamepad.controllerOverrides) ? clone(inputSource.gamepad.controllerOverrides) : {}
      },
      controllerPresentation: inputSource?.controllerPresentation && typeof inputSource.controllerPresentation === 'object' && !Array.isArray(inputSource.controllerPresentation) ? clone(inputSource.controllerPresentation) : {},
      bindings
    }
  };
  if (inputSource?.gamepad?.defaultDeadzone !== undefined && settings.input.gamepad.defaultDeadzone !== defaultDeadzone) warnings.push({ path: 'input.gamepad.defaultDeadzone', code: 'invalid-deadzone-reset' });
  return { settings, warnings };
}
