export const gameInputProfile = {
  id: 'chibi-game',
  slots: ['player1'],
  contexts: {
    bindCapture: { priority: 1000, actions: [] },
    global: { priority: 100, actions: ['devtools.toggle', 'devtools.pause'] },
    menu: { priority: 50, actions: ['menu.navigateX', 'menu.navigateY', 'menu.accept', 'menu.back', 'menu.settings', 'menu.previousTab', 'menu.nextTab'] },
    editor: { priority: 20, actions: ['editor.panModifier', 'editor.mainMenu', 'editor.save', 'editor.preview', 'editor.undo', 'editor.redo', 'editor.previousTab', 'editor.nextTab', 'editor.togglePanel', 'editor.toggleMode', 'editor.paint', 'editor.previousBrush', 'editor.nextBrush', 'editor.zoom', 'editor.zoomOut', 'editor.zoomIn', 'editor.resetView'] },
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
    'menu.previousTab': { kind: 'button', label: 'Previous Tab', preventDefault: true, userRemappable: false },
    'menu.nextTab': { kind: 'button', label: 'Next Tab', preventDefault: true, userRemappable: false },
    'devtools.toggle': { kind: 'button', label: 'Toggle Developer Tools', preventDefault: true, userRemappable: false },
    'devtools.pause': { kind: 'button', label: 'Pause Simulation', preventDefault: true, userRemappable: false },
    'editor.panModifier': { kind: 'button', label: 'Pan Modifier', preventDefault: true, userRemappable: false },
    'editor.mainMenu': { kind: 'button', label: 'Main menu', preventDefault: true, userRemappable: false, allowModifierKeys: true },
    'editor.save': { kind: 'button', label: 'Save Local Draft', preventDefault: true, userRemappable: false, allowModifierKeys: true },
    'editor.preview': { kind: 'button', label: 'Play Preview', preventDefault: true, userRemappable: false, allowModifierKeys: true },
    'editor.undo': { kind: 'button', label: 'Undo', preventDefault: true, userRemappable: false, allowModifierKeys: true },
    'editor.redo': { kind: 'button', label: 'Redo', preventDefault: true, userRemappable: false, allowModifierKeys: true },
    'editor.previousTab': { kind: 'button', label: 'Previous Tab', preventDefault: true, userRemappable: false },
    'editor.nextTab': { kind: 'button', label: 'Next Tab', preventDefault: true, userRemappable: false },
    'editor.togglePanel': { kind: 'button', label: 'Toggle Editor Panel', preventDefault: true, userRemappable: false },
    'editor.toggleMode': { kind: 'button', label: 'Toggle Draw/Navigate Mode', preventDefault: true, userRemappable: false },
    'editor.paint': { kind: 'button', label: 'Paint Cell', preventDefault: true, userRemappable: false },
    'editor.previousBrush': { kind: 'button', label: 'Previous Brush', preventDefault: true, userRemappable: false },
    'editor.nextBrush': { kind: 'button', label: 'Next Brush', preventDefault: true, userRemappable: false },
    'editor.zoom': { kind: 'button', label: 'Zoom', preventDefault: true, userRemappable: false },
    'editor.zoomOut': { kind: 'button', label: 'Zoom Out', preventDefault: true, userRemappable: false },
    'editor.zoomIn': { kind: 'button', label: 'Zoom In', preventDefault: true, userRemappable: false },
    'editor.resetView': { kind: 'button', label: 'Reset View', preventDefault: true, userRemappable: false }
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
      { deviceType: 'keyboard', control: 'key', code: 'Escape' },
      { deviceType: 'gamepad', control: 'button', index: 3 }
    ],
    'menu.previousTab': [{ deviceType: 'gamepad', control: 'button', index: 4 }],
    'menu.nextTab': [{ deviceType: 'gamepad', control: 'button', index: 5 }],
    'devtools.toggle': [{ deviceType: 'keyboard', control: 'key', code: 'Backquote' }],
    'devtools.pause': [{ deviceType: 'keyboard', control: 'key', code: 'KeyP' }],
    'editor.panModifier': [{ deviceType: 'keyboard', control: 'key', code: 'Space' }],
    'editor.mainMenu': [
      { deviceType: 'keyboard', control: 'key', code: 'KeyM', modifiers: { primary: true } },
      { deviceType: 'gamepad', control: 'button', index: 8 }
    ],
    'editor.save': [{ deviceType: 'keyboard', control: 'key', code: 'KeyS', modifiers: { primary: true } }],
    'editor.preview': [
      { deviceType: 'keyboard', control: 'key', code: 'Enter', modifiers: { primary: true } },
      { deviceType: 'gamepad', control: 'button', index: 9 }
    ],
    'editor.undo': [{ deviceType: 'keyboard', control: 'key', code: 'KeyZ', modifiers: { primary: true, shift: false } }],
    'editor.redo': [
      { deviceType: 'keyboard', control: 'key', code: 'KeyY', modifiers: { primary: true } },
      { deviceType: 'keyboard', control: 'key', code: 'KeyZ', modifiers: { primary: true, shift: true } }
    ],
    'editor.previousTab': [{ deviceType: 'gamepad', control: 'button', index: 4 }],
    'editor.nextTab': [{ deviceType: 'gamepad', control: 'button', index: 5 }],
    'editor.togglePanel': [{ deviceType: 'gamepad', control: 'button', index: 3 }],
    'editor.toggleMode': [{ deviceType: 'gamepad', control: 'button', index: 2 }],
    'editor.paint': [
      { deviceType: 'pointer', control: 'button', button: 0 },
      { deviceType: 'gamepad', control: 'button', index: 0 }
    ],
    'editor.previousBrush': [{ deviceType: 'gamepad', control: 'button', index: 4 }],
    'editor.nextBrush': [{ deviceType: 'gamepad', control: 'button', index: 5 }],
    'editor.zoom': [],
    'editor.zoomOut': [{ deviceType: 'pointer', control: 'wheelDirection', direction: 1 }, { deviceType: 'gamepad', control: 'button', index: 6 }],
    'editor.zoomIn': [{ deviceType: 'pointer', control: 'wheelDirection', direction: -1 }, { deviceType: 'gamepad', control: 'button', index: 7 }],
    'editor.resetView': [{ deviceType: 'gamepad', control: 'button', index: 11 }]
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
