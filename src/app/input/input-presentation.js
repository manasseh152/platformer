import { hintActionAliases, hintPartsForAction } from './input-hints.js';
import { gameInputProfile } from './game-input-profile.js';

const inputPresets = {
  wasd: { move:'A/D', jump:'Space', dash:'Shift', attack:'J', pause:'Esc', restart:'R' },
  arrows: { move:'←/→', jump:'↑', dash:'Shift', attack:'X', pause:'Esc', restart:'R' },
  gamepad: { move:'Left Stick', jump:'A', dash:'RB', attack:'X', pause:'Start', restart:'Back' }
};

const platformForScheme = scheme => scheme === 'gamepad' ? 'gamepad' : 'keyboard';

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

export function renderTabInputHints(input, root = document, gameOrOptions = {}) {
  const options = gameOrOptions.input ? { game: gameOrOptions } : gameOrOptions;
  const game = options.game || null;
  const profile = options.profile || game?.inputRuntime?.profile || gameInputProfile;
  const settings = options.settings || game?.inputRuntime?.settings || game?.settings || null;
  const runtime = game?.inputRuntime || options.runtime || null;
  const inputScheme = input?.inputScheme || options.inputScheme || 'wasd';
  root.querySelectorAll('[data-input-tab-hint]').forEach(el => {
    const actionId = el.dataset.inputAction;
    const consoleActive = typeof options.consoleActive === 'boolean'
      ? options.consoleActive
      : inputScheme === 'gamepad' || runtime?.lastActiveSource?.('player1')?.deviceType === 'gamepad';
    if (!consoleActive || !actionId || !settings?.input?.bindings?.[actionId]) { el.hidden = true; return; }
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
  if (input.inputScheme === scheme) return;
  input.inputScheme = scheme;
  renderGameplayHints(game);
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
    const actionId = el.dataset.inputAction || hintActionAliases[el.dataset.inputHint] || el.dataset.inputHint;
    if (!actionId || !settings?.input?.bindings?.[actionId]) return;
    const hint = hintPartsForAction(profile, settings, actionId, {
      runtime: game?.inputRuntime || options.runtime || null,
      inputScheme: input.inputScheme,
      iconPack: settings.input?.gamepad?.globalIconPack || null,
      label: el.dataset.inputLabel || undefined
    });
    el.dataset.inputAction = actionId;
    el.dataset.inputPlatform = hint.deviceType === 'gamepad' ? 'gamepad' : platform;
    if (['menu.back', 'menu.settings'].includes(actionId)) {
      el.dataset.inputClickable = 'true';
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
    }
    el.innerHTML = hintHtml(hint);
  });
}

const gameplayHintActions = [
  { actionId: 'player.moveX', label: 'Move' },
  { actionId: 'player.jump' },
  { actionId: 'player.dash' },
  { actionId: 'player.attack' },
  { actionId: 'system.pause' },
  { actionId: 'system.restart' }
];

export function renderGameplayHints(game, root = game?.ui?.controlsEl) {
  if (!game || !root) return;
  const settings = game.inputRuntime?.settings || game.settings;
  if (!settings?.input?.bindings) {
    root.textContent = controlsText(game.input);
    return;
  }
  root.innerHTML = gameplayHintActions.map(({ actionId, label }) => {
    const hint = hintPartsForAction(game.inputRuntime?.profile || gameInputProfile, settings, actionId, {
      runtime: game.inputRuntime || null,
      inputScheme: game.input.inputScheme,
      iconPack: settings.input?.gamepad?.globalIconPack || null,
      label
    });
    return `<span class="input-hint input-hint--inline" data-input-action="${escapeHtml(actionId)}" data-input-platform="${hint.deviceType === 'gamepad' ? 'gamepad' : platformForScheme(game.input.inputScheme)}">${hintHtml(hint)}</span>`;
  }).join('');
}

export function controlsText(input) {
  const p = inputPresets[input.inputScheme] || inputPresets.wasd;
  return `Move: ${p.move} · Jump: ${p.jump} · Dash: ${p.dash} · Attack: ${p.attack} · Pause: ${p.pause} · Restart: ${p.restart}`;
}
