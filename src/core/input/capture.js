import { clone, samePhysicalBinding } from './utils.js';

export function bindingFromKeyboardEvent(event = {}) {
  const code = event.code || event.control?.code;
  if (!code) return null;
  const modifiers = event.modifiers || {};
  const activeModifiers = Object.fromEntries(Object.entries(modifiers).filter(([, value]) => Boolean(value)));
  return {
    deviceType: 'keyboard',
    control: 'key',
    code,
    ...(Object.keys(activeModifiers).length ? { modifiers: activeModifiers } : {})
  };
}

export function bindingFromGamepadControl(control = {}, { threshold = 0.35 } = {}) {
  if (control.type === 'button' && Number(control.value) > 0) {
    return { deviceType: 'gamepad', control: 'button', index: control.index };
  }
  if (control.type === 'axis' && Math.abs(Number(control.value) || 0) > threshold) {
    return { deviceType: 'gamepad', control: 'axisDirection', index: control.index, direction: control.value < 0 ? -1 : 1, threshold };
  }
  return null;
}

export function bindingFromPointerEvent(event = {}) {
  if (event.control?.type === 'pointerButton') return { deviceType: 'pointer', control: 'button', button: event.control.button };
  if (event.control?.type === 'wheelDirection') return { deviceType: 'pointer', control: 'wheelDirection', direction: event.control.direction };
  if (Number.isInteger(event.button)) return { deviceType: 'pointer', control: 'button', button: event.button };
  if (Number(event.deltaY) !== 0) return { deviceType: 'pointer', control: 'wheelDirection', direction: event.deltaY > 0 ? 1 : -1 };
  return null;
}

export function createBindCapture({ actionId, deviceType = 'keyboard', timeoutAt = Infinity, cancelBindings = [] } = {}) {
  let done = false;
  function finish(result) { done = true; return result; }
  function consider(binding, timestamp = 0) {
    if (done) return { status: 'done' };
    if (timestamp > timeoutAt) return finish({ status: 'cancelled', reason: 'timeout' });
    const allowedTypes = Array.isArray(deviceType) ? deviceType : [deviceType];
    if (!binding || !allowedTypes.includes(binding.deviceType)) return { status: 'waiting' };
    if (cancelBindings.some(cancel => samePhysicalBinding(cancel, binding))) return finish({ status: 'cancelled', reason: 'user' });
    return finish({ status: 'captured', actionId, binding });
  }
  return {
    actionId,
    deviceType,
    consider,
    event(event) { return consider(bindingFromKeyboardEvent(event), event?.timestamp ?? event?.timeStamp ?? 0); },
    pointer(event) { return consider(bindingFromPointerEvent(event), event?.timestamp ?? event?.timeStamp ?? 0); },
    snapshot(snapshot = {}) {
      for (const control of snapshot.controls || []) {
        const result = consider(bindingFromGamepadControl(control, { threshold: snapshot.threshold }), snapshot.timestamp ?? 0);
        if (result.status !== 'waiting') return result;
      }
      return { status: 'waiting' };
    }
  };
}

export function findBindingConflict(settings, actionId, binding) {
  const bindings = settings?.input?.bindings || {};
  for (const [candidateActionId, candidateBindings] of Object.entries(bindings)) {
    if (candidateActionId === actionId || !Array.isArray(candidateBindings)) continue;
    if (candidateBindings.some(candidate => samePhysicalBinding(candidate, binding))) return { actionId: candidateActionId, binding };
  }
  return null;
}

export function applyCapturedBinding(settings, actionId, binding, { mode = 'replace', allowDuplicates = false } = {}) {
  const next = clone(settings);
  next.input.bindings[actionId] = next.input.bindings[actionId] || [];
  const conflict = allowDuplicates ? null : findBindingConflict(next, actionId, binding);
  if (conflict) return { settings: next, ok: false, conflict };
  const existing = next.input.bindings[actionId].filter(candidate => !samePhysicalBinding(candidate, binding));
  next.input.bindings[actionId] = mode === 'add' ? [...existing, binding] : [binding];
  return { settings: next, ok: true, conflict: null };
}
