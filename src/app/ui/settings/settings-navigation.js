import { activeSettingsCategory, renderSettings, settingsCategories } from './settings-view.js';
import { runDOMTransition } from '../transitions.js';

export function setSettingsTab(game, categoryId, { focusElement, updateMenuChrome } = {}) {
  if (!settingsCategories.some(category => category.id === categoryId)) return false;
  runDOMTransition(game, () => {
    game.menu.page = 'settings-category';
    game.menu.settingsCategory = categoryId;
    game.menu.settingsSubpage = null;
    game.input.controllerDebugLock = false;
    game.input.controllerDebugExitStartedAt = 0;
    renderSettings(game);
    updateMenuChrome?.(game);
  }, () => focusElement?.(game.ui.pauseScreen?.querySelector(`[role="tab"][data-settings-tab="${categoryId}"]`)), 'scenario-tab');
  return true;
}

export function moveSettingsTab(game, direction, options = {}) {
  if (!['settings', 'settings-category'].includes(game.menu.page)) return false;
  const activeId = activeSettingsCategory(game).id;
  const index = settingsCategories.findIndex(category => category.id === activeId);
  const next = settingsCategories[(index + direction + settingsCategories.length) % settingsCategories.length];
  return setSettingsTab(game, next.id, options);
}
