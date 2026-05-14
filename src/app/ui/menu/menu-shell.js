import { renderInputHints } from '../../input/input-presentation.js';
import { syncHintLayer } from '../hint-layer.js';
import { currentFocusElement, ensureMenuFocus, moveHorizontalGroupFocus as moveHorizontalFocus, moveLinearFocus } from '#/ui/navigation.js';
import { setPausedFlag } from '../../game-state.js';
import { applyMotionPreference, runDOMTransition, shouldReduceMotion } from '../transitions.js';
import { renderSettings, refreshDynamicRefs, selectedCategory, settingsCategories } from '../settings/settings-view.js';
import { browserRuntime } from '../../runtime/browser-runtime.js';
import { renderScenarioBrowser } from '../scenario-browser.js';
import { cancelBindListening } from '../settings/settings-actions.js';
import { moveSettingsTab as moveSettingsTabSelection, setSettingsTab as setSettingsTabSelection } from '../settings/settings-navigation.js';
import { isPaused, isStarted, isWon, setStarted } from '../../app-state.js';
import { isTilemapPreviewActive } from '../../tilemaps/tilemap-preview.js';
import { markSpeedRunPaused, prepareSpeedRunAttempt } from '../../speedrun/speedrun.js';

const pageElement = (ui, page) => ({ main: ui.pauseMainPage, 'level-select': ui.levelSelectPage, settings: ui.settingsHubPage, 'settings-category': ui.settingsCategoryPage })[page];

export function activeMenuRoot(game) {
  if (document.body.dataset.menuOrigin === 'start') return pageElement(game.ui, game.menu.page) || game.ui.pauseScreen;
  if (isPaused(game)) return pageElement(game.ui, game.menu.page) || game.ui.pauseScreen;
  if (game.player.dead || isWon(game)) return game.ui.messageEl;
  if (!isStarted(game)) return game.ui.startScreen;
  return null;
}

function syncPreviewPauseActions(game) {
  const preview = isTilemapPreviewActive(game);
  const { ui } = game;
  ui.pauseMainPage?.querySelector('p')?.replaceChildren(document.createTextNode(preview ? 'Preview paused. Restart the run, adjust settings, or close back to the editor.' : 'Take a break, restart the run, or change settings.'));
  if (ui.resumeButton) ui.resumeButton.hidden = preview;
  if (ui.levelSelectButton) ui.levelSelectButton.hidden = preview;
  if (ui.mainMenuButton) ui.mainMenuButton.hidden = preview;
  if (ui.closeGameButton) ui.closeGameButton.hidden = !preview;
  if (ui.restartButton) ui.restartButton.classList.toggle('ds-button--primary', preview);
  if (ui.restartButton) ui.restartButton.classList.toggle('ds-button--secondary', !preview);
}

export function updateMenuChrome(game) {
  const { ui, menu } = game;
  ui.pauseScreen.dataset.menuPage = menu.page;
  ui.pauseScreen.dataset.menuDirection = menu.direction;
  ui.pauseScreen.dataset.currentSettingsCategory = menu.settingsCategory || '';
  ui.pauseScreen.dataset.currentSettingsSubpage = menu.settingsSubpage || '';
  ui.pauseScreen.dataset.settingsFocusLayer = menu.settingsFocusLayer || 'primary-tabs';
  document.body.dataset.menuOrigin = menu.origin;
  const category = selectedCategory(game);
  const scenarioBrowserTitle = game.settings.developerMode || game.session?.developerModeOverride ? 'Scenario Browser' : 'Level Select';
  ui.menuTitle.textContent = menu.page === 'settings-category' && category ? category.title : (menu.page === 'level-select' ? scenarioBrowserTitle : (menu.page === 'settings' ? 'Settings' : 'Paused'));
  ui.menuEyebrow.textContent = menu.page === 'main' ? 'Paused' : (menu.page === 'level-select' ? 'Choose your route' : (menu.page === 'settings-category' ? 'Settings' : (menu.origin === 'start' ? 'Before you begin' : 'Settings')));
  refreshDynamicRefs(game);
  syncPreviewPauseActions(game);
  renderInputHints(game.input, document, game);
  syncHintLayer(game);
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
  if (game.menu.page === 'settings-category') {
    const layer = game.menu.settingsFocusLayer || 'primary-tabs';
    const selector = layer === 'nested-tabs'
      ? `[role="tab"][data-controls-page="${game.menu.controlsPage || 'profiles'}"]`
      : layer === 'primary-tabs'
        ? `[role="tab"][data-settings-tab="${game.menu.settingsCategory || 'controls'}"]`
        : null;
    const tab = selector ? root?.querySelector(selector) : null;
    if (tab) return focusAndReveal(game, tab);
  }
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
  game.input.controllerDebugLock = false;
  game.input.controllerDebugExitStartedAt = 0;
  game.menu.settingsSubpage = null;
  game.menu.settingsFocusLayer = 'primary-tabs';
  return setSettingsTabSelection(game, categoryId, { updateMenuChrome, focusElement: el => focusAndReveal(game, el) });
}

export function moveSettingsTab(game, direction) {
  game.menu.settingsFocusLayer = 'primary-tabs';
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
    game.menu.settingsSubpage = null;
    game.menu.settingsFocusLayer = 'primary-tabs';
    if (page === 'settings-category' && category === 'controls' && !game.menu.controlsPage) game.menu.controlsPage = 'profiles';
    renderSettings(game);
    if (page === 'level-select') renderScenarioBrowser(game);
    updateMenuChrome(game);
  }, () => focusFirstMenuItem(game), direction === 'back' ? 'menu-back' : 'menu-forward');
}

export function openSettings(game, origin) {
  commitMenuPageChange(game, () => {
    game.menu.origin = origin;
    game.menu.page = 'settings-category';
    game.menu.settingsCategory = settingsCategories[0]?.id || null;
    game.menu.settingsSubpage = null;
    game.menu.settingsFocusLayer = 'primary-tabs';
    game.menu.controlsPage = 'profiles';
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
    game.menu.settingsSubpage = null;
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
    game.menu.settingsSubpage = null;
    game.menu.direction = 'back';
    game.menu.origin = origin === 'start' ? 'none' : 'pause';
    updateMenuChrome(game);
  }, () => focusAndReveal(game, origin === 'start' ? game.ui.startLevelSelectButton : game.ui.levelSelectButton), origin === 'start' ? 'menu-to-start' : 'menu-back');
}

export function closeSettingsSubpage(game) {
  if (!game.menu.settingsSubpage) return false;
  commitMenuPageChange(game, () => {
    game.input.controllerDebugLock = false;
    game.input.controllerDebugExitStartedAt = 0;
    game.menu.settingsSubpage = null;
    game.menu.settingsFocusLayer = 'content';
    renderSettings(game);
    updateMenuChrome(game);
  }, () => focusFirstMenuItem(game), 'menu-back');
  return true;
}

export function closeSettings(game) {
  const origin = game.menu.origin;
  commitMenuPageChange(game, () => {
    cancelBindListening(game);
    game.input.controllerDebugLock = false;
    game.input.controllerDebugExitStartedAt = 0;
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    game.menu.settingsSubpage = null;
    game.menu.settingsFocusLayer = 'primary-tabs';
    game.menu.direction = 'back';
    game.menu.origin = origin === 'start' ? 'none' : 'pause';
    game.menu.justClosedSettingsAt = performance.now?.() || Date.now();
    updateMenuChrome(game);
  }, () => focusAndReveal(game, origin === 'start' ? game.ui.startSettingsButton : game.ui.settingsButton), origin === 'start' ? 'menu-to-start' : 'menu-back');
}

export function goBack(game) {
  if (game.menu.page === 'settings-category' && closeSettingsSubpage(game)) return true;
  if (game.menu.page === 'settings-category') return closeSettings(game);
  if (game.menu.page === 'settings') return closeSettings(game);
  if (game.menu.page === 'level-select') return closeScenarioBrowser(game);
}

export function setPaused(game, value, runtime = browserRuntime) {
  if (value) markSpeedRunPaused(game);
  const change = () => {
    game.menu.origin = 'pause';
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    game.menu.settingsSubpage = null;
    document.body.dataset.menuOrigin = 'pause';
    setPausedFlag(game, value, runtime);
    updateMenuChrome(game);
  };
  const after = () => isPaused(game) ? focusAndReveal(game, isTilemapPreviewActive(game) ? game.ui.restartButton : game.ui.resumeButton) : document.activeElement?.blur?.();
  runDOMTransition(game, () => { change(); runtime.emit('game.pause', { paused: isPaused(game) }); }, after, value ? 'pause-open' : 'pause-close');
}

export function startGame(game, runtime = browserRuntime) {
  if (isStarted(game)) return;
  runDOMTransition(game, () => {
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    game.menu.settingsSubpage = null;
    document.body.dataset.menuOrigin = 'pause';
    setStarted(game, true);
    game.clock.last = runtime.now();
    document.body.classList.add('playing');
    prepareSpeedRunAttempt(game);
    runtime.emit('game.start', { tilemapId: game.tilemap?.id || null });
    updateMenuChrome(game);
  }, () => game.canvas.focus?.({ preventScroll: true }), 'game-start');
}

export function closeGameWindow() {
  if (typeof window === 'undefined') return;
  window.close();
  window.setTimeout(() => {
    if (!window.closed) window.location.assign('/editor.html');
  }, 80);
}

export function returnToMainMenu(game, runtime = browserRuntime) {
  runDOMTransition(game, () => {
    game.resetGame();
    setStarted(game, false);
    setPausedFlag(game, false, runtime);
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    game.menu.settingsSubpage = null;
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
