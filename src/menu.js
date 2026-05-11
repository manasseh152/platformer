import { menuButtons } from './app/input/legacy-bind-state.js';
import { renderInputHints } from './app/input/input-presentation.js';
import { syncHintLayer } from './app/ui/hint-layer.js';
import { ensureMenuFocus } from './ui/navigation.js';
import { setPausedFlag } from './state.js';
import { setupMotionPreference } from './transitions.js';
import { renderSettings } from './settings-ui.js';
import { browserRuntime } from './runtime.js';
import { renderSelectedTilemapSummary, selectScenario, setLevelSelectTab } from './app/ui/scenario-browser.js';
import { handleListeningKey, handleSettingsActionsClick, renderBinds } from './app/ui/settings-actions.js';
import { isStarted, setStarted } from './app/app-state.js';
import {
  activeMenuRoot,
  closeScenarioBrowser,
  createMenuShellCallbacks,
  focusAndReveal,
  focusFirstMenuItem,
  goBack,
  moveHorizontalGroupFocus,
  moveMenuFocus,
  moveSettingsTab,
  openScenarioBrowser,
  openSettings,
  returnToMainMenu,
  setMenuPage,
  setPaused,
  setSettingsTab,
  startGame,
  updateMenuChrome
} from './app/ui/menu-shell.js';

export {
  activeMenuRoot,
  focusAndReveal,
  focusFirstMenuItem,
  goBack,
  moveMenuFocus,
  openScenarioBrowser,
  openSettings,
  returnToMainMenu,
  setMenuPage,
  setPaused,
  startGame,
  updateMenuChrome
};

const backablePages = ['level-select', 'settings', 'settings-category'];

function activateSemanticMenuAction(game, actionId) {
  const { ui } = game;
  if (actionId === 'menu.accept') { document.activeElement?.click?.(); return true; }
  if (actionId === 'menu.back') {
    if (backablePages.includes(game.menu.page)) goBack(game);
    else if (isStarted(game)) ui.resumeButton.click();
    return true;
  }
  if (actionId === 'menu.settings') {
    if (game.menu.page === 'settings' || game.menu.page === 'settings-category') return true;
    if (isStarted(game)) ui.settingsButton?.click?.();
    else ui.startSettingsButton?.click?.();
    return true;
  }
  if (actionId === 'system.restart') { game.resetGame?.(); return true; }
  if (actionId === 'menu.levelSelect') { ui.messageLevelSelectButton?.click?.(); return true; }
  if (actionId === 'menu.nextLevel') { ui.messageNextLevelButton?.click?.(); return true; }
  return false;
}

function handleMenuRouteInput(game, route) {
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
    const x = route.value('menu.navigateX');
    if (x < 0 && moveHorizontalGroupFocus(game, -1)) { route.consume('menu.navigateX'); return true; }
    if (x > 0 && moveHorizontalGroupFocus(game, 1)) { route.consume('menu.navigateX'); return true; }
  }

  if (route.wasPressed('menu.navigateY')) {
    const y = route.value('menu.navigateY');
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

function handleLegacyGamepadMenuInput(game) {
  const { input } = game;
  if (input.gamepadPressed.has(menuButtons.previousTab) && moveSettingsTab(game, -1)) return true;
  if (input.gamepadPressed.has(menuButtons.nextTab) && moveSettingsTab(game, 1)) return true;
  if (input.gamepadPressed.has(menuButtons.left) && moveHorizontalGroupFocus(game, -1)) return true;
  if (input.gamepadPressed.has(menuButtons.right) && moveHorizontalGroupFocus(game, 1)) return true;
  if (input.gamepadPressed.has(menuButtons.up)) {
    if (moveHorizontalGroupFocus(game, 1)) return true;
    moveMenuFocus(game, -1);
    return true;
  }
  if (input.gamepadPressed.has(menuButtons.down)) {
    if (moveHorizontalGroupFocus(game, -1)) return true;
    moveMenuFocus(game, 1);
    return true;
  }
  if (input.gamepadPressed.has(menuButtons.accept)) return activateSemanticMenuAction(game, 'menu.accept');
  if (input.gamepadPressed.has(menuButtons.back)) return activateSemanticMenuAction(game, 'menu.back');
  return false;
}

export function handleMenuInput(game) {
  const { input } = game;
  const root = activeMenuRoot(game);
  if (!root) return false;
  if (input.controllerDebugLock && game.menu.page === 'settings-category' && game.menu.settingsCategory === 'controller' && (input.gamepadPressed.size || input.gamepadDown.size)) return true;
  if (input.controllerBindAction) return false;
  if (input.suppressMenuInputOnce) { input.suppressMenuInputOnce = false; return true; }
  if (input.listeningFor) return false;
  ensureMenuFocus(root, game.menu.lastFocused, el => focusAndReveal(game, el));
  const route = game.inputRuntime?.route(['menu']);
  if (route && handleMenuRouteInput(game, route)) return true;
  return input.useController && handleLegacyGamepadMenuInput(game);
}

export const handleGamepadMenuInput = handleMenuInput;

export { handleListeningKey, renderBinds };

function handleSettingsClick(game, e, runtime = browserRuntime) {
  const tabButton = e.target.closest('button[data-level-select-tab]');
  if (tabButton) return setLevelSelectTab(game, tabButton.dataset.levelSelectTab, el => focusAndReveal(game, el));
  const editDraft = e.target.closest('button[data-local-draft-edit]')?.dataset.localDraftEdit;
  if (editDraft) return window.location.assign(`/editor.html?draft=${encodeURIComponent(editDraft)}`);
  if (e.target.closest('[data-open-map-editor]')) return window.location.assign('/editor.html');
  const scenarioButton = e.target.closest('button[data-scenario-id]');
  if (scenarioButton) return selectScenario(game, scenarioButton.dataset.scenarioId, { closeScenarioBrowser });
  if (e.target.closest('[data-level-select-back]')) return goBack(game);
  const settingsTab = e.target.closest('button[data-settings-tab]');
  if (settingsTab) return setSettingsTab(game, settingsTab.dataset.settingsTab);
  const categoryButton = e.target.closest('[data-settings-category]');
  if (categoryButton) return setMenuPage(game, 'settings-category', 'forward', categoryButton.dataset.settingsCategory);
  const backButton = e.target.closest('[data-settings-back]');
  if (backButton) return goBack(game);
  return handleSettingsActionsClick(game, e, runtime, createMenuShellCallbacks());
}

export function setupMenu(game, runtime = browserRuntime) {
  const { ui } = game;
  setupMotionPreference(game);
  renderSettings(game);
  updateMenuChrome(game);
  renderInputHints(game.input, document, game);
  syncHintLayer(game);

  for (let i = 0; i < 5; i++) {
    const heart = document.createElement('span');
    heart.className = 'heart full';
    ui.heartsEl.appendChild(heart);
  }

  addEventListener('focusin', e => {
    game.menu.lastFocused = e.target;
    document.querySelectorAll('.controller-focus').forEach(node => { if (node !== e.target) node.classList.remove('controller-focus'); });
  });

  renderSelectedTilemapSummary(game);

  ui.startButton.addEventListener('click', () => startGame(game, runtime));
  ui.startLevelSelectButton.addEventListener('click', () => openScenarioBrowser(game, 'start'));
  ui.startEditorButton.addEventListener('click', () => window.location.assign('/editor'));
  ui.startSettingsButton.addEventListener('click', () => openSettings(game, 'start'));
  ui.resumeButton.addEventListener('click', () => setPaused(game, false, runtime));
  ui.restartButton.addEventListener('click', () => game.resetGame());
  ui.mainMenuButton.addEventListener('click', () => returnToMainMenu(game, runtime));
  ui.levelSelectButton.addEventListener('click', () => openScenarioBrowser(game, 'pause'));
  ui.settingsButton.addEventListener('click', () => openSettings(game, 'pause'));
  ui.messageRestartButton.addEventListener('click', () => game.resetGame());
  ui.messageNextLevelButton.addEventListener('click', () => {
    const result = game.tilemaps.switchToNextTilemap();
    if (!result.ok) return;
    setPausedFlag(game, false, runtime);
    setStarted(game, true);
    runtime.emit('game.next-level', { tilemapId: game.tilemap?.id || null });
    document.body.classList.add('playing');
    document.body.classList.remove('game-won', 'game-over');
    game.canvas.focus?.({ preventScroll: true });
  });
  ui.messageLevelSelectButton.addEventListener('click', () => {
    setPausedFlag(game, true, runtime);
    openScenarioBrowser(game, 'pause');
  });
  const handleHintActivation = e => {
    const hintAction = e.target.closest('[data-input-clickable="true"]')?.dataset.inputAction;
    return Boolean(hintAction && activateSemanticMenuAction(game, hintAction));
  };
  ui.startScreen.addEventListener('click', e => { handleHintActivation(e); });
  ui.startScreen.addEventListener('keydown', e => {
    if (!['Enter', 'Space'].includes(e.code) || !handleHintActivation(e)) return;
    e.preventDefault();
  });
  ui.pauseScreen.addEventListener('click', e => { if (!handleHintActivation(e)) handleSettingsClick(game, e, runtime); });
  ui.pauseScreen.addEventListener('keydown', e => {
    if (!['Enter', 'Space'].includes(e.code) || !handleHintActivation(e)) return;
    e.preventDefault();
  });
  ui.hintLayerEl?.addEventListener('click', e => { handleHintActivation(e); });
  ui.hintLayerEl?.addEventListener('keydown', e => {
    if (!['Enter', 'Space'].includes(e.code) || !handleHintActivation(e)) return;
    e.preventDefault();
  });

  requestAnimationFrame(() => focusAndReveal(game, ui.startButton));
}
