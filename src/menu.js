import { bindKey, bindLabels, bindText, clearExtraBinds, controllerBindText, defaultBinds, menuButtons, resetControllerInput, resetDefaultGamepadBinds, resetDefaultKeyBinds, setBindStatus, setControllerStatus } from './input.js';
import { syncSettingsFromInput, replaceSettings, saveSettings, serializeSettings } from './settings.js';
import { setPausedFlag } from './state.js';
import { applyMotionPreference, runDOMTransition, shouldReduceMotion, setupMotionPreference } from './transitions.js';

const pageElement = (ui, page) => ({ main: ui.pauseMainPage, settings: ui.settingsPage, controls: ui.controlsPage, advanced: ui.advancedPage })[page];

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
  document.body.dataset.menuOrigin = menu.origin;
  const titles = { main: 'Paused', settings: 'Settings', controls: 'Controls', advanced: 'Advanced' };
  ui.menuTitle.textContent = titles[menu.page];
  ui.menuEyebrow.textContent = menu.page === 'main' ? 'Paused' : (menu.origin === 'start' ? 'Before you begin' : 'Settings');
  ui.controllerEnabled.checked = game.input.useController;
  ui.developerMode.checked = game.settings.developerMode;
  ui.developerTools.hidden = !game.settings.developerMode;
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

function moveBindGridFocus(game, dx, dy) {
  const row = document.activeElement?.closest?.('.bind-row');
  if (!row) return false;
  const rows = [...game.ui.bindList.querySelectorAll('.bind-row')];
  const rowIndex = rows.indexOf(row);
  const buttons = [...row.querySelectorAll('button:not(:disabled)')];
  const colIndex = buttons.indexOf(document.activeElement);
  if (rowIndex < 0 || colIndex < 0) return false;
  if (dx) { focusAndReveal(game, buttons[Math.max(0, Math.min(buttons.length - 1, colIndex + dx))]); return true; }
  const nextRow = rows[rowIndex + dy];
  if (!nextRow) return false;
  const nextButtons = [...nextRow.querySelectorAll('button:not(:disabled)')];
  focusAndReveal(game, nextButtons[Math.min(colIndex, nextButtons.length - 1)]);
  return true;
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
  if (!root || input.listeningFor || input.controllerBindAction) return false;
  if (input.suppressMenuInputOnce) { input.suppressMenuInputOnce = false; return true; }
  const focusables = visibleFocusables(root);
  if (!root.contains(document.activeElement) || !focusables.includes(document.activeElement)) focusFirstMenuItem(game);
  if (input.gamepadPressed.has(menuButtons.left)) return moveBindGridFocus(game, -1, 0) || moveHorizontalGroupFocus(game, -1);
  if (input.gamepadPressed.has(menuButtons.right)) return moveBindGridFocus(game, 1, 0) || moveHorizontalGroupFocus(game, 1);
  if (input.gamepadPressed.has(menuButtons.up)) { if (!moveBindGridFocus(game, 0, -1)) moveMenuFocus(game, -1); return true; }
  if (input.gamepadPressed.has(menuButtons.down)) { if (!moveBindGridFocus(game, 0, 1)) moveMenuFocus(game, 1); return true; }
  if (input.gamepadPressed.has(menuButtons.accept)) { document.activeElement?.click?.(); return true; }
  if (input.gamepadPressed.has(menuButtons.back)) { if (['settings','controls','advanced'].includes(game.menu.page)) goBack(game); else if (game.flags.started) ui.resumeButton.click(); return true; }
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
  renderBinds(game);
  if (message) setBindStatus(ui, message);
}

export function startBindListening(game, action, type, mode = 'replace') {
  const { input, ui } = game;
  if (game.bindListenTimer) clearTimeout(game.bindListenTimer);
  input.listeningFor = type === 'keyboard' ? action : null;
  input.controllerBindAction = type === 'controller' ? action : null;
  input.bindMode = mode;
  input.bindDeadline = performance.now() + 6000;
  const label = bindLabels[action];
  setBindStatus(ui, type === 'keyboard' ? `Press a key for ${label}. Click Cancel or wait to keep current binds.` : `Press a controller button for ${label}. Click Cancel or wait to keep current binds.`);
  renderBinds(game);
  game.bindListenTimer = setTimeout(() => cancelBindListening(game, 'Listening cancelled.'), 6000);
}

export function renderBinds(game) {
  const { input, ui } = game;
  const editingController = input.bindEditorDevice === 'controller';
  ui.controlsEl.textContent = game.controlsText();
  ui.bindList.innerHTML = '';
  ui.editKeyboardButton.classList.toggle('active', !editingController);
  ui.editControllerButton.classList.toggle('active', editingController);
  ui.editKeyboardButton.setAttribute('aria-pressed', String(!editingController));
  ui.editControllerButton.setAttribute('aria-pressed', String(editingController));
  for (const action of Object.keys(defaultBinds)) {
    const row = document.createElement('div');
    row.className = 'bind-row';
    const keyboardListening = input.listeningFor === action;
    const controllerListening = input.controllerBindAction === action;
    const bindValue = editingController ? (controllerListening ? 'Press controller input…' : controllerBindText(input, action)) : (keyboardListening ? (input.bindMode === 'add' ? 'Press key to add…' : 'Press key…') : bindText(input, action));
    row.innerHTML = `
      <div class="bind-action">${bindLabels[action]}</div>
      <div class="bind-editor">
        <span class="bind-type">${editingController ? 'Controller' : 'Keyboard'}</span>
        <div class="bind-value">${bindValue}</div>
        <div class="bind-buttons">${editingController
          ? `<button class="mini" data-action="${action}" data-type="controller" data-mode="replace">Replace controller</button><button class="mini secondary" data-action="${action}" data-clear="extras">Clear extra binds</button>`
          : `<button class="mini" data-action="${action}" data-type="keyboard" data-mode="replace">Replace keyboard</button><button class="mini" data-action="${action}" data-type="keyboard" data-mode="add">Add keyboard</button>`}</div>
      </div>
      ${(keyboardListening || controllerListening) ? `<button class="cancel-bind secondary" data-cancel-bind="true">Cancel</button>` : ''}`;
    row.classList.toggle('listening', keyboardListening || controllerListening);
    ui.bindList.appendChild(row);
  }
}

export function setMenuPage(game, page, direction = 'forward') {
  runDOMTransition(game, () => {
    game.menu.page = page;
    game.menu.direction = direction;
    updateMenuChrome(game);
    if (page === 'controls') renderBinds(game);
  }, () => focusFirstMenuItem(game));
}

export function openSettings(game, origin) {
  runDOMTransition(game, () => {
    game.menu.origin = origin;
    game.menu.page = 'settings';
    game.menu.direction = 'forward';
    document.body.dataset.menuOrigin = origin;
    game.input.bindEditorDevice = game.input.inputScheme === 'gamepad' ? 'controller' : 'keyboard';
    updateMenuChrome(game);
    renderBinds(game);
  }, () => focusFirstMenuItem(game));
}

export function closeSettings(game) {
  const origin = game.menu.origin;
  runDOMTransition(game, () => {
    cancelBindListening(game);
    game.menu.page = 'main';
    game.menu.direction = 'back';
    if (origin === 'start') document.body.dataset.menuOrigin = 'none';
    else document.body.dataset.menuOrigin = 'pause';
    updateMenuChrome(game);
  }, () => focusAndReveal(game, origin === 'start' ? game.ui.startSettingsButton : game.ui.settingsButton));
}

export function goBack(game) {
  if (game.menu.page === 'controls' || game.menu.page === 'advanced') return setMenuPage(game, 'settings', 'back');
  if (game.menu.page === 'settings') return closeSettings(game);
}

export function setPaused(game, value) {
  const change = () => {
    game.menu.origin = 'pause';
    game.menu.page = 'main';
    document.body.dataset.menuOrigin = 'pause';
    setPausedFlag(game, value);
    updateMenuChrome(game);
  };
  const after = () => game.flags.paused ? focusAndReveal(game, game.ui.resumeButton) : document.activeElement?.blur?.();

  // Resuming must remove the modal before gameplay continues. A view transition
  // keeps an old modal snapshot over the canvas for a frame, which looks like the
  // game starts while the pause card is still open.
  if (!value) { change(); after(); return; }
  runDOMTransition(game, change, after);
}

export function startGame(game) {
  if (game.flags.started) return;
  // Starting gameplay should be an immediate state switch: do not let view
  // transitions keep the start/settings modal visible over the first game frame.
  game.menu.page = 'main';
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
  const developerWasVisible = game.settings.developerMode && game.menu.page === 'advanced';
  try {
    const apply = () => {
      replaceSettings(game, JSON.stringify(normalized));
      updateMenuChrome(game);
      renderBinds(game);
    };
    const after = () => { ui.settingsJson.value = serializeSettings(game); ui.settingsJsonStatus.textContent = 'Replaced app settings.'; focusFirstMenuItem(game); };
    const developerChangesLayout = developerWasVisible !== game.settings.developerMode || normalized.developerMode !== game.settings.developerMode;
    if (developerChangesLayout) runDOMTransition(game, apply, after); else { apply(); after(); }
  } catch (err) { ui.settingsJsonStatus.textContent = `Replace failed: ${err.message}`; }
}

export function setupMenu(game) {
  const { ui, input } = game;
  setupMotionPreference(game);
  updateMenuChrome(game);
  renderBinds(game);

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
  ui.controlsNavButton.addEventListener('click', () => setMenuPage(game, 'controls', 'forward'));
  ui.advancedNavButton.addEventListener('click', () => setMenuPage(game, 'advanced', 'forward'));
  ui.settingsBackButton.addEventListener('click', () => goBack(game));
  ui.controlsBackButton.addEventListener('click', () => goBack(game));
  ui.advancedBackButton.addEventListener('click', () => goBack(game));

  for (const button of ui.motionButtons) button.addEventListener('click', () => {
    game.settings.motion = button.dataset.motion;
    game.settings = saveSettings(game.settings);
    applyMotionPreference(game);
  });

  ui.editKeyboardButton.addEventListener('click', () => { input.bindEditorDevice = 'keyboard'; cancelBindListening(game); });
  ui.editControllerButton.addEventListener('click', () => { input.bindEditorDevice = 'controller'; cancelBindListening(game); });
  ui.controllerEnabled.addEventListener('change', () => {
    input.useController = ui.controllerEnabled.checked;
    resetControllerInput(input);
    syncSettingsFromInput(game);
    setControllerStatus(ui, input.useController ? 'Controller enabled.' : 'Controller disabled.');
  });
  ui.developerMode.addEventListener('change', () => {
    runDOMTransition(game, () => {
      game.settings.developerMode = ui.developerMode.checked;
      game.settings = saveSettings(game.settings);
      updateMenuChrome(game);
    }, () => focusAndReveal(game, ui.developerMode));
  });
  ui.dumpSettingsButton.addEventListener('click', () => dumpSettings(game));
  ui.replaceSettingsButton.addEventListener('click', () => handleReplaceSettings(game));
  ui.resetBindsButton.addEventListener('click', () => {
    if (input.bindEditorDevice === 'controller') {
      resetDefaultGamepadBinds(input);
      setBindStatus(ui, 'Restored controller defaults.');
    } else {
      resetDefaultKeyBinds(input);
      setBindStatus(ui, 'Restored keyboard defaults.');
    }
    syncSettingsFromInput(game);
    renderBinds(game);
  });
  ui.bindList.addEventListener('click', e => {
    if (e.target.closest('button[data-cancel-bind]')) return cancelBindListening(game, 'Listening cancelled.');
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (button.dataset.clear === 'extras') {
      clearExtraBinds(input, action);
      syncSettingsFromInput(game);
      renderBinds(game);
      setBindStatus(ui, `Kept primary binds for ${bindLabels[action]}.`);
      return;
    }
    startBindListening(game, action, button.dataset.type || 'keyboard', button.dataset.mode || 'replace');
  });

  requestAnimationFrame(() => focusAndReveal(game, ui.startButton));
}

export function handleListeningKey(game, code) {
  const action = game.input.listeningFor;
  if (!action) return;
  if (game.bindListenTimer) clearTimeout(game.bindListenTimer);
  game.bindListenTimer = null;
  bindKey(game.input, action, code);
  syncSettingsFromInput(game);
  setBindStatus(game.ui, `${bindLabels[action]} updated.`);
  renderBinds(game);
}
