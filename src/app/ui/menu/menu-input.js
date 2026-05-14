import { ensureMenuFocus } from '#/ui/navigation.js';
import { isStarted } from '../../app-state.js';
import {
  activeMenuRoot,
  closeSettingsSubpage,
  focusAndReveal,
  goBack,
  returnToMainMenu,
  moveHorizontalGroupFocus,
  moveMenuFocus,
  moveSettingsTab
} from './menu-shell.js';
import {
  ensureSettingsLayerFocus,
  enterSettingsLayer,
  leaveSettingsLayer,
  moveSettingsLayerX,
  moveSettingsLayerY,
  syncSettingsFocusLayerFromActiveElement
} from './settings-layer-navigation.js';

const backablePages = ['level-select', 'settings', 'settings-category'];

function activateSemanticMenuAction(game, actionId) {
  const { ui } = game;
  if (actionId === 'menu.accept') { document.activeElement?.click?.(); return true; }
  if (actionId === 'menu.back') {
    if (backablePages.includes(game.menu.page)) goBack(game);
    else if (isStarted(game)) {
      const now = performance.now?.() || Date.now();
      if (!game.menu.justClosedSettingsAt || now - game.menu.justClosedSettingsAt > 400) ui.resumeButton?.click?.();
    }
    return true;
  }
  if (actionId === 'menu.settings') {
    if (game.menu.page === 'settings' || game.menu.page === 'settings-category') return true;
    if (isStarted(game)) ui.settingsButton?.click?.();
    else ui.startSettingsButton?.click?.();
    return true;
  }
  if (actionId === 'system.restart') { game.resetGame?.(); return true; }
  if (actionId === 'menu.mainMenu') { returnToMainMenu(game); return true; }
  if (actionId === 'menu.levelSelect') { ui.messageLevelSelectButton?.click?.(); return true; }
  if (actionId === 'menu.nextLevel') { ui.messageNextLevelButton?.click?.(); return true; }
  return false;
}

function handleSettingsRouteInput(game, route) {
  ensureSettingsLayerFocus(game);
  syncSettingsFocusLayerFromActiveElement(game);
  if (route.wasPressed('menu.previousTab') && moveSettingsTab(game, -1)) { route.consume('menu.previousTab'); return true; }
  if (route.wasPressed('menu.nextTab') && moveSettingsTab(game, 1)) { route.consume('menu.nextTab'); return true; }

  if (!route.isDown('menu.navigateX')) game.menu.settingsHeldNavigateX = 0;
  if (!route.isDown('menu.navigateY')) game.menu.settingsHeldNavigateY = 0;

  const xSign = Math.sign(route.value('menu.navigateX'));
  if (route.wasPressed('menu.navigateX') || (xSign && xSign !== game.menu.settingsHeldNavigateX)) {
    game.menu.settingsHeldNavigateX = xSign;
    const x = route.value('menu.navigateX') || route.pressedValue?.('menu.navigateX') || 0;
    const direction = x < 0 ? -1 : x > 0 ? 1 : 0;
    if (direction && moveSettingsLayerX(game, direction, { movePrimaryTab: dir => moveSettingsTab(game, dir) })) { route.consume('menu.navigateX'); return true; }
  }

  const ySign = Math.sign(route.value('menu.navigateY'));
  if (route.wasPressed('menu.navigateY') || (ySign && ySign !== game.menu.settingsHeldNavigateY)) {
    game.menu.settingsHeldNavigateY = ySign;
    const y = route.value('menu.navigateY') || route.pressedValue?.('menu.navigateY') || 0;
    route.consume('menu.navigateY');
    if (moveSettingsLayerY(game, y)) return true;
  }

  if (route.wasPressed('menu.accept')) {
    route.consume('menu.accept');
    return enterSettingsLayer(game);
  }

  if (route.wasPressed('menu.back')) {
    route.consume('menu.back');
    return leaveSettingsLayer(game);
  }

  if (route.wasPressed('menu.settings')) {
    route.consume('menu.settings');
    return activateSemanticMenuAction(game, 'menu.settings');
  }

  return false;
}

function handleMenuRouteInput(game, route) {
  if (game.menu.page === 'settings-category' && handleSettingsRouteInput(game, route)) return true;

  ensureMenuFocus(activeMenuRoot(game), game.menu.lastFocused, el => focusAndReveal(game, el));

  if (route.wasPressed('menu.previousTab') && moveSettingsTab(game, -1)) {
    route.consume('menu.previousTab');
    return true;
  }

  if (route.wasPressed('menu.nextTab') && moveSettingsTab(game, 1)) {
    route.consume('menu.nextTab');
    return true;
  }

  if (route.wasPressed('menu.navigateX')) {
    const x = route.value('menu.navigateX') || route.pressedValue?.('menu.navigateX') || 0;
    if (x < 0 && moveHorizontalGroupFocus(game, -1)) { route.consume('menu.navigateX'); return true; }
    if (x > 0 && moveHorizontalGroupFocus(game, 1)) { route.consume('menu.navigateX'); return true; }
  }

  if (route.wasPressed('menu.navigateY')) {
    const y = route.value('menu.navigateY') || route.pressedValue?.('menu.navigateY') || 0;
    if (y < 0) {
      route.consume('menu.navigateY');
      if (moveHorizontalGroupFocus(game, 1)) return true;
      moveMenuFocus(game, -1);
      return true;
    }
    if (y > 0) {
      route.consume('menu.navigateY');
      if (moveHorizontalGroupFocus(game, -1)) return true;
      moveMenuFocus(game, 1);
      return true;
    }
  }

  if (route.wasPressed('menu.accept')) {
    route.consume('menu.accept');
    return activateSemanticMenuAction(game, 'menu.accept');
  }

  if (!isStarted(game) && !backablePages.includes(game.menu.page) && route.wasPressed('menu.settings')) {
    route.consume('menu.settings');
    return activateSemanticMenuAction(game, 'menu.settings');
  }

  if (route.wasPressed('menu.back')) {
    route.consume('menu.back');
    return activateSemanticMenuAction(game, 'menu.back');
  }

  if (route.wasPressed('menu.settings')) {
    route.consume('menu.settings');
    return activateSemanticMenuAction(game, 'menu.settings');
  }

  return false;
}

function handleControllerDebuggerExitHold(game) {
  const { input, ui } = game;
  const inControllerDebugger = game.menu.page === 'settings-category' && (game.menu.settingsCategory === 'controller' || (game.menu.settingsCategory === 'controls' && game.menu.controlsPage === 'controller')) && game.menu.settingsSubpage === 'diagnostics';
  if (!inControllerDebugger || !input.controllerDebugLock) return false;
  if (!input.gamepadDown.has('PadButton1') && !input.gamepadDown.has('PadB')) {
    input.controllerDebugExitStartedAt = 0;
    return false;
  }
  const now = performance.now();
  input.controllerDebugExitStartedAt ||= now;
  const elapsed = now - input.controllerDebugExitStartedAt;
  if (ui.controllerStatus) ui.controllerStatus.textContent = elapsed >= 2000 ? 'Leaving debugger…' : `Hold B / Circle to exit (${Math.ceil((2000 - elapsed) / 1000)}s)`;
  if (elapsed < 2000) return true;
  input.controllerDebugLock = false;
  input.controllerDebugExitStartedAt = 0;
  closeSettingsSubpage(game);
  return true;
}

export function handleMenuInput(game) {
  const { input } = game;
  const root = activeMenuRoot(game);
  if (!root) return false;
  if (handleControllerDebuggerExitHold(game)) return true;
  if (input.controllerDebugLock && game.menu.page === 'settings-category' && (game.menu.settingsCategory === 'controller' || (game.menu.settingsCategory === 'controls' && game.menu.controlsPage === 'controller')) && (input.gamepadPressed.size || input.gamepadDown.size)) return true;
  if (input.controllerBindAction) return false;
  if (input.suppressMenuInputOnce) { input.suppressMenuInputOnce = false; return true; }
  if (input.listeningFor) return false;
  ensureMenuFocus(root, game.menu.lastFocused, el => focusAndReveal(game, el));
  const route = game.inputRuntime?.route(['menu']);
  if (route && handleMenuRouteInput(game, route)) return true;
  return false;
}

export const handleGamepadMenuInput = handleMenuInput;
export { activateSemanticMenuAction };
