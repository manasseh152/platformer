import { visibleFocusables } from '#/ui/navigation.js';
import { renderSettingsCategory } from '../settings/settings-view.js';
import {
  activeMenuRoot,
  focusAndReveal,
  goBack,
  moveHorizontalGroupFocus,
  moveMenuFocus,
  updateMenuChrome
} from './menu-shell.js';

export function selectedSettingsLayerElement(game, layer = game.menu.settingsFocusLayer || 'primary-tabs') {
  const selector = layer === 'nested-tabs'
    ? `[role="tab"][data-controls-page="${game.menu.controlsPage || 'profiles'}"]`
    : layer === 'primary-tabs'
      ? `[role="tab"][data-settings-tab="${game.menu.settingsCategory || 'controls'}"]`
      : null;
  return selector ? game.ui.pauseScreen?.querySelector(selector) : null;
}

export function focusSettingsLayer(game, layer = game.menu.settingsFocusLayer || 'primary-tabs') {
  if (layer === 'content') {
    const panel = game.ui.settingsCategoryBody?.querySelector('.settings-tab-panel');
    const first = visibleFocusables(panel || activeMenuRoot(game))[0];
    if (first) focusAndReveal(game, first);
    return Boolean(first);
  }
  const tab = selectedSettingsLayerElement(game, layer);
  if (tab) focusAndReveal(game, tab);
  return Boolean(tab);
}

export function setSettingsFocusLayer(game, layer) {
  game.menu.settingsFocusLayer = layer;
  renderSettingsCategory(game);
  updateMenuChrome(game);
  return focusSettingsLayer(game, layer);
}

export function moveControlsNestedTab(game, direction) {
  const tabs = [...game.ui.pauseScreen.querySelectorAll('[role="tab"][data-controls-page]')];
  if (!tabs.length) return false;
  const current = tabs.findIndex(tab => tab.dataset.controlsPage === (game.menu.controlsPage || 'profiles'));
  const next = tabs[(current < 0 ? 0 : current + direction + tabs.length) % tabs.length];
  game.menu.controlsPage = next.dataset.controlsPage;
  game.menu.settingsSubpage = null;
  game.menu.settingsFocusLayer = 'nested-tabs';
  renderSettingsCategory(game);
  updateMenuChrome(game);
  focusSettingsLayer(game, 'nested-tabs');
  return true;
}

export function enterSettingsLayer(game) {
  const layer = game.menu.settingsFocusLayer || 'primary-tabs';
  if (layer === 'primary-tabs') return setSettingsFocusLayer(game, game.menu.settingsCategory === 'controls' ? 'nested-tabs' : 'content');
  if (layer === 'nested-tabs') return setSettingsFocusLayer(game, 'content');
  document.activeElement?.click?.();
  return true;
}

export function leaveSettingsLayer(game) {
  const layer = game.menu.settingsFocusLayer || 'primary-tabs';
  if (layer === 'content') return setSettingsFocusLayer(game, game.menu.settingsCategory === 'controls' ? 'nested-tabs' : 'primary-tabs');
  if (layer === 'nested-tabs') return setSettingsFocusLayer(game, 'primary-tabs');
  return goBack(game);
}

export function syncSettingsFocusLayerFromActiveElement(game) {
  const active = document.activeElement;
  if (!activeMenuRoot(game)?.contains(active)) return;
  if (active?.matches?.('[role="tab"][data-settings-tab]')) game.menu.settingsFocusLayer = 'primary-tabs';
  else if (active?.matches?.('[role="tab"][data-controls-page]')) game.menu.settingsFocusLayer = 'nested-tabs';
  else if (active?.closest?.('[data-settings-nav-layer="content"]')) game.menu.settingsFocusLayer = 'content';
}

function activeElementMatchesLayer(game) {
  const active = document.activeElement;
  const layer = game.menu.settingsFocusLayer || 'primary-tabs';
  if (layer === 'primary-tabs') return active?.matches?.('[role="tab"][data-settings-tab]');
  if (layer === 'nested-tabs') return active?.matches?.('[role="tab"][data-controls-page]');
  return Boolean(active?.closest?.('[data-settings-nav-layer="content"]'));
}

export function ensureSettingsLayerFocus(game) {
  const root = activeMenuRoot(game);
  if (root && (!root.contains(document.activeElement) || !activeElementMatchesLayer(game))) focusSettingsLayer(game);
}

export function moveSettingsLayerX(game, direction, { movePrimaryTab } = {}) {
  const layer = game.menu.settingsFocusLayer || 'primary-tabs';
  if (layer === 'primary-tabs') return movePrimaryTab?.(direction) || false;
  if (layer === 'nested-tabs') return moveControlsNestedTab(game, direction);
  if (layer === 'content') return moveHorizontalGroupFocus(game, direction);
  return false;
}

export function moveSettingsLayerY(game, direction) {
  const layer = game.menu.settingsFocusLayer || 'primary-tabs';
  if (direction > 0) {
    if (layer === 'content') {
      if (moveHorizontalGroupFocus(game, -1)) return true;
      moveMenuFocus(game, 1);
      return true;
    }
    return enterSettingsLayer(game);
  }
  if (direction < 0) {
    if (layer === 'content') {
      if (moveHorizontalGroupFocus(game, 1)) return true;
      moveMenuFocus(game, -1);
      return true;
    }
    return leaveSettingsLayer(game);
  }
  return false;
}
