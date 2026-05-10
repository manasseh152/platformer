import { isPaused, isStarted, isWon } from '../app-state.js';
import { gameInputProfile } from '../input/game-input-profile.js';
import { hintPartsForAction } from '../input/input-hints.js';

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

function hintHtml(hint, entry) {
  const controls = hint.parts.length ? controlHintHtml(hint.parts) : '';
  const label = entry.label || hint.label || entry.fallbackLabel || entry.actionId;
  return `${controls}<span class="input-hint__label">${escapeHtml(label)}</span>`;
}

const gameplayHints = [
  { actionId: 'player.moveX', label: 'Move' },
  { actionId: 'player.jump' },
  { actionId: 'player.dash' },
  { actionId: 'player.attack' },
  { actionId: 'system.pause' },
  { actionId: 'system.restart' }
];

const startHints = [
  { actionId: 'menu.accept', label: 'Select', clickable: true },
  { actionId: 'menu.settings', clickable: true }
];

const pauseMainHints = [
  { actionId: 'menu.accept', label: 'Select', clickable: true },
  { actionId: 'menu.back', label: 'Resume', clickable: true },
  { actionId: 'menu.settings', clickable: true }
];

const subpageHints = [
  { actionId: 'menu.accept', label: 'Select', clickable: true },
  { actionId: 'menu.back', clickable: true }
];

function endHints(game) {
  const hints = [
    { actionId: 'system.restart', clickable: true },
    { actionId: 'menu.levelSelect', label: 'Level Select', clickable: true, fallbackLabel: 'Level Select' }
  ];
  if (game.ui?.messageNextLevelButton && !game.ui.messageNextLevelButton.hidden) {
    hints.push({ actionId: 'menu.nextLevel', label: 'Next Level', clickable: true, fallbackLabel: 'Next Level' });
  }
  return hints;
}

export function hintLayerEntries(game) {
  if (!game) return [];
  if (game.player?.dead || isWon(game)) return endHints(game);
  if (document.body.dataset.menuOrigin === 'start' && ['level-select', 'settings', 'settings-category'].includes(game.menu?.page)) return subpageHints;
  if (isPaused(game)) return game.menu?.page === 'main' ? pauseMainHints : subpageHints;
  if (!isStarted(game)) return startHints;
  return gameplayHints;
}

function signatureFor(game, entries) {
  const settings = game.inputRuntime?.settings || game.settings;
  return JSON.stringify({
    entries,
    scheme: game.input?.inputScheme,
    page: game.menu?.page,
    origin: document.body.dataset.menuOrigin || '',
    started: isStarted(game),
    paused: isPaused(game),
    dead: Boolean(game.player?.dead),
    won: isWon(game),
    nextHidden: Boolean(game.ui?.messageNextLevelButton?.hidden),
    iconPack: settings?.input?.gamepad?.globalIconPack || null,
    bindings: settings?.input?.bindings || null
  });
}

export function syncHintLayer(game, root = game?.ui?.hintLayerEl) {
  if (!game || !root) return;
  const entries = hintLayerEntries(game);
  const signature = signatureFor(game, entries);
  if (root.dataset.hintSignature === signature) return;
  root.dataset.hintSignature = signature;
  root.hidden = entries.length === 0;
  if (!entries.length) {
    root.innerHTML = '';
    return;
  }

  const settings = game.inputRuntime?.settings || game.settings;
  const profile = game.inputRuntime?.profile || gameInputProfile;
  const platform = platformForScheme(game.input?.inputScheme);
  root.innerHTML = entries.map(entry => {
    const hasBinding = Boolean(settings?.input?.bindings?.[entry.actionId]);
    const hint = hasBinding ? hintPartsForAction(profile, settings, entry.actionId, {
      runtime: game.inputRuntime || null,
      inputScheme: game.input?.inputScheme || 'wasd',
      iconPack: settings.input?.gamepad?.globalIconPack || null,
      label: entry.label || undefined
    }) : { parts: [], label: entry.label || entry.fallbackLabel || entry.actionId, deviceType: platform };
    const attrs = `class="input-hint input-hint--layer" data-input-action="${escapeHtml(entry.actionId)}" data-input-platform="${hint.deviceType === 'gamepad' ? 'gamepad' : platform}"`;
    return entry.clickable
      ? `<button type="button" ${attrs} data-input-clickable="true">${hintHtml(hint, entry)}</button>`
      : `<span ${attrs}>${hintHtml(hint, entry)}</span>`;
  }).join('');
}
