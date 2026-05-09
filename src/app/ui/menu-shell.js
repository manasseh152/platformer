import { renderInputHints } from '../input/input-presentation.js';
import { currentFocusElement, ensureMenuFocus, moveHorizontalGroupFocus as moveHorizontalFocus, moveLinearFocus } from '../../ui/navigation.js';
import { setPausedFlag } from '../../state.js';
import { applyMotionPreference, runDOMTransition, shouldReduceMotion } from '../../transitions.js';
import { renderSettings, refreshDynamicRefs, selectedCategory } from '../../settings-ui.js';
import { browserRuntime } from '../../runtime.js';
import { renderScenarioBrowser } from './scenario-browser.js';
import { cancelBindListening } from './settings-actions.js';
import { moveSettingsTab as moveSettingsTabSelection, setSettingsTab as setSettingsTabSelection } from './settings-navigation.js';
import { isPaused, isStarted, isWon, setStarted } from '../app-state.js';
import { markSpeedRunPaused, prepareSpeedRunAttempt } from '../../speedrun.js';

const pageElement = (ui, page) => ({ main: ui.pauseMainPage, 'level-select': ui.levelSelectPage, settings: ui.settingsHubPage, 'settings-category': ui.settingsCategoryPage })[page];

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

export function currentMenuElement(game, root = activeMenuRoot(game)) {
  return currentFocusElement(root, game.menu.lastFocused);
}

export function moveMenuFocus(game, dir) {
  moveLinearFocus(activeMenuRoot(game), game.menu.lastFocused, dir, el => focusAndReveal(game, el));
}

export function moveHorizontalGroupFocus(game, dx) {
  return moveHorizontalFocus(activeMenuRoot(game), game.menu.lastFocused, dx, el => focusAndReveal(game, el));
}

export function setSettingsTab(game, categoryId) {
  return setSettingsTabSelection(game, categoryId, { updateMenuChrome, focusElement: el => focusAndReveal(game, el) });
}

export function moveSettingsTab(game, direction) {
  return moveSettingsTabSelection(game, direction, { updateMenuChrome, focusElement: el => focusAndReveal(game, el) });
}

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

export function closeScenarioBrowser(game) {
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

export function createMenuShellCallbacks() {
  return {
    updateMenuChrome,
    focusAndReveal,
    focusFirstMenuItem,
    activeMenuRoot,
    runDOMTransition
  };
}
