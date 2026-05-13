export const clone = value => JSON.parse(JSON.stringify(value));

export function controlKey(deviceId, control) {
  if (control.type === 'key') return `${deviceId}:key:${control.code}`;
  if (control.type === 'button') return `${deviceId}:button:${control.index}`;
  if (control.type === 'axis') return `${deviceId}:axis:${control.index}`;
  if (control.type === 'pointerButton') return `${deviceId}:pointerButton:${control.button}`;
  if (control.type === 'wheelDirection') return `${deviceId}:wheelDirection:${control.direction}`;
  return `${deviceId}:${control.type}:${JSON.stringify(control)}`;
}

export function bindingKey(binding, deviceId = binding.deviceId || binding.deviceType) {
  if (binding.deviceType === 'keyboard') return controlKey(deviceId, { type: 'key', code: binding.code });
  if (binding.deviceType === 'gamepad' && binding.control === 'button') return controlKey(deviceId, { type: 'button', index: binding.index });
  if (binding.deviceType === 'gamepad' && (binding.control === 'axis' || binding.control === 'axisDirection')) return controlKey(deviceId, { type: 'axis', index: binding.index });
  if (binding.deviceType === 'pointer' && binding.control === 'button') return controlKey(deviceId, { type: 'pointerButton', button: binding.button });
  if (binding.deviceType === 'pointer' && binding.control === 'wheelDirection') return controlKey(deviceId, { type: 'wheelDirection', direction: binding.direction });
  return `${deviceId}:${JSON.stringify(binding)}`;
}

export function normalizeAxisValue(value, deadzone = 0.35) {
  const numeric = Math.max(-1, Math.min(1, Number(value) || 0));
  const abs = Math.abs(numeric);
  if (abs <= deadzone) return 0;
  if (deadzone >= 1) return Math.sign(numeric);
  return Math.sign(numeric) * ((abs - deadzone) / (1 - deadzone));
}

export function samePhysicalBinding(a, b) {
  if (!a || !b || a.deviceType !== b.deviceType) return false;
  if (a.deviceType === 'keyboard') return a.control === b.control && a.code === b.code && JSON.stringify(a.modifiers || {}) === JSON.stringify(b.modifiers || {});
  if (a.deviceType === 'gamepad') return a.control === b.control && a.index === b.index && (a.direction ?? null) === (b.direction ?? null);
  if (a.deviceType === 'pointer') return a.control === b.control && (a.button ?? null) === (b.button ?? null) && (a.direction ?? null) === (b.direction ?? null);
  return JSON.stringify(a) === JSON.stringify(b);
}
