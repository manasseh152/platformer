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

const GAMEPAD_ICON_ASSETS = {
  xbox: {
    button: {
      0: '/assets/kenney-input-prompts/xbox/xbox_button_a.png',
      1: '/assets/kenney-input-prompts/xbox/xbox_button_b.png',
      2: '/assets/kenney-input-prompts/xbox/xbox_button_x.png',
      3: '/assets/kenney-input-prompts/xbox/xbox_button_y.png',
      4: '/assets/kenney-input-prompts/xbox/xbox_lb.png',
      5: '/assets/kenney-input-prompts/xbox/xbox_rb.png',
      8: '/assets/kenney-input-prompts/xbox/xbox_button_view.png',
      9: '/assets/kenney-input-prompts/xbox/xbox_button_menu.png',
      14: '/assets/kenney-input-prompts/xbox/xbox_dpad_left.png',
      15: '/assets/kenney-input-prompts/xbox/xbox_dpad_right.png'
    },
    axis: { 0: '/assets/kenney-input-prompts/xbox/xbox_stick_l_horizontal.png', 1: '/assets/kenney-input-prompts/xbox/xbox_stick_l_vertical.png' }
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

export function bindingLabel(binding = {}) {
  if (binding.deviceType === 'keyboard') return keyLabel(binding.code);
  if (binding.deviceType === 'gamepad') return gamepadLabel(binding);
  return binding.label || 'Input';
}

function iconForBinding(binding, { iconPack = 'text' } = {}) {
  if (iconPack !== 'xbox' || binding.deviceType !== 'gamepad') return null;
  if (binding.control === 'button') return GAMEPAD_ICON_ASSETS.xbox.button[binding.index] || null;
  if (binding.control === 'axis') return GAMEPAD_ICON_ASSETS.xbox.axis[binding.index] || null;
  return null;
}

function displayGroupFor(runtime, fallbackScheme = 'wasd', slot = 'player1') {
  const active = runtime?.lastActiveSource?.(slot);
  if (active?.deviceType === 'gamepad') return 'gamepad';
  if (active?.displayGroup) return active.displayGroup;
  return fallbackScheme === 'gamepad' ? 'gamepad' : (fallbackScheme === 'arrows' ? 'arrows' : 'wasd');
}

function matchesRequest(binding, request = {}) {
  if (typeof request.axisScale === 'number' && Math.sign(binding.scale ?? 1) !== Math.sign(request.axisScale)) return false;
  if (request.deviceType && binding.deviceType !== request.deviceType) return false;
  return true;
}

export function bindingsForHint(settings, actionId, { runtime = null, inputScheme = 'wasd', slot = 'player1', axisScale, deviceType } = {}) {
  const bindings = settings?.input?.bindings?.[actionId] || [];
  const group = displayGroupFor(runtime, inputScheme, slot);
  const requested = { axisScale, deviceType };
  const candidates = bindings.filter(binding => matchesRequest(binding, requested));
  if (group === 'gamepad') return candidates.filter(binding => binding.deviceType === 'gamepad').slice(0, 2);
  const grouped = candidates.filter(binding => binding.deviceType === 'keyboard' && (binding.displayGroup || null) === group);
  if (grouped.length) return grouped.slice(0, 2);
  return candidates.filter(binding => binding.deviceType === 'keyboard').slice(0, 2);
}

export function hintPartsForAction(profile, settings, actionId, options = {}) {
  const bindings = bindingsForHint(settings, actionId, options);
  const action = profile?.actions?.[actionId] || {};
  const label = options.label || action.label || actionId;
  return {
    actionId,
    label,
    deviceType: bindings[0]?.deviceType || 'keyboard',
    parts: bindings.map(binding => ({ type: 'control', label: bindingLabel(binding), icon: iconForBinding(binding, options), binding }))
  };
}

export function textHintForAction(profile, settings, actionId, options = {}) {
  const hint = hintPartsForAction(profile, settings, actionId, options);
  const controls = hint.parts.map(part => part.label).join(' / ') || 'Unbound';
  return `${controls} ${hint.label}`;
}
