import { clone, samePhysicalBinding } from '#/core/input/utils.js';
import { defaultInputSettings } from '#/core/input/settings.js';
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
const profileIds = new Set(['keyboard-mouse', 'wasd', 'arrows', 'controller']);
const deviceTypeFor = device => device === 'controller' ? 'gamepad' : device;
const deviceTypesFor = device => device === 'keyboard-mouse' ? ['keyboard', 'pointer'] : [deviceTypeFor(device)];
const profileBindingsFor = (settings, profileId, actionId) => settings?.input?.profiles?.[profileId]?.bindings?.[actionId];

function rowMatchesBinding(row, binding, deviceType) {
  const types = Array.isArray(deviceType) ? deviceType : [deviceType];
  if (!binding || !types.includes(binding.deviceType)) return false;
  if (row.scale === undefined) return true;
  return binding.control === 'axis' || binding.scale === row.scale || binding.direction === row.scale;
}

function bindingWithRowScale(binding, row) {
  if (row.scale === undefined) return clone(binding);
  const next = clone(binding);
  if (next.deviceType === 'keyboard' || next.deviceType === 'pointer') next.scale = row.scale;
  if (next.deviceType === 'gamepad' && next.control === 'axisDirection') next.direction = row.scale;
  else if (next.deviceType === 'gamepad' && next.control !== 'button') next.scale = row.scale;
  return next;
}

export function rowForId(rowId) { return bindRows[rowId] || null; }
export function bindLabel(rowId) { return bindRows[rowId]?.label || rowId; }

export function rowBindings(settings, rowId, device = 'keyboard') {
  const row = rowForId(rowId);
  if (!row) return [];
  const deviceType = deviceTypesFor(device);
  const source = profileIds.has(device) ? profileBindingsFor(settings, device, row.actionId) || [] : settings?.input?.bindings?.[row.actionId] || [];
  return source.filter(binding => rowMatchesBinding(row, binding, deviceType));
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

export function findBindRowConflict(settings, rowId, binding, { profileId = null } = {}) {
  for (const [candidateRowId, row] of rowEntries()) {
    if (candidateRowId === rowId) continue;
    const bindings = profileId ? profileBindingsFor(settings, profileId, row.actionId) || [] : settings?.input?.bindings?.[row.actionId] || [];
    if (bindings.some(candidate => samePhysicalBinding(candidate, binding))) {
      return { rowId: candidateRowId, actionId: row.actionId, label: row.label, binding };
    }
  }
  return null;
}

export function commitBindRow(settings, rowId, binding, { device = binding?.deviceType === 'gamepad' ? 'controller' : 'keyboard', profileId = profileIds.has(device) ? device : null, mode = 'replace' } = {}) {
  const row = rowForId(rowId);
  if (!row || !binding) return { settings, ok: false, conflict: null };
  const normalizedBinding = bindingWithRowScale(binding, row);
  const conflict = findBindRowConflict(settings, rowId, normalizedBinding, { profileId });
  const next = clone(settings);
  if (conflict) return { settings: next, ok: false, conflict };
  const deviceType = deviceTypesFor(device);
  const target = profileId ? (next.input.profiles[profileId].bindings ||= {}) : next.input.bindings;
  const current = target[row.actionId] || [];
  target[row.actionId] = [
    ...(mode === 'add' ? current : current.filter(candidate => !rowMatchesBinding(row, candidate, deviceType))),
    normalizedBinding
  ];
  return { settings: next, ok: true, conflict: null };
}

export function resetBindRowsToDefaults(settings, device = 'keyboard') {
  const next = clone(settings);
  const profileId = profileIds.has(device) ? device : null;
  const deviceType = deviceTypesFor(device);
  const target = profileId ? (next.input.profiles[profileId].bindings ||= {}) : next.input.bindings;
  const defaultTarget = profileId ? defaultInputSettings(gameInputProfile).input.profiles[profileId].bindings : gameInputProfile.defaultBindings;
  for (const row of Object.values(bindRows)) {
    const current = target[row.actionId] || [];
    const defaults = (defaultTarget[row.actionId] || []).filter(binding => rowMatchesBinding(row, binding, deviceType));
    const keep = current.filter(binding => !rowMatchesBinding(row, binding, deviceType));
    target[row.actionId] = [...keep, ...clone(defaults)];
  }
  return next;
}

export const displayKeyName = keyLabel;
