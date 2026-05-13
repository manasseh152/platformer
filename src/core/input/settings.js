import { clone } from './utils.js';

export const INPUT_PROFILE_IDS = ['keyboard-mouse', 'wasd', 'arrows', 'controller'];

const profileLabels = {
  'keyboard-mouse': 'Keyboard + Mouse',
  wasd: 'WASD',
  arrows: 'Arrows',
  controller: 'Controller'
};

function profileBindings(profile, profileId) {
  const bindings = profile.defaultBindings || {};
  const keyboardGroup = profileId === 'arrows' ? 'arrows' : 'wasd';
  const deviceType = profileId === 'controller' ? 'gamepad' : null;
  const only = actionId => clone(bindings[actionId] || []);
  if (profileId === 'keyboard-mouse') return {
    'player.moveX': only('player.moveX').filter(binding => binding.deviceType === 'keyboard' && binding.displayGroup === 'wasd'),
    'player.jump': [{ deviceType: 'keyboard', control: 'key', code: 'Space' }],
    'player.dash': [{ deviceType: 'keyboard', control: 'key', code: 'ShiftLeft' }, { deviceType: 'keyboard', control: 'key', code: 'ShiftRight' }],
    'player.attack': [{ deviceType: 'pointer', control: 'button', button: 0 }],
    'system.pause': [{ deviceType: 'keyboard', control: 'key', code: 'Escape' }, { deviceType: 'keyboard', control: 'key', code: 'KeyP' }],
    'system.restart': [{ deviceType: 'keyboard', control: 'key', code: 'KeyR' }]
  };
  const result = {};
  for (const actionId of ['player.moveX', 'player.jump', 'player.dash', 'player.attack', 'system.pause', 'system.restart']) {
    result[actionId] = only(actionId).filter(binding => {
      if (deviceType) return binding.deviceType === deviceType;
      if (binding.deviceType !== 'keyboard') return false;
      if (binding.displayGroup) return binding.displayGroup === keyboardGroup;
      if (profileId === 'arrows' && actionId === 'player.attack') return binding.code === 'KeyX';
      if (profileId === 'wasd' && actionId === 'player.attack') return binding.code === 'KeyJ';
      return true;
    });
  }
  return result;
}

function defaultProfiles(profile) {
  return Object.fromEntries(INPUT_PROFILE_IDS.map(id => [id, {
    id,
    label: profileLabels[id],
    hintPack: id === 'controller' ? 'xbox' : 'kenney-keyboard-mouse',
    deviceTypes: id === 'controller' ? ['gamepad'] : id === 'keyboard-mouse' ? ['keyboard', 'pointer'] : ['keyboard'],
    bindings: profileBindings(profile, id)
  }]));
}

export function defaultInputSettings(profile) {
  return {
    schemaVersion: 2,
    input: {
      activeProfileId: 'keyboard-mouse',
      profileSwitching: 'auto',
      profiles: defaultProfiles(profile),
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
  if (binding.deviceType === 'pointer') {
    if (binding.control === 'button') return Number.isInteger(binding.button);
    if (binding.control === 'wheelDirection') return [-1, 1].includes(binding.direction);
  }
  return false;
}

function normalizeBindings(profile, value, warnings, defaultsOverride = null) {
  const defaults = defaultsOverride || profile.defaultBindings || {};
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

function normalizeProfiles(profile, value, warnings) {
  const defaults = defaultProfiles(profile);
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = {};
  for (const id of INPUT_PROFILE_IDS) {
    const candidate = source[id] && typeof source[id] === 'object' && !Array.isArray(source[id]) ? source[id] : {};
    result[id] = {
      ...clone(defaults[id]),
      ...(typeof candidate.hintPack === 'string' ? { hintPack: candidate.hintPack } : {}),
      bindings: normalizeBindings(profile, candidate.bindings, warnings, defaults[id].bindings)
    };
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
  const profiles = inputSource?.profiles
    ? normalizeProfiles(profile, inputSource.profiles, warnings)
    : defaultProfiles(profile);
  if (!inputSource?.profiles && inputSource?.bindings) {
    const activeLegacyProfile = ['gamepad', 'controller'].includes(inputSource.activeProfileId || source.inputScheme) ? 'controller' : inputSource.activeProfileId === 'arrows' || source.inputScheme === 'arrows' ? 'arrows' : 'wasd';
    profiles[activeLegacyProfile].bindings = normalizeBindings(profile, inputSource.bindings, warnings, profiles[activeLegacyProfile].bindings);
  } else if (!inputSource?.profiles && !inputSource && (source.keyboardBinds || source.gamepadBinds)) {
    for (const [actionId, actionBindings] of Object.entries(bindings)) {
      const keyboard = actionBindings.filter(binding => binding.deviceType === 'keyboard');
      const gamepad = actionBindings.filter(binding => binding.deviceType === 'gamepad');
      if (keyboard.length && profiles.wasd.bindings[actionId]) profiles.wasd.bindings[actionId] = keyboard;
      if (gamepad.length && profiles.controller.bindings[actionId]) profiles.controller.bindings[actionId] = gamepad;
    }
  }
  const legacyActiveProfileId = ['gamepad', 'controller'].includes(source.inputScheme) ? 'controller' : source.inputScheme === 'arrows' ? 'arrows' : (source.keyboardBinds || source.gamepadBinds || (inputSource?.bindings && !inputSource?.profiles)) ? 'wasd' : defaults.input.activeProfileId;
  const activeProfileId = INPUT_PROFILE_IDS.includes(inputSource?.activeProfileId) ? inputSource.activeProfileId : legacyActiveProfileId;
  const profileSwitching = inputSource?.profileSwitching === 'locked' ? 'locked' : 'auto';
  const defaultDeadzone = Number(inputSource?.gamepad?.defaultDeadzone ?? defaults.input.gamepad.defaultDeadzone);
  const settings = {
    schemaVersion: 2,
    input: {
      activeProfileId,
      profileSwitching,
      profiles,
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
