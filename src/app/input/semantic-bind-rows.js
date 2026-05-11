import { clone, samePhysicalBinding } from '#/core/input/utils.js';
import { gameInputProfile } from './game-input-profile.js';
import { bindingLabel, gamepadLabel, hintPartForBinding, keyLabel } from './input-hints.js';

export const bindRows = {
  left: { actionId: 'player.moveX', label: 'Move Left', scale: -1 },
  right: { actionId: 'player.moveX', label: 'Move Right', scale: 1 },
  jump: { actionId: 'player.jump', label: 'Jump' },
  dash: { actionId: 'player.dash', label: 'Dash' },
  attack: { actionId: 'player.attack', label: 'Attack' },
  pause: { actionId: 'system.pause', label: 'Pause' },
  restart: { actionId: 'system.restart', label: 'Restart' }
};

export const bindGroups = [
  { title: 'Movement', rows: ['left', 'right', 'jump', 'dash'] },
  { title: 'Actions', rows: ['attack'] },
  { title: 'System', rows: ['pause', 'restart'] }
];

const rowEntries = () => Object.entries(bindRows);
const deviceTypeFor = device => device === 'controller' ? 'gamepad' : device;

function rowMatchesBinding(row, binding, deviceType) {
  if (!binding || binding.deviceType !== deviceType) return false;
  if (row.scale === undefined) return true;
  return binding.control === 'axis' || binding.scale === row.scale || binding.direction === row.scale;
}

function bindingWithRowScale(binding, row) {
  if (row.scale === undefined) return clone(binding);
  const next = clone(binding);
  if (next.deviceType === 'keyboard') next.scale = row.scale;
  if (next.deviceType === 'gamepad' && next.control === 'axisDirection') next.direction = row.scale;
  else if (next.deviceType === 'gamepad' && next.control !== 'button') next.scale = row.scale;
  return next;
}

export function rowForId(rowId) { return bindRows[rowId] || null; }
export function bindLabel(rowId) { return bindRows[rowId]?.label || rowId; }

export function rowBindings(settings, rowId, device = 'keyboard') {
  const row = rowForId(rowId);
  if (!row) return [];
  const deviceType = deviceTypeFor(device);
  return (settings?.input?.bindings?.[row.actionId] || []).filter(binding => rowMatchesBinding(row, binding, deviceType));
}

function rowDisplayBinding(row, binding, device) {
  if (device === 'controller' && row?.scale !== undefined && binding?.control === 'axis') {
    return { ...binding, control: 'axisDirection', direction: row.scale };
  }
  return binding;
}

export function rowHintParts(settings, rowId, device = 'keyboard', options = {}) {
  const row = rowForId(rowId);
  if (!row) return [];
  return rowBindings(settings, rowId, device)
    .map(binding => rowDisplayBinding(row, binding, device))
    .map(binding => hintPartForBinding(binding, options));
}

export function rowText(settings, rowId, device = 'keyboard') {
  const row = rowForId(rowId);
  const bindings = rowBindings(settings, rowId, device);
  if (!bindings.length) return 'Unbound';
  return bindings.map(binding => {
    const displayBinding = rowDisplayBinding(row, binding, device);
    return device === 'controller' ? gamepadLabel(displayBinding) : bindingLabel(displayBinding);
  }).join(' / ');
}

export function findBindRowConflict(settings, rowId, binding) {
  for (const [candidateRowId, row] of rowEntries()) {
    if (candidateRowId === rowId) continue;
    const bindings = settings?.input?.bindings?.[row.actionId] || [];
    if (bindings.some(candidate => samePhysicalBinding(candidate, binding))) {
      return { rowId: candidateRowId, actionId: row.actionId, label: row.label, binding };
    }
  }
  return null;
}

export function commitBindRow(settings, rowId, binding, { device = binding?.deviceType === 'gamepad' ? 'controller' : 'keyboard' } = {}) {
  const row = rowForId(rowId);
  if (!row || !binding) return { settings, ok: false, conflict: null };
  const normalizedBinding = bindingWithRowScale(binding, row);
  const conflict = findBindRowConflict(settings, rowId, normalizedBinding);
  const next = clone(settings);
  if (conflict) return { settings: next, ok: false, conflict };
  const deviceType = deviceTypeFor(device);
  const current = next.input.bindings[row.actionId] || [];
  next.input.bindings[row.actionId] = [
    ...current.filter(candidate => !rowMatchesBinding(row, candidate, deviceType)),
    normalizedBinding
  ];
  return { settings: next, ok: true, conflict: null };
}

export function resetBindRowsToDefaults(settings, device = 'keyboard') {
  const next = clone(settings);
  const deviceType = deviceTypeFor(device);
  for (const row of Object.values(bindRows)) {
    const current = next.input.bindings[row.actionId] || [];
    const defaults = (gameInputProfile.defaultBindings[row.actionId] || []).filter(binding => rowMatchesBinding(row, binding, deviceType));
    const keep = current.filter(binding => !rowMatchesBinding(row, binding, deviceType));
    next.input.bindings[row.actionId] = [...keep, ...clone(defaults)];
  }
  return next;
}

export const displayKeyName = keyLabel;
