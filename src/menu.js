import { bindKey, bindLabels, findBindConflict, menuButtons, renderInputHints, resetControllerInput, resetDefaultGamepadBinds, resetDefaultKeyBinds, setBindStatus, setControllerStatus } from './input.js';
import { syncSettingsFromInput, replaceSettings, saveSettings, serializeSettings } from './settings.js';
import { setPausedFlag } from './state.js';
import { applyMotionPreference, runDOMTransition, shouldReduceMotion, setupMotionPreference } from './transitions.js';
import { renderSettings, renderSettingsCategory, refreshDynamicRefs, selectedCategory } from './settings-ui.js';

const pageElement = (ui, page) => ({ main: ui.pauseMainPage, settings: ui.settingsHubPage, 'settings-category': ui.settingsCategoryPage })[page];
const settingsPages = ['settings', 'settings-category'];
const motionOrder = ['system', 'on', 'off'];

export function visibleFocusables(root) {
  return [...root.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')]
    .filter(el => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden');
}

export function activeMenuRoot(game) {
  if (document.body.dataset.menuOrigin === 'start') return pageElement(game.ui, game.menu.page) || game.ui.pauseScreen;
  if (!game.flags.started) return game.ui.startScreen;
  if (game.flags.paused) return pageElement(game.ui, game.menu.page) || game.ui.pauseScreen;
  return null;
}

export function updateMenuChrome(game) {
  const { ui, menu } = game;
  ui.pauseScreen.dataset.menuPage = menu.page;
  ui.pauseScreen.dataset.menuDirection = menu.direction;
  ui.pauseScreen.dataset.currentSettingsCategory = menu.settingsCategory || '';
  document.body.dataset.menuOrigin = menu.origin;
  const category = selectedCategory(game);
  ui.menuTitle.textContent = menu.page === 'settings-category' && category ? category.title : (menu.page === 'settings' ? 'Settings' : 'Paused');
  ui.menuEyebrow.textContent = menu.page === 'main' ? 'Paused' : (menu.page === 'settings-category' ? 'Settings' : (menu.origin === 'start' ? 'Before you begin' : 'Settings'));
  refreshDynamicRefs(game);
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
  focusAndReveal(game, root && visibleFocusables(root)[0]);
}

export function moveMenuFocus(game, dir) {
  const root = activeMenuRoot(game);
  if (!root) return;
  const items = visibleFocusables(root);
  if (!items.length) return;
  const current = items.indexOf(document.activeElement);
  focusAndReveal(game, items[current < 0 ? 0 : (current + dir + items.length) % items.length]);
}

function moveHorizontalGroupFocus(game, dx) {
  const group = document.activeElement?.closest?.('.settings-actions, .segmented');
  if (!group) return false;
  const items = visibleFocusables(group);
  const index = items.indexOf(document.activeElement);
  if (index < 0) return false;
  focusAndReveal(game, items[Math.max(0, Math.min(items.length - 1, index + dx))]);
  return true;
}

export function handleGamepadMenuInput(game) {
  const { input, ui } = game;
  const root = activeMenuRoot(game);
  if (!root) return false;
  if (input.controllerBindAction) return false;
  if (input.suppressMenuInputOnce) { input.suppressMenuInputOnce = false; return true; }
  if (input.listeningFor) return false;
  const focusables = visibleFocusables(root);
  if (!root.contains(document.activeElement) || !focusables.includes(document.activeElement)) focusFirstMenuItem(game);
  if (input.gamepadPressed.has(menuButtons.left)) return moveHorizontalGroupFocus(game, -1);
  if (input.gamepadPressed.has(menuButtons.right)) return moveHorizontalGroupFocus(game, 1);
  if (input.gamepadPressed.has(menuButtons.up)) { moveMenuFocus(game, -1); return true; }
  if (input.gamepadPressed.has(menuButtons.down)) { moveMenuFocus(game, 1); return true; }
  if (input.gamepadPressed.has(menuButtons.accept)) { document.activeElement?.click?.(); return true; }
  if (input.gamepadPressed.has(menuButtons.back)) { if (settingsPages.includes(game.menu.page)) goBack(game); else if (game.flags.started) ui.resumeButton.click(); return true; }
  return false;
}

export function cancelBindListening(game, message = '') {
  const { input, ui } = game;
  input.listeningFor = null;
  input.controllerBindAction = null;
  input.bindMode = 'replace';
  input.bindDeadline = 0;
  if (game.bindListenTimer) clearTimeout(game.bindListenTimer);
  game.bindListenTimer = null;
  renderSettingsCategory(game);
  if (message) setBindStatus(ui, message);
}

export function startBindListening(game, action, type) {
  const { input, ui } = game;
  if (game.bindListenTimer) clearTimeout(game.bindListenTimer);
  input.bindError = null;
  input.listeningFor = type === 'keyboard' ? action : null;
  input.controllerBindAction = type === 'controller' ? action : null;
  input.bindMode = 'replace';
  input.bindDeadline = performance.now() + 6000;
  const label = bindLabels[action];
  setBindStatus(ui, type === 'keyboard' ? `Press a key for ${label}. Escape cancels.` : `Press a controller button for ${label}. B / Circle cancels.`);
  renderSettingsCategory(game);
  game.bindListenTimer = setTimeout(() => cancelBindListening(game, 'Listening cancelled.'), 6000);
}

export function renderBinds(game) {
  renderSettingsCategory(game);
}

function commitMenuPageChange(game, change, after) {
  change();
  requestAnimationFrame(() => after?.());
}

export function setMenuPage(game, page, direction = 'forward', category = null) {
  commitMenuPageChange(game, () => {
    game.menu.page = page;
    game.menu.direction = direction;
    game.menu.settingsCategory = category;
    renderSettings(game);
    updateMenuChrome(game);
  }, () => focusFirstMenuItem(game));
}

export function openSettings(game, origin) {
  commitMenuPageChange(game, () => {
    game.menu.origin = origin;
    game.menu.page = 'settings';
    game.menu.settingsCategory = null;
    game.menu.direction = 'forward';
    renderSettings(game);
    updateMenuChrome(game);
  }, () => focusFirstMenuItem(game));
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
  }, () => focusAndReveal(game, origin === 'start' ? game.ui.startSettingsButton : game.ui.settingsButton));
}

export function goBack(game) {
  if (game.menu.page === 'settings-category') return setMenuPage(game, 'settings', 'back', null);
  if (game.menu.page === 'settings') return closeSettings(game);
}

export function setPaused(game, value) {
  const change = () => {
    game.menu.origin = 'pause';
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    document.body.dataset.menuOrigin = 'pause';
    setPausedFlag(game, value);
    updateMenuChrome(game);
  };
  const after = () => game.flags.paused ? focusAndReveal(game, game.ui.resumeButton) : document.activeElement?.blur?.();
  if (!value) { change(); after(); return; }
  runDOMTransition(game, change, after);
}

export function startGame(game) {
  if (game.flags.started) return;
  game.menu.page = 'main';
  game.menu.settingsCategory = null;
  document.body.dataset.menuOrigin = 'pause';
  game.flags.started = true;
  game.clock.last = performance.now();
  document.body.classList.add('playing');
  game.canvas.focus?.({ preventScroll: true });
  updateMenuChrome(game);
}

export function returnToMainMenu(game) {
  runDOMTransition(game, () => {
    game.resetGame();
    game.flags.started = false;
    game.flags.paused = false;
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    game.menu.origin = 'pause';
    document.body.classList.remove('playing', 'paused');
    document.body.dataset.menuOrigin = 'pause';
    game.input.keys.clear();
    game.input.pressed.clear();
    updateMenuChrome(game);
  }, () => focusAndReveal(game, game.ui.startButton));
}

function dumpSettings(game) {
  game.ui.settingsJson.value = serializeSettings(game);
  game.ui.settingsJson.select();
  game.ui.settingsJsonStatus.textContent = 'Dumped app settings.';
}

function handleReplaceSettings(game) {
  const { ui } = game;
  let normalized;
  try { normalized = JSON.parse(ui.settingsJson.value); } catch (err) { ui.settingsJsonStatus.textContent = `Replace failed: ${err.message}`; return; }
  if (!confirm('Replace all app settings?')) return;
  const developerWasVisible = game.settings.developerMode && game.menu.page === 'settings-category';
  try {
    const apply = () => {
      replaceSettings(game, JSON.stringify(normalized));
      renderSettings(game);
      updateMenuChrome(game);
    };
    const after = () => { ui.settingsJson.value = serializeSettings(game); ui.settingsJsonStatus.textContent = 'Replaced app settings.'; focusFirstMenuItem(game); };
    const developerChangesLayout = developerWasVisible !== game.settings.developerMode || normalized.developerMode !== game.settings.developerMode;
    if (developerChangesLayout) runDOMTransition(game, apply, after); else { apply(); after(); }
  } catch (err) { ui.settingsJsonStatus.textContent = `Replace failed: ${err.message}`; }
}

function cycleMotion(game) {
  const index = motionOrder.indexOf(game.settings.motion);
  game.settings.motion = motionOrder[(index + 1) % motionOrder.length];
  game.settings = saveSettings(game.settings);
  renderSettingsCategory(game);
  updateMenuChrome(game);
}

function toggleController(game) {
  const { input, ui } = game;
  input.useController = !input.useController;
  resetControllerInput(input);
  syncSettingsFromInput(game);
  renderSettingsCategory(game);
  setBindStatus(ui, input.useController ? 'Controller enabled.' : 'Controller disabled.');
  setControllerStatus(ui, input.useController ? 'Controller enabled.' : 'Controller disabled.');
}

function toggleDeveloperMode(game) {
  runDOMTransition(game, () => {
    game.settings.developerMode = !game.settings.developerMode;
    game.settings = saveSettings(game.settings);
    renderSettingsCategory(game);
    updateMenuChrome(game);
  }, () => focusFirstMenuItem(game));
}

function resetBinds(game, device) {
  const { input, ui } = game;
  if (device === 'controller') {
    resetDefaultGamepadBinds(input);
    setBindStatus(ui, 'Restored controller defaults.');
  } else {
    resetDefaultKeyBinds(input);
    setBindStatus(ui, 'Restored keyboard defaults.');
  }
  syncSettingsFromInput(game);
  renderSettingsCategory(game);
}

function handleSettingsClick(game, e) {
  const categoryButton = e.target.closest('[data-settings-category]');
  if (categoryButton) return setMenuPage(game, 'settings-category', 'forward', categoryButton.dataset.settingsCategory);
  const backButton = e.target.closest('[data-settings-back]');
  if (backButton) return goBack(game);
  const bindButton = e.target.closest('button[data-bind-action]');
  if (bindButton) return startBindListening(game, bindButton.dataset.bindAction, bindButton.dataset.bindDevice);
  const row = e.target.closest('[data-setting-row]');
  if (row) {
    if (row.dataset.settingRow === 'motion') return cycleMotion(game);
    if (row.dataset.settingRow === 'controller-enabled') return toggleController(game);
    if (row.dataset.settingRow === 'developer-mode') return toggleDeveloperMode(game);
  }
  const action = e.target.closest('[data-settings-action]')?.dataset.settingsAction;
  if (action === 'reset-keyboard') return resetBinds(game, 'keyboard');
  if (action === 'reset-controller') return resetBinds(game, 'controller');
  if (action === 'dump-settings') return dumpSettings(game);
  if (action === 'replace-settings') return handleReplaceSettings(game);
}

export function setupMenu(game) {
  const { ui } = game;
  setupMotionPreference(game);
  renderSettings(game);
  updateMenuChrome(game);
  renderInputHints(game.input);

  for (let i = 0; i < 5; i++) {
    const heart = document.createElement('span');
    heart.className = 'heart full';
    ui.heartsEl.appendChild(heart);
  }

  addEventListener('focusin', e => document.querySelectorAll('.controller-focus').forEach(node => { if (node !== e.target) node.classList.remove('controller-focus'); }));

  ui.startButton.addEventListener('click', () => startGame(game));
  ui.startSettingsButton.addEventListener('click', () => openSettings(game, 'start'));
  ui.resumeButton.addEventListener('click', () => setPaused(game, false));
  ui.restartButton.addEventListener('click', () => game.resetGame());
  ui.mainMenuButton.addEventListener('click', () => returnToMainMenu(game));
  ui.settingsButton.addEventListener('click', () => openSettings(game, 'pause'));
  ui.menuPages.addEventListener('click', e => handleSettingsClick(game, e));

  requestAnimationFrame(() => focusAndReveal(game, ui.startButton));
}

export function handleListeningKey(game, code) {
  const action = game.input.listeningFor;
  if (!action) return;
  if (code === 'Escape') return cancelBindListening(game, 'Listening cancelled.');
  if (game.bindListenTimer) clearTimeout(game.bindListenTimer);
  game.bindListenTimer = null;
  const conflict = findBindConflict(game.input, 'keyboard', action, code);
  if (conflict) {
    game.input.bindError = { device: 'keyboard', action, until: performance.now() + 1800 };
    setBindStatus(game.ui, `${code.replace(/^Key/, '')} is already bound to ${bindLabels[conflict]}.`, true);
    renderSettingsCategory(game);
    setTimeout(() => renderSettingsCategory(game), 1850);
    return;
  }
  bindKey(game.input, action, code);
  syncSettingsFromInput(game);
  setBindStatus(game.ui, `${bindLabels[action]} updated.`);
  renderSettingsCategory(game);
}
