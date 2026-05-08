export const gameInputProfile = {
  id: 'chibi-game',
  slots: ['player1'],
  contexts: {
    bindCapture: { priority: 1000, actions: [] },
    global: { priority: 100, actions: ['devtools.toggle', 'devtools.pause'] },
    menu: { priority: 50, actions: ['menu.navigateX', 'menu.navigateY', 'menu.accept', 'menu.back', 'menu.settings'] },
    gameplay: { priority: 10, actions: ['player.moveX', 'player.jump', 'player.dash', 'player.attack', 'system.pause', 'system.restart'] }
  },
  actions: {
    'player.moveX': { kind: 'axis1d', label: 'Move', preventDefault: true },
    'player.jump': { kind: 'button', label: 'Jump', preventDefault: true, allowModifierKeys: false },
    'player.dash': { kind: 'button', label: 'Dash', preventDefault: true, allowModifierKeys: true },
    'player.attack': { kind: 'button', label: 'Attack', preventDefault: true },
    'system.pause': { kind: 'button', label: 'Pause', preventDefault: true },
    'system.restart': { kind: 'button', label: 'Restart', preventDefault: true },
    'menu.navigateX': { kind: 'axis1d', label: 'Navigate Horizontal', preventDefault: true, userRemappable: false },
    'menu.navigateY': { kind: 'axis1d', label: 'Navigate Vertical', preventDefault: true, userRemappable: false },
    'menu.accept': { kind: 'button', label: 'Accept', preventDefault: true, userRemappable: false },
    'menu.back': { kind: 'button', label: 'Back', preventDefault: true, userRemappable: false },
    'menu.settings': { kind: 'button', label: 'Settings', preventDefault: true, userRemappable: false },
    'devtools.toggle': { kind: 'button', label: 'Toggle Developer Tools', preventDefault: true, userRemappable: false },
    'devtools.pause': { kind: 'button', label: 'Pause Simulation', preventDefault: true, userRemappable: false }
  },
  defaultBindings: {
    'player.moveX': [
      { deviceType: 'keyboard', control: 'key', code: 'KeyA', scale: -1, displayGroup: 'wasd' },
      { deviceType: 'keyboard', control: 'key', code: 'ArrowLeft', scale: -1, displayGroup: 'arrows' },
      { deviceType: 'keyboard', control: 'key', code: 'KeyD', scale: 1, displayGroup: 'wasd' },
      { deviceType: 'keyboard', control: 'key', code: 'ArrowRight', scale: 1, displayGroup: 'arrows' },
      { deviceType: 'gamepad', control: 'axis', index: 0 },
      { deviceType: 'gamepad', control: 'button', index: 14, scale: -1 },
      { deviceType: 'gamepad', control: 'button', index: 15, scale: 1 }
    ],
    'player.jump': [
      { deviceType: 'keyboard', control: 'key', code: 'KeyW', displayGroup: 'wasd' },
      { deviceType: 'keyboard', control: 'key', code: 'Space' },
      { deviceType: 'keyboard', control: 'key', code: 'ArrowUp', displayGroup: 'arrows' },
      { deviceType: 'gamepad', control: 'button', index: 0 }
    ],
    'player.dash': [
      { deviceType: 'keyboard', control: 'key', code: 'ShiftLeft' },
      { deviceType: 'keyboard', control: 'key', code: 'ShiftRight' },
      { deviceType: 'keyboard', control: 'key', code: 'KeyK' },
      { deviceType: 'gamepad', control: 'button', index: 5 },
      { deviceType: 'gamepad', control: 'button', index: 7 }
    ],
    'player.attack': [
      { deviceType: 'keyboard', control: 'key', code: 'KeyJ' },
      { deviceType: 'keyboard', control: 'key', code: 'KeyX' },
      { deviceType: 'gamepad', control: 'button', index: 2 }
    ],
    'system.pause': [
      { deviceType: 'keyboard', control: 'key', code: 'Escape' },
      { deviceType: 'keyboard', control: 'key', code: 'KeyP' },
      { deviceType: 'gamepad', control: 'button', index: 9 }
    ],
    'system.restart': [
      { deviceType: 'keyboard', control: 'key', code: 'KeyR' },
      { deviceType: 'gamepad', control: 'button', index: 8 }
    ],
    'menu.navigateX': [
      { deviceType: 'keyboard', control: 'key', code: 'ArrowLeft', scale: -1, displayGroup: 'arrows' },
      { deviceType: 'keyboard', control: 'key', code: 'ArrowRight', scale: 1, displayGroup: 'arrows' },
      { deviceType: 'keyboard', control: 'key', code: 'KeyA', scale: -1, displayGroup: 'wasd' },
      { deviceType: 'keyboard', control: 'key', code: 'KeyD', scale: 1, displayGroup: 'wasd' },
      { deviceType: 'gamepad', control: 'axis', index: 0 },
      { deviceType: 'gamepad', control: 'button', index: 14, scale: -1 },
      { deviceType: 'gamepad', control: 'button', index: 15, scale: 1 }
    ],
    'menu.navigateY': [
      { deviceType: 'keyboard', control: 'key', code: 'ArrowUp', scale: -1, displayGroup: 'arrows' },
      { deviceType: 'keyboard', control: 'key', code: 'ArrowDown', scale: 1, displayGroup: 'arrows' },
      { deviceType: 'keyboard', control: 'key', code: 'KeyW', scale: -1, displayGroup: 'wasd' },
      { deviceType: 'keyboard', control: 'key', code: 'KeyS', scale: 1, displayGroup: 'wasd' },
      { deviceType: 'gamepad', control: 'axis', index: 1 },
      { deviceType: 'gamepad', control: 'button', index: 12, scale: -1 },
      { deviceType: 'gamepad', control: 'button', index: 13, scale: 1 }
    ],
    'menu.accept': [
      { deviceType: 'keyboard', control: 'key', code: 'Enter' },
      { deviceType: 'keyboard', control: 'key', code: 'Space' },
      { deviceType: 'gamepad', control: 'button', index: 0 }
    ],
    'menu.back': [
      { deviceType: 'keyboard', control: 'key', code: 'Escape' },
      { deviceType: 'gamepad', control: 'button', index: 1 }
    ],
    'menu.settings': [
      { deviceType: 'keyboard', control: 'key', code: 'Tab' },
      { deviceType: 'gamepad', control: 'button', index: 3 }
    ],
    'devtools.toggle': [{ deviceType: 'keyboard', control: 'key', code: 'Backquote' }],
    'devtools.pause': [{ deviceType: 'keyboard', control: 'key', code: 'KeyP' }]
  },
  uiGroups: {
    gameplayControls: [
      { title: 'Movement', rows: [
        { id: 'moveLeft', label: 'Move Left', action: 'player.moveX', axisScale: -1 },
        { id: 'moveRight', label: 'Move Right', action: 'player.moveX', axisScale: 1 },
        { id: 'jump', action: 'player.jump' },
        { id: 'dash', action: 'player.dash' }
      ] },
      { title: 'Actions', rows: [{ id: 'attack', action: 'player.attack' }] },
      { title: 'System', rows: [{ id: 'pause', action: 'system.pause' }, { id: 'restart', action: 'system.restart' }] }
    ]
  }
};
