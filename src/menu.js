import { bindKey, bindLabels, menuButtons, findBindConflict, renderInputHints, resetControllerInput, resetDefaultGamepadBinds, resetDefaultKeyBinds, setBindStatus, setControllerStatus } from './input.js';
import { currentFocusElement, ensureMenuFocus, moveHorizontalGroupFocus as moveHorizontalFocus, moveLinearFocus, visibleFocusables } from './ui/navigation.js';
import { createBindCapture } from './core/input/index.js';
import { syncSettingsFromInput, replaceSettings, saveSettings, serializeSettings } from './settings.js';
import { setPausedFlag } from './state.js';
import { applyMotionPreference, runDOMTransition, shouldReduceMotion, setupMotionPreference } from './transitions.js';
import { renderSettings, renderSettingsCategory, refreshDynamicRefs, selectedCategory } from './settings-ui.js';
import { syncGymApi } from './gym.js';
import { browserRuntime } from './runtime.js';
import { getCategoryById, primaryGroupCategoryFor } from './catalog/categories/registry.js';
import { getDefaultTilemap } from './content/tilemaps/registry.js';
import { getVisibleScenarioEntries } from './catalog/scenarios/registry.js';
import { isPaused, isStarted, isWon, setStarted } from './app/app-state.js';
import { clearSpeedRunRecords, markSpeedRunPaused, prepareSpeedRunAttempt } from './speedrun.js';
import { countLocalDraftRecords, listLocalDraftRecords } from './catalog/local-drafts/storage.js';

const pageElement = (ui, page) => ({ main: ui.pauseMainPage, 'level-select': ui.levelSelectPage, settings: ui.settingsHubPage, 'settings-category': ui.settingsCategoryPage })[page];
const backablePages = ['level-select', 'settings', 'settings-category'];

const motionOrder = ['system', 'on', 'off'];
const LEVEL_SELECT_TAB_KEY = 'chibi.level-select.active-tab';
const LEVEL_SELECT_TABS = [
  { id: 'acts', label: 'Acts', developer: false },
  { id: 'local', label: 'Local', developer: false },
  { id: 'gyms', label: 'Gyms', developer: true },
  { id: 'zoos', label: 'Zoos', developer: true }
];

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
  if (ui.pauseBackHint) {
    ui.pauseBackHint.removeAttribute('data-level-select-back');
    ui.pauseBackHint.removeAttribute('data-settings-back');
    if (menu.page === 'level-select') ui.pauseBackHint.setAttribute('data-level-select-back', '');
    if (menu.page === 'settings') ui.pauseBackHint.setAttribute('data-settings-back', 'root');
    if (menu.page === 'settings-category') ui.pauseBackHint.setAttribute('data-settings-back', 'category');
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

function renderSelectedTilemapSummary(game) {
  const tilemap = game.tilemaps.getCurrentTilemap();
  if (game.ui.selectedLevelSummary) game.ui.selectedLevelSummary.textContent = `Selected level: ${tilemap.name}`;
  const heroTitle = document.querySelector('.hero-scene__title');
  if (heroTitle) heroTitle.textContent = tilemap.name;
  if (game.ui.hudLevelName) game.ui.hudLevelName.textContent = tilemap.name;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function developerModeFor(game) { return Boolean(game.settings.developerMode || game.session?.developerModeOverride); }

function availableLevelSelectTabs(game) {
  const dev = developerModeFor(game);
  return LEVEL_SELECT_TABS.filter(tab => !tab.developer || dev);
}

function activeLevelSelectTab(game) {
  const tabs = availableLevelSelectTabs(game);
  const saved = game.menu.levelSelectTab || game.runtime?.storage?.getItem?.(LEVEL_SELECT_TAB_KEY) || 'acts';
  return tabs.some(tab => tab.id === saved) ? saved : 'acts';
}

function setLevelSelectTab(game, tabId) {
  if (!availableLevelSelectTabs(game).some(tab => tab.id === tabId)) return;
  runDOMTransition(game, () => {
    game.menu.levelSelectTab = tabId;
    game.runtime?.storage?.setItem?.(LEVEL_SELECT_TAB_KEY, tabId);
    renderScenarioBrowser(game);
  }, () => focusAndReveal(game, game.ui.levelSelectList?.querySelector(`[role="tab"][data-level-select-tab="${tabId}"]`)), 'scenario-tab');
}

function scenarioTagNames(entry) {
  return (entry.categories || [])
    .filter(categoryId => !['levels', 'local', 'gyms', 'zoos'].includes(categoryId))
    .map(categoryId => getCategoryById(categoryId)?.name || categoryId)
    .join(', ');
}

function tilemapDefinitionIdForScenario(entry) {
  return entry.composition?.stack?.find(layer => layer.props?.tilemapId)?.props?.tilemapId ?? entry.composition?.stack?.find(layer => layer.props?.tilemap)?.props?.tilemap?.id ?? null;
}

function actionLabelFor(game, isCurrent) { return isCurrent ? 'Selected' : (game.menu.origin === 'start' ? 'Select' : 'Load'); }

function renderScenarioRow(game, entry, current, currentScenarioId) {
  const isCurrent = currentScenarioId ? currentScenarioId === entry.id : tilemapDefinitionIdForScenario(entry) === current.id;
  const tags = scenarioTagNames(entry);
  const docs = entry.docs?.length ? ` // Docs: ${entry.docs.join(', ')}` : '';
  const tests = entry.tests?.length ? ` // Tests: ${entry.tests.join(', ')}` : '';
  const covers = entry.covers?.length ? ` // Covers: ${entry.covers.join(', ')}` : '';
  return `<button type="button" class="ds-setting-row level-select-row${isCurrent ? ' is-current' : ''}" data-scenario-id="${escapeHtml(entry.id)}" data-scenario-source="${escapeHtml(entry.source || '')}">
    <span class="ds-setting-row__copy">
      <span class="ds-setting-row__label">${escapeHtml(entry.name)}</span>
      <span class="ds-setting-row__description">${escapeHtml(entry.description || '')}${tags ? ` // ${escapeHtml(tags)}` : ''}${entry.visibility === 'developer' ? ' // Developer' : ''}${entry.ci ? ' // CI' : ''}${escapeHtml(docs)}${escapeHtml(tests)}${escapeHtml(covers)}</span>
    </span>
    <span class="ds-setting-row__value">${actionLabelFor(game, isCurrent)}</span>
  </button>`;
}

function formatSavedAt(value) {
  if (!Number.isFinite(value)) return 'Saved date unknown';
  return `Saved ${new Date(value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
}

function renderLocalDraftRow(game, record, currentScenarioId) {
  const draft = record.draft;
  if (!draft) return `<div class="ds-setting-row ds-setting-row--info local-draft-row is-invalid">
    <span class="ds-setting-row__copy"><span class="ds-setting-row__label">${escapeHtml(record.id || 'Unreadable local draft')}</span><span class="ds-setting-row__description">Invalid: ${escapeHtml(record.validation?.message || 'Saved JSON is malformed.')}</span></span>
    <span class="ds-setting-row__value">Invalid</span>
  </div>`;
  const scenarioId = `local:${draft.id}`;
  const validation = record.validation;
  const status = !validation.ok ? `Invalid: ${validation.message}` : (!validation.playable ? validation.message : (validation.warning || 'Ready'));
  const isCurrent = currentScenarioId === scenarioId;
  const disabled = !validation.playable;
  return `<div class="ds-setting-row local-draft-row${isCurrent ? ' is-current' : ''}${disabled ? ' is-invalid' : ''}" data-local-draft-id="${escapeHtml(draft.id)}">
    <span class="ds-setting-row__copy">
      <span class="ds-setting-row__label">${escapeHtml(draft.name || draft.id)}</span>
      <span class="ds-setting-row__description">${escapeHtml(draft.id)} // ${draft.cols}×${draft.rows} // ${escapeHtml(formatSavedAt(draft.updatedAt))} // ${escapeHtml(status)}</span>
    </span>
    <span class="ds-setting-row__value local-draft-actions">
      <button type="button" class="ds-button ds-button--secondary" data-scenario-id="${escapeHtml(scenarioId)}" data-scenario-source="local"${disabled ? ' disabled' : ''}>${actionLabelFor(game, isCurrent)}</button>
      <button type="button" class="ds-button ds-button--secondary" data-local-draft-edit="${escapeHtml(draft.id)}">Edit</button>
    </span>
  </div>`;
}

function entriesForTab(entries, tabId) {
  if (tabId === 'acts') return entries.filter(entry => entry.source === 'campaigns');
  if (tabId === 'gyms') return entries.filter(entry => entry.source === 'gyms');
  if (tabId === 'zoos') return entries.filter(entry => entry.source === 'zoos');
  return [];
}

function renderActsTab(game, entries, current, currentScenarioId) {
  const groups = new Map();
  for (const entry of entries) {
    const act = (entry.categories || []).map(getCategoryById).find(category => category?.id?.startsWith('act-')) || primaryGroupCategoryFor(entry, { developerMode: developerModeFor(game) });
    if (!groups.has(act.id)) groups.set(act.id, { group: act, entries: [] });
    groups.get(act.id).entries.push(entry);
  }
  return [...groups.values()].sort((a, b) => a.group.order - b.group.order).map(({ group, entries }) => `<section class="ds-section settings-section level-select-group" data-scenario-source="campaigns">
    <h3>${escapeHtml(group.name)}</h3><div class="settings-row-list">${entries.map(entry => renderScenarioRow(game, entry, current, currentScenarioId)).join('')}</div>
  </section>`).join('');
}

function renderSourceTab(game, entries, current, currentScenarioId, title) {
  return `<section class="ds-section settings-section level-select-group" data-scenario-source="${escapeHtml(title.toLowerCase())}"><h3>${escapeHtml(title)}</h3><div class="settings-row-list">${entries.map(entry => renderScenarioRow(game, entry, current, currentScenarioId)).join('')}</div></section>`;
}

function renderLocalTab(game, currentScenarioId) {
  const records = listLocalDraftRecords(game.runtime?.storage);
  const rows = records.map(record => renderLocalDraftRow(game, record, currentScenarioId)).join('');
  return `<section class="ds-section settings-section level-select-group" data-scenario-source="local">
    <div class="level-select-toolbar"><h3>Local maps</h3><button type="button" class="ds-button ds-button--secondary" data-open-map-editor>Open Map Editor</button></div>
    ${records.length ? `<div class="settings-row-list">${rows}</div>` : `<div class="ds-setting-row ds-setting-row--info"><span class="ds-setting-row__copy"><span class="ds-setting-row__label">No local maps saved yet.</span><span class="ds-setting-row__description">Create or import a map in the editor, then save it locally.</span></span><span class="ds-setting-row__value"><button type="button" class="ds-button ds-button--primary" data-open-map-editor>Open Map Editor</button></span></div>`}
  </section>`;
}

function defaultLevelSelectStatus(game, tabId, localCount = countLocalDraftRecords(game.runtime?.storage)) {
  if (tabId === 'local') {
    return `${localCount} local map${localCount === 1 ? '' : 's'} saved on this device.`;
  }
  if (tabId === 'gyms') return 'Developer gyms validate focused mechanics.';
  if (tabId === 'zoos') return 'Developer zoos demonstrate entities and interactions.';
  const current = game.scenarios?.current?.entry || game.scenarios?.getSelected?.() || game.tilemaps.getCurrentTilemap();
  return `Current scenario: ${current.name}.`;
}

function renderScenarioBrowser(game, message = '') {
  const { ui } = game;
  if (!ui.levelSelectList) return;
  const current = game.tilemaps.getCurrentTilemap();
  const currentScenarioId = game.scenarios?.current?.id ?? game.scenarios?.selectedScenarioId ?? null;
  const developerMode = developerModeFor(game);
  const entries = getVisibleScenarioEntries({ developerMode });
  const localCount = countLocalDraftRecords(game.runtime?.storage);
  const tabs = availableLevelSelectTabs(game);
  const tabId = activeLevelSelectTab(game);
  const tabMarkup = `<div class="level-select-tabs" role="tablist" aria-label="Scenario categories">${tabs.map(tab => {
    const selected = tab.id === tabId;
    const label = tab.id === 'local' ? `${tab.label} (${localCount})` : tab.label;
    return `<button type="button" class="ds-button level-select-tab" role="tab" aria-selected="${selected}" data-level-select-tab="${tab.id}">${escapeHtml(label)}</button>`;
  }).join('')}</div>`;
  const tabEntries = entriesForTab(entries, tabId);
  let panel = '';
  if (tabId === 'acts') panel = renderActsTab(game, tabEntries, current, currentScenarioId);
  else if (tabId === 'local') panel = renderLocalTab(game, currentScenarioId);
  else panel = renderSourceTab(game, tabEntries, current, currentScenarioId, tabId === 'gyms' ? 'Gyms' : 'Zoos');
  ui.levelSelectList.innerHTML = `${tabMarkup}<div class="level-select-panel" role="tabpanel">${panel}</div>`;
  if (ui.levelSelectStatus) ui.levelSelectStatus.textContent = message || defaultLevelSelectStatus(game, tabId, localCount);
  renderSelectedTilemapSummary(game);
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

export function cancelBindListening(game, message = '') {
  const { input, ui } = game;
  input.listeningFor = null;
  input.controllerBindAction = null;
  input.bindCapture = null;
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
  input.bindCapture = createBindCapture({
    actionId: action,
    deviceType: type === 'controller' ? 'gamepad' : 'keyboard',
    timeoutAt: input.bindDeadline,
    cancelBindings: type === 'controller'
      ? [{ deviceType: 'gamepad', control: 'button', index: 1 }]
      : [{ deviceType: 'keyboard', control: 'key', code: 'Escape' }]
  });
  const label = bindLabels[action];
  setBindStatus(ui, type === 'keyboard' ? `Press a key for ${label}. Escape cancels.` : `Press a controller button for ${label}. B / Circle cancels.`);
  renderSettingsCategory(game);
  game.bindListenTimer = setTimeout(() => cancelBindListening(game, 'Listening cancelled.'), 6000);
}

export function renderBinds(game) {
  renderSettingsCategory(game);
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
  if (game.menu.page === 'settings-category') return setMenuPage(game, 'settings', 'back', null);
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
      runtime.emit('settings.replace', { developerMode: game.settings.developerMode, motion: game.settings.motion, gpuExtras: game.settings.gpuExtras, controllerEnabled: game.settings.input.slots.player1.devices.gamepad.enabled, speedRunMode: game.settings.speedRunMode });
      syncGymApi(game, runtime);
      renderSettings(game);
      updateMenuChrome(game);
    };
    const after = () => {
      if (!game.settings.developerMode && game.tilemap?.visibility === 'developer') game.tilemaps.switchTilemap(getDefaultTilemap().id);
      ui.settingsJson.value = serializeSettings(game);
      ui.settingsJsonStatus.textContent = 'Replaced app settings.';
      renderSelectedTilemapSummary(game);
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

function cycleGpuExtras(game, runtime = browserRuntime) {
  game.settings.gpuExtras = game.settings.gpuExtras === 'auto' ? 'off' : 'auto';
  game.settings = saveSettings(game.settings, runtime.storage);
  runtime.emit('settings.change', { key: 'gpuExtras', value: game.settings.gpuExtras });
  if (game.settings.gpuExtras === 'auto') {
    game.presenter.tryEnableWebGpu?.(game.gpu).then(enabled => {
      if (enabled) {
        runtime.emit('gpu.presenter-enabled', { mode: game.presenter.mode });
        if (game.menu.page === 'settings-category') renderSettingsCategory(game);
      }
    });
  }
  renderSettingsCategory(game);
}

function toggleSpeedRunMode(game, runtime = browserRuntime) {
  game.settings.speedRunMode = !game.settings.speedRunMode;
  game.settings = saveSettings(game.settings, runtime.storage);
  if (game.settings.speedRunMode && isStarted(game) && !isWon(game) && !game.player.dead) prepareSpeedRunAttempt(game);
  else if (!game.settings.speedRunMode && game.speedRun?.attempt) game.speedRun.attempt.status = 'idle';
  runtime.emit('settings.change', { key: 'speedRunMode', value: game.settings.speedRunMode });
  renderSettingsCategory(game);
}

function clearRecords(game, runtime = browserRuntime) {
  if (!confirm('Clear all speed run records?')) return;
  clearSpeedRunRecords(game.speedRun, runtime.storage);
  runtime.emit('speedrun.records-clear', {});
  renderSettingsCategory(game);
  if (game.ui.settingsStatus) game.ui.settingsStatus.textContent = 'Speed run records cleared.';
}

function toggleController(game, runtime = browserRuntime) {
  const { input, ui } = game;
  input.useController = !input.useController;
  resetControllerInput(input);
  syncSettingsFromInput(game, runtime.storage);
  runtime.emit('settings.change', { key: 'controllerEnabled', value: game.settings.input.slots.player1.devices.gamepad.enabled });
  renderSettingsCategory(game);
  setBindStatus(ui, input.useController ? 'Controller enabled.' : 'Controller disabled.');
  setControllerStatus(ui, input.useController ? 'Controller enabled.' : 'Controller disabled.');
}

function selectController(game, runtimeId, runtime = browserRuntime) {
  const result = game.inputRuntime?.selectGamepad?.('player1', runtimeId);
  if (!result?.ok) {
    setControllerStatus(game.ui, 'Controller is no longer connected.', true);
    return;
  }
  const runtimeDevice = game.inputRuntime.settings.input.slots.player1.devices.gamepad;
  const appDevice = game.settings.input.slots.player1.devices.gamepad;
  appDevice.selectedRuntimeId = runtimeDevice.selectedRuntimeId;
  appDevice.selectedFingerprint = runtimeDevice.selectedFingerprint;
  game.settings = saveSettings(game.settings, runtime.storage);
  runtime.emit('settings.controller-selected', { runtimeId: appDevice.selectedRuntimeId, fingerprint: appDevice.selectedFingerprint });
  renderSettingsCategory(game);
  setControllerStatus(game.ui, `Selected ${result.device.id || result.device.runtimeId}.`);
}

function toggleDeveloperMode(game, runtime = browserRuntime) {
  runDOMTransition(game, () => {
    game.settings.developerMode = !game.settings.developerMode;
    game.settings = saveSettings(game.settings, runtime.storage);
    runtime.emit('settings.change', { key: 'developerMode', value: game.settings.developerMode });
    syncGymApi(game, runtime);
    if (!game.settings.developerMode && game.tilemap?.visibility === 'developer') game.tilemaps.switchTilemap(getDefaultTilemap().id);
    renderSettingsCategory(game);
    updateMenuChrome(game);
    game.devTools?.sync?.();
    renderSelectedTilemapSummary(game);
  }, () => {
    const root = activeMenuRoot(game);
    if (!root?.contains(document.activeElement)) focusFirstMenuItem(game);
  });
}

function selectScenario(game, entryId) {
  const result = game.scenarios?.launch?.(entryId, { origin: game.menu.origin === 'start' ? 'start' : 'pause' }) ?? { ok: false, reason: 'missing-scenario' };
  if (!result.ok) {
    const reasonMessages = {
      'developer-only': 'Enable Developer Mode to launch developer scenarios.',
      'missing-player': 'Add a Player P before playing.',
      'compile-failed': result.scenario?.localDraft?.validation?.message || 'Local draft failed to compile.',
      'invalid-id': 'Draft id must be kebab-case to play from Level Select.',
      'missing-local-draft': 'Local draft not found on this device.'
    };
    renderScenarioBrowser(game, reasonMessages[result.reason] || 'Scenario not found.');
    return;
  }
  const selectedName = result.tilemap?.name || result.entry?.name || 'scene';
  const message = game.menu.origin === 'start' ? `Selected ${selectedName}.` : `Loaded ${selectedName}.`;
  renderScenarioBrowser(game, message);
  if (game.menu.origin === 'start') closeScenarioBrowser(game);
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
  const tabButton = e.target.closest('button[data-level-select-tab]');
  if (tabButton) return setLevelSelectTab(game, tabButton.dataset.levelSelectTab);
  const editDraft = e.target.closest('button[data-local-draft-edit]')?.dataset.localDraftEdit;
  if (editDraft) return window.location.assign(`/editor.html?draft=${encodeURIComponent(editDraft)}`);
  if (e.target.closest('[data-open-map-editor]')) return window.location.assign('/editor.html');
  const scenarioButton = e.target.closest('button[data-scenario-id]');
  if (scenarioButton) return selectScenario(game, scenarioButton.dataset.scenarioId);
  if (e.target.closest('[data-level-select-back]')) return goBack(game);
  const categoryButton = e.target.closest('[data-settings-category]');
  if (categoryButton) return setMenuPage(game, 'settings-category', 'forward', categoryButton.dataset.settingsCategory);
  const backButton = e.target.closest('[data-settings-back]');
  if (backButton) return goBack(game);
  const bindButton = e.target.closest('button[data-bind-action]');
  if (bindButton) return startBindListening(game, bindButton.dataset.bindAction, bindButton.dataset.bindDevice, runtime);
  const controllerSelect = e.target.closest('button[data-controller-select]');
  if (controllerSelect) return selectController(game, controllerSelect.dataset.controllerSelect, runtime);
  const row = e.target.closest('[data-setting-row]');
  if (row) {
    if (row.dataset.settingRow === 'motion') return cycleMotion(game, runtime);
    if (row.dataset.settingRow === 'controller-enabled') return toggleController(game, runtime);
    if (row.dataset.settingRow === 'speed-run-mode') return toggleSpeedRunMode(game, runtime);
    if (row.dataset.settingRow === 'gpu-extras') return cycleGpuExtras(game, runtime);
    if (row.dataset.settingRow === 'developer-mode') return toggleDeveloperMode(game, runtime);
  }
  const action = e.target.closest('[data-settings-action]')?.dataset.settingsAction;
  if (action === 'reset-keyboard') return resetBinds(game, 'keyboard', runtime);
  if (action === 'reset-controller') return resetBinds(game, 'controller', runtime);
  if (action === 'clear-speedrun-records') return clearRecords(game, runtime);
  if (action === 'dump-settings') return dumpSettings(game);
  if (action === 'replace-settings') return handleReplaceSettings(game, runtime);
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

export function handleListeningKey(game, code, runtime = browserRuntime) {
  const action = game.input.listeningFor;
  if (!action) return;
  const captured = game.input.bindCapture?.event?.({ code, timestamp: runtime.now() });
  if (captured?.status === 'cancelled' || code === 'Escape') return cancelBindListening(game, 'Listening cancelled.');
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
