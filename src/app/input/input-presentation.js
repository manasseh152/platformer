import { hintActionAliases, hintPartsForAction } from './input-hints.js';
import { gameInputProfile } from './game-input-profile.js';
import { syncHintLayer } from '../ui/hint-layer.js';

const inputPresets = {
  'keyboard-mouse': { move:'A/D', jump:'Space', dash:'Shift', attack:'LMB', pause:'Esc', restart:'R' },
  wasd: { move:'A/D', jump:'Space/W', dash:'Shift', attack:'J', pause:'Esc', restart:'R' },
  arrows: { move:'←/→', jump:'↑', dash:'Shift', attack:'X', pause:'Esc', restart:'R' },
  gamepad: { move:'Left Stick', jump:'A', dash:'RB', attack:'X', pause:'Start', restart:'Back' }
};

const platformForScheme = scheme => scheme === 'gamepad' ? 'gamepad' : scheme === 'keyboard-mouse' ? 'keyboard-mouse' : 'keyboard';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function controlHintHtml(parts) {
  return parts.map(part => part.icon
    ? `<img class="input-hint__icon" src="${escapeHtml(part.icon)}" alt="${escapeHtml(part.label)}">`
    : `<kbd class="ds-keycap">${escapeHtml(part.label)}</kbd>`
  ).join('<span class="input-hint__joiner" aria-hidden="true">/</span>');
}

function hintHtml(hint) {
  const controls = hint.parts.length ? hint.parts : [{ label: 'Unbound' }];
  return `${controlHintHtml(controls)}<span class="input-hint__label">${escapeHtml(hint.label)}</span>`;
}

function splitActionIds(value = '') {
  return String(value).split(/[\s,]+/).map(action => action.trim()).filter(Boolean);
}

function hintPartsForActions(profile, settings, actionIds, options = {}) {
  if (actionIds.length <= 1) return hintPartsForAction(profile, settings, actionIds[0], options);
  const hints = actionIds.map(actionId => hintPartsForAction(profile, settings, actionId, options));
  return {
    actionId: actionIds.join(' '),
    label: options.label || hints.map(hint => hint.label).join(' / '),
    deviceType: hints.find(hint => hint.parts.length)?.deviceType || hints[0]?.deviceType || 'keyboard',
    parts: hints.flatMap(hint => hint.parts)
  };
}

export function renderTabInputHints(input, root = document, gameOrOptions = {}) {
  const options = gameOrOptions.input ? { game: gameOrOptions } : gameOrOptions;
  const game = options.game || null;
  const profile = options.profile || game?.inputRuntime?.profile || gameInputProfile;
  const settings = options.settings || game?.inputRuntime?.settings || game?.settings || null;
  const runtime = game?.inputRuntime || options.runtime || null;
  const inputScheme = input?.inputScheme || options.inputScheme || 'wasd';
  const lastActiveSource = runtime?.lastActiveSource?.();
  const controllerActive = options.consoleActive === false
    ? false
    : inputScheme === 'gamepad' && lastActiveSource?.deviceType === 'gamepad';
  root.querySelectorAll('[data-input-tab-hint]').forEach(el => {
    const actionId = el.dataset.inputAction;
    if (!controllerActive || !actionId || !settings?.input?.bindings?.[actionId]) { el.hidden = true; return; }
    const hint = hintPartsForAction(profile, settings, actionId, {
      runtime,
      inputScheme: 'gamepad',
      deviceType: 'gamepad',
      iconPack: settings.input?.gamepad?.globalIconPack || 'xbox'
    });
    el.hidden = hint.parts.length === 0;
    el.dataset.inputPlatform = 'gamepad';
    el.innerHTML = controlHintHtml(hint.parts);
  });
}

export function setInputScheme(game, scheme) {
  const input = game.input;
  if (input.inputScheme === scheme && game.settings?.input?.activeProfileId === scheme) return;
  input.inputScheme = scheme;
  if (game.settings?.input?.profiles?.[scheme]) game.settings.input.activeProfileId = scheme;
  syncHintLayer(game);
  renderInputHints(input, document, game);
}

export function renderInputHints(input, root = document, gameOrOptions = {}) {
  const options = gameOrOptions.input ? { game: gameOrOptions } : gameOrOptions;
  const game = options.game || null;
  const profile = options.profile || game?.inputRuntime?.profile || gameInputProfile;
  const settings = options.settings || game?.inputRuntime?.settings || game?.settings || null;
  const platform = platformForScheme(input.inputScheme);
  renderTabInputHints(input, root, { ...options, game, profile, settings });
  root.querySelectorAll('[data-input-hint]').forEach(el => {
    const explicitActions = splitActionIds(el.dataset.inputActions);
    const actionId = el.dataset.inputAction || hintActionAliases[el.dataset.inputHint] || el.dataset.inputHint;
    const actionIds = explicitActions.length ? explicitActions : splitActionIds(actionId);
    if (!actionIds.length || actionIds.some(action => !settings?.input?.bindings?.[action])) return;
    const hint = hintPartsForActions(profile, settings, actionIds, {
      runtime: game?.inputRuntime || options.runtime || null,
      inputScheme: input.inputScheme,
      iconPack: settings.input?.gamepad?.globalIconPack || 'xbox',
      label: el.dataset.inputLabel || undefined,
      deviceType: el.dataset.inputDeviceType || undefined
    });
    el.dataset.inputAction = hint.actionId;
    el.dataset.inputPlatform = hint.deviceType === 'gamepad' ? 'gamepad' : platform;
    if (actionIds.some(action => ['menu.back', 'menu.settings'].includes(action))) {
      el.dataset.inputClickable = 'true';
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
    }
    el.innerHTML = hintHtml(hint);
  });
}

export function controlsText(input) {
  const p = inputPresets[input.inputScheme] || inputPresets['keyboard-mouse'];
  return `Move: ${p.move} · Jump: ${p.jump} · Dash: ${p.dash} · Attack: ${p.attack} · Pause: ${p.pause} · Restart: ${p.restart}`;
}
