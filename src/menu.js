import { menuButtons } from './app/input/legacy-bind-state.js';
import { renderInputHints } from './app/input/input-presentation.js';
import { currentFocusElement, ensureMenuFocus, moveHorizontalGroupFocus as moveHorizontalFocus, moveLinearFocus } from './ui/navigation.js';
import { setPausedFlag } from './state.js';
import { applyMotionPreference, runDOMTransition, shouldReduceMotion, setupMotionPreference } from './transitions.js';
import { renderSettings, refreshDynamicRefs, selectedCategory } from './settings-ui.js';
import { browserRuntime } from './runtime.js';
import { renderScenarioBrowser, renderSelectedTilemapSummary, selectScenario, setLevelSelectTab } from './app/ui/scenario-browser.js';
import { handleListeningKey, cancelBindListening, handleSettingsActionsClick, renderBinds } from './app/ui/settings-actions.js';
import { moveSettingsTab as moveSettingsTabSelection, setSettingsTab as setSettingsTabSelection } from './app/ui/settings-navigation.js';
import { isPaused, isStarted, isWon, setStarted } from './app/app-state.js';
import { markSpeedRunPaused, prepareSpeedRunAttempt } from './speedrun.js';

const pageElement = (ui, page) => ({ main: ui.pauseMainPage, 'level-select': ui.levelSelectPage, settings: ui.settingsHubPage, 'settings-category': ui.settingsCategoryPage })[page];
const backablePages = ['level-select', 'settings', 'settings-category'];

export function activeMenuRoot(game) {
  if (document.body.dataset.menuOrigin === 'start') return pageElement(game.ui, game.menu.page) || game.ui.pauseScreen;
  if (isPaused(game)) return pageElement(game.ui, game.menu.page) || game.ui.pauseScreen;
  if (game.player.dead || isWon(game)) return game.ui.messageEl;
  if (!isStarted(game)) return game.ui.startScreen;
  return null;
}

export function updateMenuChrome(game) {
  const { ui, menu } = game;
  ui.pauseScreen.dataset.menuPage = menu.page;
  ui.pauseScreen.dataset.menuDirection = menu.direction;
  ui.pauseScreen.dataset.currentSettingsCategory = menu.settingsCategory || '';
  document.body.dataset.menuOrigin = menu.origin;
  const category = selectedCategory(game);
  const scenarioBrowserTitle = game.settings.developerMode || game.session?.developerModeOverride ? 'Scenario Browser' : 'Level Select';
  ui.menuTitle.textContent = menu.page === 'settings-category' && category ? category.title : (menu.page === 'level-select' ? scenarioBrowserTitle : (menu.page === 'settings' ? 'Settings' : 'Paused'));
  ui.menuEyebrow.textContent = menu.page === 'main' ? 'Paused' : (menu.page === 'level-select' ? 'Choose your route' : (menu.page === 'settings-category' ? 'Settings' : (menu.origin === 'start' ? 'Before you begin' : 'Settings')));
  refreshDynamicRefs(game);
  renderInputHints(game.input, document, game);
  if (ui.pauseBackHint) {
    ui.pauseBackHint.removeAttribute('data-level-select-back');
    ui.pauseBackHint.removeAttribute('data-settings-back');
  }
  if (ui.pauseSettingsHint) ui.pauseSettingsHint.hidden = menu.page === 'settings' || menu.page === 'settings-category';
  if (ui.developerTools) ui.developerTools.hidden = !game.settings.developerMode;
  applyMotionPreference(game);
}

export function focusAndReveal(game, el) {
  if (!el) return;
  document.querySelectorAll('.controller-focus').forEach(node => node.classList.remove('controller-focus'));
  el.focus({ preventScroll: true });
  el.classList.add('controller-focus');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (document.activeElement === el) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: shouldReduceMotion(game) ? 'auto' : 'smooth' });
  }));
}

export function focusFirstMenuItem(game) {
  const root = activeMenuRoot(game);
  ensureMenuFocus(root, game.menu.lastFocused, el => focusAndReveal(game, el));
}

function currentMenuElement(game, root = activeMenuRoot(game)) {
  return currentFocusElement(root, game.menu.lastFocused);
}

export function moveMenuFocus(game, dir) {
  moveLinearFocus(activeMenuRoot(game), game.menu.lastFocused, dir, el => focusAndReveal(game, el));
}

function moveHorizontalGroupFocus(game, dx) {
  return moveHorizontalFocus(activeMenuRoot(game), game.menu.lastFocused, dx, el => focusAndReveal(game, el));
}

function setSettingsTab(game, categoryId) {
  return setSettingsTabSelection(game, categoryId, { updateMenuChrome, focusElement: el => focusAndReveal(game, el) });
}

function moveSettingsTab(game, direction) {
  return moveSettingsTabSelection(game, direction, { updateMenuChrome, focusElement: el => focusAndReveal(game, el) });
}

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

function commitMenuPageChange(game, change, after, context = 'menu-forward') {
  runDOMTransition(game, change, () => requestAnimationFrame(() => after?.()), context);
}

export function setMenuPage(game, page, direction = 'forward', category = null) {
  commitMenuPageChange(game, () => {
    game.menu.page = page;
    game.menu.direction = direction;
    game.menu.settingsCategory = category;
    renderSettings(game);
    if (page === 'level-select') renderScenarioBrowser(game);
    updateMenuChrome(game);
  }, () => focusFirstMenuItem(game), direction === 'back' ? 'menu-back' : 'menu-forward');
}

export function openSettings(game, origin) {
  commitMenuPageChange(game, () => {
    game.menu.origin = origin;
    game.menu.page = 'settings';
    game.menu.settingsCategory = null;
    game.menu.direction = 'forward';
    renderSettings(game);
    updateMenuChrome(game);
  }, () => focusFirstMenuItem(game), origin === 'start' ? 'start-to-settings' : 'menu-forward');
}

export function openScenarioBrowser(game, origin) {
  commitMenuPageChange(game, () => {
    game.menu.origin = origin;
    game.menu.page = 'level-select';
    game.menu.settingsCategory = null;
    game.menu.direction = 'forward';
    renderScenarioBrowser(game);
    updateMenuChrome(game);
  }, () => focusFirstMenuItem(game), origin === 'start' ? 'start-to-level-select' : 'menu-forward');
}

function closeScenarioBrowser(game) {
  const origin = game.menu.origin;
  commitMenuPageChange(game, () => {
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    game.menu.direction = 'back';
    game.menu.origin = origin === 'start' ? 'none' : 'pause';
    updateMenuChrome(game);
  }, () => focusAndReveal(game, origin === 'start' ? game.ui.startLevelSelectButton : game.ui.levelSelectButton), origin === 'start' ? 'menu-to-start' : 'menu-back');
}

export function closeSettings(game) {
  const origin = game.menu.origin;
  commitMenuPageChange(game, () => {
    cancelBindListening(game);
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    game.menu.direction = 'back';
    game.menu.origin = origin === 'start' ? 'none' : 'pause';
    updateMenuChrome(game);
  }, () => focusAndReveal(game, origin === 'start' ? game.ui.startSettingsButton : game.ui.settingsButton), origin === 'start' ? 'menu-to-start' : 'menu-back');
}

export function goBack(game) {
  if (game.menu.page === 'settings-category') return setMenuPage(game, 'settings', 'back');
  if (game.menu.page === 'settings') return closeSettings(game);
  if (game.menu.page === 'level-select') return closeScenarioBrowser(game);
}

export function setPaused(game, value, runtime = browserRuntime) {
  if (value) markSpeedRunPaused(game);
  const change = () => {
    game.menu.origin = 'pause';
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    document.body.dataset.menuOrigin = 'pause';
    setPausedFlag(game, value, runtime);
    updateMenuChrome(game);
  };
  const after = () => isPaused(game) ? focusAndReveal(game, game.ui.resumeButton) : document.activeElement?.blur?.();
  runDOMTransition(game, () => { change(); runtime.emit('game.pause', { paused: isPaused(game) }); }, after, value ? 'pause-open' : 'pause-close');
}

export function startGame(game, runtime = browserRuntime) {
  if (isStarted(game)) return;
  runDOMTransition(game, () => {
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    document.body.dataset.menuOrigin = 'pause';
    setStarted(game, true);
    game.clock.last = runtime.now();
    document.body.classList.add('playing');
    prepareSpeedRunAttempt(game);
    runtime.emit('game.start', { tilemapId: game.tilemap?.id || null });
    updateMenuChrome(game);
  }, () => game.canvas.focus?.({ preventScroll: true }), 'game-start');
}

export function returnToMainMenu(game, runtime = browserRuntime) {
  runDOMTransition(game, () => {
    game.resetGame();
    setStarted(game, false);
    setPausedFlag(game, false, runtime);
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    game.menu.origin = 'pause';
    document.body.classList.remove('playing', 'paused');
    document.body.dataset.menuOrigin = 'pause';
    game.input.keys.clear();
    game.input.pressed.clear();
    updateMenuChrome(game);
  }, () => focusAndReveal(game, game.ui.startButton), 'main-menu');
}

function settingsActionCallbacks() {
  return {
    updateMenuChrome,
    focusAndReveal,
    focusFirstMenuItem,
    activeMenuRoot,
    runDOMTransition
  };
}

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
  return handleSettingsActionsClick(game, e, runtime, settingsActionCallbacks());
}


export function setupMenu(game, runtime = browserRuntime) {
  const { ui } = game;
  setupMotionPreference(game);
  renderSettings(game);
  updateMenuChrome(game);
  renderInputHints(game.input, document, game);

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

  requestAnimationFrame(() => focusAndReveal(game, ui.startButton));
}
