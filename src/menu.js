import { bindKey, bindLabels, findBindConflict, menuButtons, renderInputHints, resetControllerInput, resetDefaultGamepadBinds, resetDefaultKeyBinds, setBindStatus, setControllerStatus } from './input.js';
import { syncSettingsFromInput, replaceSettings, saveSettings, serializeSettings } from './settings.js';
import { setPausedFlag } from './state.js';
import { applyMotionPreference, runDOMTransition, shouldReduceMotion, setupMotionPreference } from './transitions.js';
import { renderSettings, renderSettingsCategory, refreshDynamicRefs, selectedCategory } from './settings-ui.js';
import { syncGymApi } from './gym.js';
import { browserRuntime } from './runtime.js';
import { getAllCategories, getCategoryById, primaryGroupCategoryFor } from './categories/registry.js';
import { getDefaultLevel } from './campaign/registry.js';
import { getVisibleLevelEntries } from './levels/registry.js';

const pageElement = (ui, page) => ({ main: ui.pauseMainPage, 'level-select': ui.levelSelectPage, settings: ui.settingsHubPage, 'settings-category': ui.settingsCategoryPage })[page];
const backablePages = ['level-select', 'settings', 'settings-category'];

const motionOrder = ['system', 'on', 'off'];

export function visibleFocusables(root) {
  return [...root.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')]
    .filter(el => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden');
}

export function activeMenuRoot(game) {
  if (document.body.dataset.menuOrigin === 'start') return pageElement(game.ui, game.menu.page) || game.ui.pauseScreen;
  if (game.flags.paused) return pageElement(game.ui, game.menu.page) || game.ui.pauseScreen;
  if (game.player.dead || game.flags.won) return game.ui.messageEl;
  if (!game.flags.started) return game.ui.startScreen;
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

function currentMenuElement(game, root = activeMenuRoot(game)) {
  const active = document.activeElement;
  if (active && root?.contains(active)) return active;
  if (game.menu.lastFocused && root?.contains(game.menu.lastFocused)) return game.menu.lastFocused;
  return active;
}

export function moveMenuFocus(game, dir) {
  const root = activeMenuRoot(game);
  if (!root) return;
  const items = visibleFocusables(root);
  if (!items.length) return;
  const current = items.indexOf(currentMenuElement(game, root));
  focusAndReveal(game, items[current < 0 ? 0 : (current + dir + items.length) % items.length]);
}

function moveHorizontalGroupFocus(game, dx) {
  const current = currentMenuElement(game);
  const group = current?.closest?.('.ds-action-row, .segmented');
  if (!group) return false;
  const items = visibleFocusables(group);
  const index = items.indexOf(current);
  if (items.length < 2 || index < 0) return false;
  focusAndReveal(game, items[(index + dx + items.length) % items.length]);
  return true;
}

function renderSelectedLevelSummary(game) {
  const level = game.levels.getCurrentLevel();
  if (game.ui.selectedLevelSummary) game.ui.selectedLevelSummary.textContent = `Selected level: ${level.name}`;
  const heroTitle = document.querySelector('.hero-scene__title');
  if (heroTitle) heroTitle.textContent = level.name;
  if (game.ui.hudLevelName) game.ui.hudLevelName.textContent = level.name;
}

const scenarioSourceGroups = {
  campaign: { id: 'campaign', name: 'Campaigns', order: 10 },
  campaigns: { id: 'campaigns', name: 'Campaigns', order: 10 },
  gyms: { id: 'gyms', name: 'Gyms', order: 100 },
  zoos: { id: 'zoos', name: 'Zoos', order: 110 }
};

function scenarioSourceGroupFor(entry, developerMode) {
  if (developerMode && scenarioSourceGroups[entry.source]) return scenarioSourceGroups[entry.source];
  const category = primaryGroupCategoryFor(entry, { developerMode });
  return { id: category.id, name: category.name, order: category.order };
}

function scenarioTagNames(entry) {
  return (entry.categories || [])
    .filter(categoryId => categoryId !== 'levels' && categoryId !== 'gyms' && categoryId !== 'zoos')
    .map(categoryId => getCategoryById(categoryId)?.name || categoryId)
    .join(', ');
}

function renderScenarioBrowser(game, message = '') {
  const { ui } = game;
  if (!ui.levelSelectList) return;
  const current = game.levels.getCurrentLevel();
  const developerMode = Boolean(game.settings.developerMode || game.session?.developerModeOverride);
  const entries = game.scenarios?.getVisible?.() ?? getVisibleLevelEntries({ developerMode });
  const grouped = new Map();
  for (const entry of entries) {
    const group = scenarioSourceGroupFor(entry, developerMode);
    if (!grouped.has(group.id)) grouped.set(group.id, { group, entries: [] });
    grouped.get(group.id).entries.push(entry);
  }
  const orderedGroups = [...grouped.values()].sort((a, b) => a.group.order - b.group.order || a.group.name.localeCompare(b.group.name));
  ui.levelSelectList.innerHTML = orderedGroups
    .map(({ group, entries }) => `<section class="ds-section settings-section level-select-group" data-scenario-source="${group.id}">
      <h3>${group.name}</h3>
      <div class="settings-row-list">
        ${entries.map(entry => {
          const isCurrent = entry.targetId === current.id || game.scenarios?.current?.id === entry.id;
          const tags = scenarioTagNames(entry);
          const docs = entry.docs?.length ? ` // Docs: ${entry.docs.join(', ')}` : '';
          const tests = entry.tests?.length ? ` // Tests: ${entry.tests.join(', ')}` : '';
          const covers = entry.covers?.length ? ` // Covers: ${entry.covers.join(', ')}` : '';
          return `<button type="button" class="ds-setting-row level-select-row${isCurrent ? ' is-current' : ''}" data-level-id="${entry.id}" data-scenario-id="${entry.id}" data-scenario-source="${entry.source || group.id}">
          <span class="ds-setting-row__copy">
            <span class="ds-setting-row__label">${entry.name}</span>
            <span class="ds-setting-row__description">${entry.description || ''}${tags ? ` // ${tags}` : ''}${entry.visibility === 'developer' ? ' // Developer' : ''}${entry.ci ? ' // CI' : ''}${docs}${tests}${covers}</span>
          </span>
          <span class="ds-setting-row__value">${isCurrent ? 'Selected' : (game.menu.origin === 'start' ? 'Select' : 'Load')}</span>
        </button>`;
        }).join('')}
      </div>
    </section>`).join('');
  if (ui.levelSelectStatus) ui.levelSelectStatus.textContent = message || `Current scenario: ${(game.scenarios?.current?.entry || game.scenarios?.getSelected?.() || current).name}.`;
  renderSelectedLevelSummary(game);
}

const renderLevelSelect = renderScenarioBrowser;

export function handleGamepadMenuInput(game) {
  const { input, ui } = game;
  const root = activeMenuRoot(game);
  if (!root) return false;
  if (input.controllerBindAction) return false;
  if (input.suppressMenuInputOnce) { input.suppressMenuInputOnce = false; return true; }
  if (input.listeningFor) return false;
  const focusables = visibleFocusables(root);
  if (!root.contains(document.activeElement) && !root.contains(game.menu.lastFocused)) focusFirstMenuItem(game);
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
  if (input.gamepadPressed.has(menuButtons.accept)) { document.activeElement?.click?.(); return true; }
  if (input.gamepadPressed.has(menuButtons.back)) { if (backablePages.includes(game.menu.page)) goBack(game); else if (game.flags.started) ui.resumeButton.click(); return true; }
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

export function startBindListening(game, action, type, runtime = browserRuntime) {
  const { input, ui } = game;
  if (game.bindListenTimer) clearTimeout(game.bindListenTimer);
  input.bindError = null;
  input.listeningFor = type === 'keyboard' ? action : null;
  input.controllerBindAction = type === 'controller' ? action : null;
  input.bindMode = 'replace';
  input.bindDeadline = runtime.now() + 6000;
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
    if (page === 'level-select') renderLevelSelect(game);
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

export function openLevelSelect(game, origin) {
  commitMenuPageChange(game, () => {
    game.menu.origin = origin;
    game.menu.page = 'level-select';
    game.menu.settingsCategory = null;
    game.menu.direction = 'forward';
    renderLevelSelect(game);
    updateMenuChrome(game);
  }, () => focusFirstMenuItem(game));
}

function closeLevelSelect(game) {
  const origin = game.menu.origin;
  commitMenuPageChange(game, () => {
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    game.menu.direction = 'back';
    game.menu.origin = origin === 'start' ? 'none' : 'pause';
    updateMenuChrome(game);
  }, () => focusAndReveal(game, origin === 'start' ? game.ui.startLevelSelectButton : game.ui.levelSelectButton));
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
  if (game.menu.page === 'level-select') return closeLevelSelect(game);
}

export function setPaused(game, value, runtime = browserRuntime) {
  const change = () => {
    game.menu.origin = 'pause';
    game.menu.page = 'main';
    game.menu.settingsCategory = null;
    document.body.dataset.menuOrigin = 'pause';
    setPausedFlag(game, value, runtime);
    updateMenuChrome(game);
  };
  const after = () => game.flags.paused ? focusAndReveal(game, game.ui.resumeButton) : document.activeElement?.blur?.();
  if (!value) { change(); runtime.emit('game.pause', { paused: game.flags.paused }); after(); return; }
  runDOMTransition(game, () => { change(); runtime.emit('game.pause', { paused: game.flags.paused }); }, after);
}

export function startGame(game, runtime = browserRuntime) {
  if (game.flags.started) return;
  game.menu.page = 'main';
  game.menu.settingsCategory = null;
  document.body.dataset.menuOrigin = 'pause';
  game.flags.started = true;
  game.clock.last = runtime.now();
  document.body.classList.add('playing');
  runtime.emit('game.start', { levelId: game.level?.id || null });
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

function handleReplaceSettings(game, runtime = browserRuntime) {
  const { ui } = game;
  let normalized;
  try { normalized = JSON.parse(ui.settingsJson.value); } catch (err) { ui.settingsJsonStatus.textContent = `Replace failed: ${err.message}`; return; }
  if (!confirm('Replace all app settings?')) return;
  const developerWasVisible = game.settings.developerMode && game.menu.page === 'settings-category';
  try {
    const apply = () => {
      replaceSettings(game, JSON.stringify(normalized), runtime.storage);
      runtime.emit('settings.replace', { developerMode: game.settings.developerMode, motion: game.settings.motion, controllerEnabled: game.settings.controllerEnabled });
      syncGymApi(game, runtime);
      renderSettings(game);
      updateMenuChrome(game);
    };
    const after = () => {
      if (!game.settings.developerMode && game.level?.visibility === 'developer') game.levels.switchLevel(getDefaultLevel().id);
      ui.settingsJson.value = serializeSettings(game);
      ui.settingsJsonStatus.textContent = 'Replaced app settings.';
      renderSelectedLevelSummary(game);
      focusFirstMenuItem(game);
    };
    const developerChangesLayout = developerWasVisible !== game.settings.developerMode || normalized.developerMode !== game.settings.developerMode;
    if (developerChangesLayout) runDOMTransition(game, apply, after); else { apply(); after(); }
  } catch (err) { ui.settingsJsonStatus.textContent = `Replace failed: ${err.message}`; }
}

function cycleMotion(game, runtime = browserRuntime) {
  const index = motionOrder.indexOf(game.settings.motion);
  game.settings.motion = motionOrder[(index + 1) % motionOrder.length];
  game.settings = saveSettings(game.settings, runtime.storage);
  runtime.emit('settings.change', { key: 'motion', value: game.settings.motion });
  renderSettingsCategory(game);
  updateMenuChrome(game);
}

function toggleController(game, runtime = browserRuntime) {
  const { input, ui } = game;
  input.useController = !input.useController;
  resetControllerInput(input);
  syncSettingsFromInput(game, runtime.storage);
  runtime.emit('settings.change', { key: 'controllerEnabled', value: game.settings.controllerEnabled });
  renderSettingsCategory(game);
  setBindStatus(ui, input.useController ? 'Controller enabled.' : 'Controller disabled.');
  setControllerStatus(ui, input.useController ? 'Controller enabled.' : 'Controller disabled.');
}

function toggleDeveloperMode(game, runtime = browserRuntime) {
  runDOMTransition(game, () => {
    game.settings.developerMode = !game.settings.developerMode;
    game.settings = saveSettings(game.settings, runtime.storage);
    runtime.emit('settings.change', { key: 'developerMode', value: game.settings.developerMode });
    syncGymApi(game, runtime);
    if (!game.settings.developerMode && game.level?.visibility === 'developer') game.levels.switchLevel(getDefaultLevel().id);
    renderSettingsCategory(game);
    updateMenuChrome(game);
    renderSelectedLevelSummary(game);
  }, () => {
    const root = activeMenuRoot(game);
    if (!root?.contains(document.activeElement)) focusFirstMenuItem(game);
  });
}

function selectLevel(game, entryId) {
  const result = game.scenarios?.launch?.(entryId, { origin: game.menu.origin === 'start' ? 'start' : 'pause' }) ?? { ok: false, reason: 'missing-scenario' };
  if (!result.ok) {
    const message = result.reason === 'developer-only' ? 'Enable Developer Mode to load developer levels.' : 'Level not found.';
    renderLevelSelect(game, message);
    return;
  }
  const selectedName = result.level?.name || result.entry?.name || 'scene';
  const message = game.menu.origin === 'start' ? `Selected ${selectedName}.` : `Loaded ${selectedName}.`;
  renderLevelSelect(game, message);
  if (game.menu.origin === 'start') closeLevelSelect(game);
}

function resetBinds(game, device, runtime = browserRuntime) {
  const { input, ui } = game;
  if (device === 'controller') {
    resetDefaultGamepadBinds(input);
    setBindStatus(ui, 'Restored controller defaults.');
  } else {
    resetDefaultKeyBinds(input);
    setBindStatus(ui, 'Restored keyboard defaults.');
  }
  syncSettingsFromInput(game, runtime.storage);
  runtime.emit('settings.binds-reset', { device });
  renderSettingsCategory(game);
}

function handleSettingsClick(game, e, runtime = browserRuntime) {
  const levelButton = e.target.closest('button[data-level-id]');
  if (levelButton) return selectLevel(game, levelButton.dataset.levelId);
  if (e.target.closest('[data-level-select-back]')) return goBack(game);
  const categoryButton = e.target.closest('[data-settings-category]');
  if (categoryButton) return setMenuPage(game, 'settings-category', 'forward', categoryButton.dataset.settingsCategory);
  const backButton = e.target.closest('[data-settings-back]');
  if (backButton) return goBack(game);
  const bindButton = e.target.closest('button[data-bind-action]');
  if (bindButton) return startBindListening(game, bindButton.dataset.bindAction, bindButton.dataset.bindDevice, runtime);
  const row = e.target.closest('[data-setting-row]');
  if (row) {
    if (row.dataset.settingRow === 'motion') return cycleMotion(game, runtime);
    if (row.dataset.settingRow === 'controller-enabled') return toggleController(game, runtime);
    if (row.dataset.settingRow === 'developer-mode') return toggleDeveloperMode(game, runtime);
  }
  const action = e.target.closest('[data-settings-action]')?.dataset.settingsAction;
  if (action === 'reset-keyboard') return resetBinds(game, 'keyboard', runtime);
  if (action === 'reset-controller') return resetBinds(game, 'controller', runtime);
  if (action === 'dump-settings') return dumpSettings(game);
  if (action === 'replace-settings') return handleReplaceSettings(game, runtime);
}

export function setupMenu(game, runtime = browserRuntime) {
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

  addEventListener('focusin', e => {
    game.menu.lastFocused = e.target;
    document.querySelectorAll('.controller-focus').forEach(node => { if (node !== e.target) node.classList.remove('controller-focus'); });
  });

  renderSelectedLevelSummary(game);

  ui.startButton.addEventListener('click', () => startGame(game, runtime));
  ui.startLevelSelectButton.addEventListener('click', () => openLevelSelect(game, 'start'));
  ui.startSettingsButton.addEventListener('click', () => openSettings(game, 'start'));
  ui.resumeButton.addEventListener('click', () => setPaused(game, false, runtime));
  ui.restartButton.addEventListener('click', () => game.resetGame());
  ui.mainMenuButton.addEventListener('click', () => returnToMainMenu(game));
  ui.levelSelectButton.addEventListener('click', () => openLevelSelect(game, 'pause'));
  ui.settingsButton.addEventListener('click', () => openSettings(game, 'pause'));
  ui.messageRestartButton.addEventListener('click', () => game.resetGame());
  ui.messageNextLevelButton.addEventListener('click', () => {
    const result = game.levels.switchToNextLevel();
    if (!result.ok) return;
    setPausedFlag(game, false, runtime);
    game.flags.started = true;
    runtime.emit('game.next-level', { levelId: game.level?.id || null });
    document.body.classList.add('playing');
    document.body.classList.remove('game-won', 'game-over');
    game.canvas.focus?.({ preventScroll: true });
  });
  ui.messageLevelSelectButton.addEventListener('click', () => {
    setPausedFlag(game, true, runtime);
    openLevelSelect(game, 'pause');
  });
  ui.menuPages.addEventListener('click', e => handleSettingsClick(game, e, runtime));

  requestAnimationFrame(() => focusAndReveal(game, ui.startButton));
}

export function handleListeningKey(game, code, runtime = browserRuntime) {
  const action = game.input.listeningFor;
  if (!action) return;
  if (code === 'Escape') return cancelBindListening(game, 'Listening cancelled.');
  if (game.bindListenTimer) clearTimeout(game.bindListenTimer);
  game.bindListenTimer = null;
  const conflict = findBindConflict(game.input, 'keyboard', action, code);
  if (conflict) {
    game.input.bindError = { device: 'keyboard', action, until: runtime.now() + 1800 };
    setBindStatus(game.ui, `${code.replace(/^Key/, '')} is already bound to ${bindLabels[conflict]}.`, true);
    renderSettingsCategory(game);
    setTimeout(() => renderSettingsCategory(game), 1850);
    return;
  }
  bindKey(game.input, action, code);
  syncSettingsFromInput(game, runtime.storage);
  runtime.emit('settings.bind-changed', { device: 'keyboard', action, code });
  setBindStatus(game.ui, `${bindLabels[action]} updated.`);
  renderSettingsCategory(game);
}
