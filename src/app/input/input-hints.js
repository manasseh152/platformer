const KEY_LABELS = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Escape: 'Esc',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  MetaLeft: 'Command',
  MetaRight: 'Command',
  Backquote: '`'
};

const GAMEPAD_BUTTON_LABELS = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'LB',
  5: 'RB',
  6: 'LT',
  7: 'RT',
  8: 'View',
  9: 'Menu',
  10: 'LS',
  11: 'RS',
  12: 'D-pad ↑',
  13: 'D-pad ↓',
  14: 'D-pad ←',
  15: 'D-pad →'
};

const xboxAsset = file => `/assets/kenney-input-prompts/xbox/${file}`;
const keyboardAsset = file => `/assets/kenney-input-prompts/keyboard/${file}`;

const KEYBOARD_ICON_FILES = {
  Space: 'keyboard_space.svg',
  Enter: 'keyboard_enter.svg',
  Tab: 'keyboard_tab.svg',
  Escape: 'keyboard_escape.svg',
  ArrowLeft: 'keyboard_arrow_left.svg',
  ArrowRight: 'keyboard_arrow_right.svg',
  ArrowUp: 'keyboard_arrow_up.svg',
  ArrowDown: 'keyboard_arrow_down.svg',
  ShiftLeft: 'keyboard_shift.svg',
  ShiftRight: 'keyboard_shift.svg',
  ControlLeft: 'keyboard_ctrl.svg',
  ControlRight: 'keyboard_ctrl.svg',
  AltLeft: 'keyboard_alt.svg',
  AltRight: 'keyboard_alt.svg',
  MetaLeft: 'keyboard_command.svg',
  MetaRight: 'keyboard_command.svg',
  Backspace: 'keyboard_backspace.svg',
  Delete: 'keyboard_delete.svg',
  Insert: 'keyboard_insert.svg',
  Home: 'keyboard_home.svg',
  End: 'keyboard_end.svg',
  PageUp: 'keyboard_page_up.svg',
  PageDown: 'keyboard_page_down.svg',
  CapsLock: 'keyboard_capslock.svg',
  NumLock: 'keyboard_numlock.svg',
  ScrollLock: 'keyboard_scroll_lock.svg',
  Pause: 'keyboard_pause.svg',
  PrintScreen: 'keyboard_printscreen.svg',
  Backquote: 'keyboard_tilde.svg',
  Minus: 'keyboard_minus.svg',
  Equal: 'keyboard_equals.svg',
  BracketLeft: 'keyboard_bracket_open.svg',
  BracketRight: 'keyboard_bracket_close.svg',
  Backslash: 'keyboard_slash_back.svg',
  Semicolon: 'keyboard_semicolon.svg',
  Quote: 'keyboard_quote.svg',
  Comma: 'keyboard_comma.svg',
  Period: 'keyboard_period.svg',
  Slash: 'keyboard_slash_forward.svg',
  NumpadEnter: 'keyboard_numpad_enter.svg',
  NumpadAdd: 'keyboard_numpad_plus.svg'
};

function keyboardIconFileForCode(code = '') {
  if (/^Key[A-Z]$/.test(code)) return `keyboard_${code.slice(3).toLowerCase()}.svg`;
  if (/^Digit[0-9]$/.test(code)) return `keyboard_${code.slice(5)}.svg`;
  if (/^Numpad[0-9]$/.test(code)) return `keyboard_${code.slice(6)}.svg`;
  if (/^F(?:[1-9]|1[0-2])$/.test(code)) return `keyboard_${code.toLowerCase()}.svg`;
  return KEYBOARD_ICON_FILES[code] || null;
}

const GAMEPAD_ICON_ASSETS = {
  xbox: {
    button: {
      0: xboxAsset('xbox_button_a.svg'),
      1: xboxAsset('xbox_button_b.svg'),
      2: xboxAsset('xbox_button_x.svg'),
      3: xboxAsset('xbox_button_y.svg'),
      4: xboxAsset('xbox_lb.svg'),
      5: xboxAsset('xbox_rb.svg'),
      6: xboxAsset('xbox_lt.svg'),
      7: xboxAsset('xbox_rt.svg'),
      8: xboxAsset('xbox_button_view.svg'),
      9: xboxAsset('xbox_button_menu.svg'),
      10: xboxAsset('xbox_stick_l_press.svg'),
      11: xboxAsset('xbox_stick_r_press.svg'),
      12: xboxAsset('xbox_dpad_up.svg'),
      13: xboxAsset('xbox_dpad_down.svg'),
      14: xboxAsset('xbox_dpad_left.svg'),
      15: xboxAsset('xbox_dpad_right.svg'),
      16: xboxAsset('xbox_guide.svg'),
      17: xboxAsset('xbox_button_share.svg')
    },
    axis: {
      0: xboxAsset('xbox_stick_l_horizontal.svg'),
      1: xboxAsset('xbox_stick_l_vertical.svg'),
      2: xboxAsset('xbox_stick_r_horizontal.svg'),
      3: xboxAsset('xbox_stick_r_vertical.svg')
    },
    axisDirection: {
      0: { '-1': xboxAsset('xbox_stick_l_left.svg'), 1: xboxAsset('xbox_stick_l_right.svg') },
      1: { '-1': xboxAsset('xbox_stick_l_up.svg'), 1: xboxAsset('xbox_stick_l_down.svg') },
      2: { '-1': xboxAsset('xbox_stick_r_left.svg'), 1: xboxAsset('xbox_stick_r_right.svg') },
      3: { '-1': xboxAsset('xbox_stick_r_up.svg'), 1: xboxAsset('xbox_stick_r_down.svg') }
    }
  }
};

export const hintActionAliases = {
  accept: 'menu.accept',
  back: 'menu.back',
  settings: 'menu.settings',
  restart: 'system.restart',
  pause: 'system.pause',
  jump: 'player.jump',
  dash: 'player.dash',
  attack: 'player.attack',
  move: 'player.moveX'
};

export function keyLabel(code = '') {
  return KEY_LABELS[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}

export function gamepadLabel(binding = {}) {
  if (binding.control === 'button') return GAMEPAD_BUTTON_LABELS[binding.index] || `Button ${binding.index}`;
  if (binding.control === 'axis') return binding.index === 0 ? 'Left Stick' : `Stick Axis ${binding.index}`;
  if (binding.control === 'axisDirection') {
    const arrow = binding.direction < 0 ? (binding.index === 1 ? '↑' : '←') : (binding.index === 1 ? '↓' : '→');
    return binding.index === 0 ? `Left Stick ${arrow}` : `Stick ${binding.index} ${arrow}`;
  }
  return 'Gamepad';
}

function keyboardModifierLabels(modifiers = {}) {
  const labels = [];
  if (modifiers.primary) labels.push('Ctrl/⌘');
  if (modifiers.ctrl) labels.push('Ctrl');
  if (modifiers.meta) labels.push('⌘');
  if (modifiers.alt) labels.push('Alt');
  if (modifiers.shift) labels.push('Shift');
  return labels;
}

export function bindingLabel(binding = {}) {
  if (binding.deviceType === 'keyboard') {
    const labels = keyboardModifierLabels(binding.modifiers);
    labels.push(keyLabel(binding.code));
    return labels.join(' + ');
  }
  if (binding.deviceType === 'gamepad') return gamepadLabel(binding);
  if (binding.deviceType === 'pointer') {
    if (binding.control === 'wheel') return 'Wheel';
    if (binding.control === 'wheelDirection') return binding.direction < 0 ? 'Wheel Up' : 'Wheel Down';
    if (binding.control === 'button') return binding.button === 0 ? 'LMB' : binding.button === 1 ? 'MMB' : binding.button === 2 ? 'RMB' : `Mouse ${binding.button}`;
  }
  return binding.label || 'Input';
}

export function iconForBinding(binding, { iconPack = 'text' } = {}) {
  if (iconPack === 'text') return null;
  if (binding.deviceType === 'keyboard') {
    const file = keyboardIconFileForCode(binding.code);
    return file ? keyboardAsset(file) : null;
  }
  if (iconPack !== 'xbox' || binding.deviceType !== 'gamepad') return null;
  if (binding.control === 'button') return GAMEPAD_ICON_ASSETS.xbox.button[binding.index] || null;
  if (binding.control === 'axis') return GAMEPAD_ICON_ASSETS.xbox.axis[binding.index] || null;
  if (binding.control === 'axisDirection') return GAMEPAD_ICON_ASSETS.xbox.axisDirection[binding.index]?.[binding.direction] || null;
  return null;
}

export function hintPartForBinding(binding, options = {}) {
  return { type: 'control', label: bindingLabel(binding), icon: iconForBinding(binding, options), binding };
}

function displayGroupFor(runtime, fallbackScheme = 'wasd', slot = 'player1') {
  if (fallbackScheme === 'keyboard-mouse') return 'keyboard-mouse';
  if (['gamepad', 'arrows', 'wasd'].includes(fallbackScheme)) return fallbackScheme;
  const active = runtime?.lastActiveSource?.(slot);
  if (active?.deviceType === 'gamepad') return 'gamepad';
  if (active?.displayGroup) return active.displayGroup;
  return 'wasd';
}

function matchesRequest(binding, request = {}) {
  if (typeof request.axisScale === 'number' && Math.sign(binding.scale ?? 1) !== Math.sign(request.axisScale)) return false;
  if (request.deviceType && binding.deviceType !== request.deviceType) return false;
  return true;
}

export function bindingsForHint(settings, actionId, { runtime = null, inputScheme = 'wasd', slot = 'player1', axisScale, deviceType } = {}) {
  const requestedProfileId = inputScheme === 'gamepad' ? 'controller' : inputScheme;
  const profileBindings = settings?.input?.profiles?.[requestedProfileId]?.bindings || settings?.input?.profiles?.[settings.input.activeProfileId]?.bindings;
  const bindings = profileBindings?.[actionId] || settings?.input?.bindings?.[actionId] || [];
  const group = displayGroupFor(runtime, inputScheme, slot);
  const requested = { axisScale, deviceType };
  const candidates = bindings.filter(binding => matchesRequest(binding, requested));
  if (group === 'gamepad') return candidates.filter(binding => binding.deviceType === 'gamepad').slice(0, 2);
  if (deviceType) return candidates.slice(0, 2);
  if (group === 'keyboard-mouse') return candidates.filter(binding => binding.deviceType === 'keyboard' || binding.deviceType === 'pointer').slice(0, 2);
  const grouped = candidates.filter(binding => binding.deviceType === 'keyboard' && (binding.displayGroup || null) === group);
  if (grouped.length) return grouped.slice(0, 2);
  return candidates.filter(binding => binding.deviceType === 'keyboard' || binding.deviceType === 'pointer').slice(0, 2);
}

export function hintPartsForAction(profile, settings, actionId, options = {}) {
  const bindings = bindingsForHint(settings, actionId, options);
  const action = profile?.actions?.[actionId] || {};
  const label = options.label || action.label || actionId;
  return {
    actionId,
    label,
    deviceType: bindings[0]?.deviceType || 'keyboard',
    parts: bindings.map(binding => hintPartForBinding(binding, options))
  };
}

export function textHintForAction(profile, settings, actionId, options = {}) {
  const hint = hintPartsForAction(profile, settings, actionId, options);
  const controls = hint.parts.map(part => part.label).join(' / ') || 'Unbound';
  return `${controls} ${hint.label}`;
}
