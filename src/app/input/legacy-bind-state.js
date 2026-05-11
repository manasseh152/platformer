export const defaultBinds = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['KeyW', 'Space', 'ArrowUp'],
  dash: ['ShiftLeft', 'ShiftRight', 'KeyK'],
  attack: ['KeyJ', 'KeyX'],
  pause: ['Escape', 'KeyP'],
  restart: ['KeyR']
};

export const bindLabels = { left:'Move Left', right:'Move Right', jump:'Jump', dash:'Dash', attack:'Attack', pause:'Pause', restart:'Restart' };

export const defaultGamepadBinds = {
  left: ['PadAxis0-', 'PadButton14'],
  right: ['PadAxis0+', 'PadButton15'],
  jump: ['PadButton0'],
  dash: ['PadButton5', 'PadButton7'],
  attack: ['PadButton2'],
  pause: ['PadButton9'],
  restart: ['PadButton8']
};

export const menuButtons = {
  up: 'PadUp', down: 'PadDown', left: 'PadLeft', right: 'PadRight', accept: 'PadA', back: 'PadB', previousTab: 'PadButton4', nextTab: 'PadButton5'
};

const controllerNames = {
  PadButton0: 'A / Cross',
  PadButton1: 'B / Circle',
  PadButton2: 'X / Square',
  PadButton3: 'Y / Triangle',
  PadButton4: 'LB / L1',
  PadButton5: 'RB / R1',
  PadButton6: 'LT / L2',
  PadButton7: 'RT / R2',
  PadButton8: 'Back / Select',
  PadButton9: 'Start / Options',
  PadButton10: 'Left Stick Click',
  PadButton11: 'Right Stick Click',
  PadButton12: 'D-pad Up',
  PadButton13: 'D-pad Down',
  PadButton14: 'D-pad Left',
  PadButton15: 'D-pad Right',
  PadButton16: 'Guide / Xbox',
  PadButton17: 'Share / Capture',
  'PadAxis0-': 'Left Stick ←',
  'PadAxis0+': 'Left Stick →',
  'PadAxis1-': 'Left Stick ↑',
  'PadAxis1+': 'Left Stick ↓',
  'PadAxis2-': 'Right Stick ←',
  'PadAxis2+': 'Right Stick →',
  'PadAxis3-': 'Right Stick ↑',
  'PadAxis3+': 'Right Stick ↓'
};

export function createInputState() {
  return {
    binds: clone(defaultBinds),
    listeningFor: null,
    bindCapture: null,
    bindMode: 'replace',
    bindEditorDevice: 'keyboard',
    inputScheme: 'wasd',
    useController: true,
    keys: new Set(),
    pressed: new Set(),
    gamepadDown: new Set(),
    gamepadPressed: new Set(),
    previousGamepadDown: new Set(),
    gamepadBinds: clone(defaultGamepadBinds),
    controllerBindAction: null,
    bindDeadline: 0,
    bindRenderDirty: false,
    suppressMenuInputOnce: false,
    controllerDebugLock: false,
    latestRawGamepadPressed: []
  };
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function hasDown(input, action) {
  return input.binds[action].some(code => input.keys.has(code)) ||
    (input.useController && input.gamepadBinds[action].some(code => input.gamepadDown.has(code)));
}

export function hasPressed(input, action) {
  return input.binds[action].some(code => input.pressed.has(code)) ||
    (input.useController && input.gamepadBinds[action].some(code => input.gamepadPressed.has(code)));
}

export const keyName = code => ({Space:'Space', ArrowLeft:'←', ArrowRight:'→', ArrowUp:'↑', ArrowDown:'↓', ShiftLeft:'Left Shift', ShiftRight:'Right Shift', Escape:'Esc'}[code] || code.replace(/^Key/, '').replace(/^Digit/, ''));
export const controllerName = code => controllerNames[code] || code.replace(/^PadButton/, 'Button ').replace(/^PadAxis(\d)([+-])$/, 'Stick $1 $2');
export const bindText = (input, action) => input.binds[action].map(keyName).join(' / ');
export const controllerBindText = (input, action) => input.gamepadBinds[action].map(controllerName).join(' / ');

export function bindKey(input, action, code) {
  if (input.bindMode === 'add') {
    if (!input.binds[action].includes(code)) input.binds[action].push(code);
  } else {
    input.binds[action] = [code];
  }
  input.listeningFor = null;
  input.bindCapture = null;
  input.bindMode = 'replace';
  input.bindDeadline = 0;
}

export function bindGamepad(input, action, code) {
  input.gamepadBinds[action] = [code];
  input.controllerBindAction = null;
  input.bindCapture = null;
  input.bindDeadline = 0;
  input.bindRenderDirty = true;
  input.suppressMenuInputOnce = true;
}

export function findBindConflict(input, device, action, code) {
  const source = device === 'controller' ? input.gamepadBinds : input.binds;
  return Object.keys(source).find(candidate => candidate !== action && source[candidate].includes(code)) || null;
}

export function clearExtraBinds(input, action) {
  input.binds[action] = input.binds[action].slice(0, 1);
  input.gamepadBinds[action] = input.gamepadBinds[action].slice(0, 1);
  input.listeningFor = null;
  input.bindCapture = null;
  input.bindMode = 'replace';
  input.controllerBindAction = null;
  input.bindDeadline = 0;
}

export function validBinds(candidate, defaults = defaultBinds) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  return Object.keys(defaults).every(action =>
    Array.isArray(candidate[action]) && candidate[action].length > 0 && candidate[action].every(code => typeof code === 'string')
  );
}

export function importBinds(input, json) {
  const parsed = JSON.parse(json);
  if (!validBinds(parsed)) throw new Error('Invalid key bind shape.');
  input.binds = Object.fromEntries(Object.keys(defaultBinds).map(action => [action, [...new Set(parsed[action])]]));
  input.listeningFor = null;
  input.bindMode = 'replace';
}

export function resetKeyboardInput(input) {
  input.keys.clear();
  input.pressed.clear();
}

export function resetControllerInput(input) {
  input.gamepadDown.clear();
  input.gamepadPressed.clear();
  input.previousGamepadDown.clear();
  input.controllerBindAction = null;
  input.bindCapture = null;
  input.bindDeadline = 0;
}

export function resetDefaultGamepadBinds(input) {
  input.gamepadBinds = clone(defaultGamepadBinds);
  input.controllerBindAction = null;
  input.bindCapture = null;
  input.bindDeadline = 0;
}

export function resetDefaultKeyBinds(input) {
  input.binds = clone(defaultBinds);
  input.listeningFor = null;
  input.bindCapture = null;
  input.bindMode = 'replace';
  input.bindDeadline = 0;
}
