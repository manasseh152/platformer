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
  up: 'PadUp', down: 'PadDown', left: 'PadLeft', right: 'PadRight', accept: 'PadA', back: 'PadB'
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
  'PadAxis0-': 'Left Stick ←',
  'PadAxis0+': 'Left Stick →',
  'PadAxis1-': 'Left Stick ↑',
  'PadAxis1+': 'Left Stick ↓'
};

export function createInputState() {
  return {
    binds: clone(defaultBinds),
    listeningFor: null,
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

const inputPresets = {
  wasd: { move:'A/D', jump:'Space', dash:'Shift', attack:'J', pause:'Esc', restart:'R' },
  arrows: { move:'←/→', jump:'↑', dash:'Shift', attack:'X', pause:'Esc', restart:'R' },
  gamepad: { move:'Left Stick', jump:'A', dash:'RB', attack:'X', pause:'Start', restart:'Back' }
};

export function setInputScheme(game, scheme) {
  const input = game.input;
  if (input.inputScheme === scheme) return;
  input.inputScheme = scheme;
  game.ui.controlsEl.textContent = controlsText(input);
}

export function controlsText(input) {
  const p = inputPresets[input.inputScheme] || inputPresets.wasd;
  return `Move: ${p.move} · Jump: ${p.jump} · Dash: ${p.dash} · Attack: ${p.attack} · Pause: ${p.pause} · Restart: ${p.restart}`;
}

export function bindKey(input, action, code) {
  if (input.bindMode === 'add') {
    if (!input.binds[action].includes(code)) input.binds[action].push(code);
  } else {
    input.binds[action] = [code];
  }
  input.listeningFor = null;
  input.bindMode = 'replace';
  input.bindDeadline = 0;
}

export function bindGamepad(input, action, code) {
  input.gamepadBinds[action] = [code];
  input.controllerBindAction = null;
  input.bindDeadline = 0;
  input.bindRenderDirty = true;
  input.suppressMenuInputOnce = true;
}

export function clearExtraBinds(input, action) {
  input.binds[action] = input.binds[action].slice(0, 1);
  input.gamepadBinds[action] = input.gamepadBinds[action].slice(0, 1);
  input.listeningFor = null;
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

export function pollGamepads(game) {
  const { input, ui } = game;
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
    if (b[5]?.pressed || b[7]?.pressed) input.gamepadDown.add('PadRB');
    if (b[9]?.pressed) input.gamepadDown.add('PadStart');
    if (b[8]?.pressed) input.gamepadDown.add('PadBack');
  }
  for (const code of input.gamepadDown) if (!input.previousGamepadDown.has(code)) input.gamepadPressed.add(code);
  input.latestRawGamepadPressed = [...input.gamepadPressed].filter(code => code.startsWith('PadButton') || code.startsWith('PadAxis'));
  if (input.gamepadPressed.size) setInputScheme(game, 'gamepad');
  input.previousGamepadDown.clear();
  for (const code of input.gamepadDown) input.previousGamepadDown.add(code);
  updateControllerDebug(game, firstPad);
}

export function updateControllerDebug(game, pad) {
  const { input, ui } = game;
  if (!ui.controllerName) return;
  ui.controllerName.textContent = pad ? `${pad.id} (${pad.mapping || 'unknown mapping'})` : 'None detected';
  const rawDown = [...input.gamepadDown].filter(code => code.startsWith('PadButton') || code.startsWith('PadAxis'));
  ui.controllerInputs.textContent = rawDown.length ? rawDown.join(', ') : 'None';
  if (input.controllerBindAction && input.latestRawGamepadPressed.length) {
    const action = input.controllerBindAction;
    bindGamepad(input, action, input.latestRawGamepadPressed[0]);
    const message = `${bindLabels[action]} bound to ${controllerName(input.latestRawGamepadPressed[0])}.`;
    setBindStatus(ui, message);
    setControllerStatus(ui, message);
  }
}

export function setBindStatus(ui, message, error = false) {
  ui.bindStatus.textContent = message;
  ui.bindStatus.style.color = error ? '#ff9ebc' : '#9ef7ff';
}

export function setControllerStatus(ui, message, error = false) {
  ui.controllerStatus.textContent = message;
  ui.controllerStatus.style.color = error ? '#ff9ebc' : '#9ef7ff';
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
  input.bindDeadline = 0;
}

export function resetDefaultGamepadBinds(input) {
  input.gamepadBinds = clone(defaultGamepadBinds);
  input.controllerBindAction = null;
  input.bindDeadline = 0;
}

export function resetDefaultKeyBinds(input) {
  input.binds = clone(defaultBinds);
  input.listeningFor = null;
  input.bindMode = 'replace';
  input.bindDeadline = 0;
}
