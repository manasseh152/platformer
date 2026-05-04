import { bindKey, bindLabels, bindText, clearExtraBinds, controllerBindText, defaultBinds, importBinds, menuButtons, resetControllerInput, resetDefaultGamepadBinds, resetDefaultKeyBinds, setBindStatus, setControllerStatus } from './input.js';
import { setPausedFlag } from './state.js';

export function transitionDOM(change, after) {
  if (document.startViewTransition) {
    const transition = document.startViewTransition(change);
    transition.finished.finally(() => after?.());
  } else {
    change();
    after?.();
  }
}

export function visibleFocusables(root) {
  return [...root.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')]
    .filter(el => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden');
}

export function activeMenuRoot(game) {
  if (document.body.classList.contains('start-settings')) return game.ui.pauseScreen;
  if (!game.flags.started) return game.ui.startScreen;
  if (game.flags.paused) return game.ui.pauseScreen;
  return null;
}

export function updateMenuPageHeight(game) {
  const { ui } = game;
  if (!ui.menuPages) return;
  const activePage = ui.pauseScreen.classList.contains('settings-open') ? ui.settingsPanel : ui.pauseMain;
  ui.menuPages.style.height = `${activePage.scrollHeight}px`;
}

export function focusAndReveal(game, el) {
  if (!el) return;
  document.querySelectorAll('.controller-focus').forEach(node => node.classList.remove('controller-focus'));
  el.focus({ preventScroll: true });
  el.classList.add('controller-focus');
  updateMenuPageHeight(game);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (document.activeElement === el) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }));
}

export function focusFirstMenuItem(game) {
  const root = activeMenuRoot(game);
  const first = root && visibleFocusables(root)[0];
  focusAndReveal(game, first);
}

export function moveMenuFocus(game, dir) {
  const root = activeMenuRoot(game);
  if (!root) return;
  const items = visibleFocusables(root);
  if (!items.length) return;
  const current = items.indexOf(document.activeElement);
  const next = current < 0 ? 0 : (current + dir + items.length) % items.length;
  focusAndReveal(game, items[next]);
}

function moveBindGridFocus(game, dx, dy) {
  const { ui } = game;
  const row = document.activeElement?.closest?.('.bind-row');
  if (!row) return false;
  const rows = [...ui.bindList.querySelectorAll('.bind-row')];
  const rowIndex = rows.indexOf(row);
  const buttons = [...row.querySelectorAll('button:not(:disabled)')];
  const colIndex = buttons.indexOf(document.activeElement);
  if (rowIndex < 0 || colIndex < 0) return false;

  if (dx) {
    const nextButton = buttons[Math.max(0, Math.min(buttons.length - 1, colIndex + dx))];
    focusAndReveal(game, nextButton);
    return true;
  }

  if (dy) {
    const nextRow = rows[rowIndex + dy];
    if (!nextRow) return false;
    const nextButtons = [...nextRow.querySelectorAll('button:not(:disabled)')];
    const nextButton = nextButtons[Math.min(colIndex, nextButtons.length - 1)];
    focusAndReveal(game, nextButton);
    return true;
  }
  return false;
}

function moveHorizontalGroupFocus(game, dx) {
  const group = document.activeElement?.closest?.('.settings-actions');
  if (!group) return false;
  const items = visibleFocusables(group);
  const index = items.indexOf(document.activeElement);
  if (index < 0) return false;
  const next = Math.max(0, Math.min(items.length - 1, index + dx));
  focusAndReveal(game, items[next]);
  return true;
}

export function handleGamepadMenuInput(game) {
  const { input, ui } = game;
  const root = activeMenuRoot(game);
  if (!root || input.listeningFor || input.controllerBindAction) return false;
  if (input.suppressMenuInputOnce) {
    input.suppressMenuInputOnce = false;
    return true;
  }
  const focusables = visibleFocusables(root);
  if (!root.contains(document.activeElement) || !focusables.includes(document.activeElement)) focusFirstMenuItem(game);
  if (input.gamepadPressed.has(menuButtons.left)) { return moveBindGridFocus(game, -1, 0) || moveHorizontalGroupFocus(game, -1); }
  if (input.gamepadPressed.has(menuButtons.right)) { return moveBindGridFocus(game, 1, 0) || moveHorizontalGroupFocus(game, 1); }
  if (input.gamepadPressed.has(menuButtons.up)) { if (!moveBindGridFocus(game, 0, -1)) moveMenuFocus(game, -1); return true; }
  if (input.gamepadPressed.has(menuButtons.down)) { if (!moveBindGridFocus(game, 0, 1)) moveMenuFocus(game, 1); return true; }
  if (input.gamepadPressed.has(menuButtons.accept)) { document.activeElement?.click?.(); return true; }
  if (input.gamepadPressed.has(menuButtons.back)) {
    if (ui.pauseScreen.classList.contains('settings-open')) ui.backButton.click();
    else if (document.body.classList.contains('start-settings')) closeStartSettings(game);
    else if (game.flags.started) ui.resumeButton.click();
    return true;
  }
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
  ui.editKeyboardButton?.classList.toggle('active', !editingController);
  ui.editControllerButton?.classList.toggle('active', editingController);
  ui.editKeyboardButton?.setAttribute('aria-pressed', String(!editingController));
  ui.editControllerButton?.setAttribute('aria-pressed', String(editingController));
  if (ui.controllerAction) ui.controllerAction.innerHTML = Object.keys(defaultBinds).map(action => `<option value="${action}">${bindLabels[action]}</option>`).join('');
  for (const action of Object.keys(defaultBinds)) {
    const row = document.createElement('div');
    row.className = 'bind-row';
    const keyboardListening = input.listeningFor === action;
    const controllerListening = input.controllerBindAction === action;
    const keyPrompt = input.bindMode === 'add' ? 'Press key to add…' : 'Press key…';
    const deviceLabel = editingController ? 'Controller' : 'Keyboard';
    const bindValue = editingController
      ? (controllerListening ? 'Press controller input…' : controllerBindText(input, action))
      : (keyboardListening ? keyPrompt : bindText(input, action));
    const buttons = editingController
      ? `<button class="mini" data-action="${action}" data-type="controller" data-mode="replace">Replace controller</button>
         <button class="mini secondary" data-action="${action}" data-clear="extras">Clear extra binds</button>`
      : `<button class="mini" data-action="${action}" data-type="keyboard" data-mode="replace">Replace keyboard</button>
         <button class="mini" data-action="${action}" data-type="keyboard" data-mode="add">Add keyboard</button>`;
    row.innerHTML = `
      <div class="bind-action">${bindLabels[action]}</div>
      <div class="bind-editor">
        <span class="bind-type">${deviceLabel}</span>
        <div class="bind-value">${bindValue}</div>
        <div class="bind-buttons">${buttons}</div>
      </div>
      ${(keyboardListening || controllerListening) ? `<button class="cancel-bind secondary" data-cancel-bind="true">Cancel</button>` : ''}`;
    row.classList.toggle('listening', keyboardListening || controllerListening);
    ui.bindList.appendChild(row);
  }
  updateMenuPageHeight(game);
}

export function setPaused(game, value) {
  transitionDOM(() => setPausedFlag(game, value), () => {
    if (game.flags.paused) focusAndReveal(game, game.ui.resumeButton);
    else document.activeElement?.blur?.();
  });
}

export function startGame(game) {
  if (game.flags.started) return;
  transitionDOM(() => {
    closeStartSettings(game, false, false);
    game.flags.started = true;
    game.clock.last = performance.now();
    document.body.classList.add('playing');
    game.canvas.focus?.({ preventScroll: true });
  });
}

export function openSettings(game, fromStart = false) {
  if (fromStart) document.body.classList.add('start-settings');
  game.input.bindEditorDevice = game.input.inputScheme === 'gamepad' ? 'controller' : 'keyboard';
  renderBinds(game);
  game.ui.pauseScreen.classList.add('settings-open');
  updateMenuPageHeight(game);
  requestAnimationFrame(() => focusAndReveal(game, visibleFocusables(game.ui.settingsPanel)[0]));
}

export function closeStartSettings(game, transition = true, refocus = true) {
  const change = () => {
    document.body.classList.add('no-nested-menu-transition');
    document.body.classList.remove('start-settings');
    game.ui.pauseScreen.classList.remove('settings-open');
    if (game.bindListenTimer) clearTimeout(game.bindListenTimer);
    game.bindListenTimer = null;
    game.input.listeningFor = null;
    game.input.controllerBindAction = null;
    game.input.bindDeadline = 0;
    renderBinds(game);
    updateMenuPageHeight(game);
  };
  const after = () => {
    document.body.classList.remove('no-nested-menu-transition');
    if (refocus) focusAndReveal(game, game.ui.startSettingsButton);
  };
  if (transition) transitionDOM(change, after);
  else {
    change();
    requestAnimationFrame(after);
  }
}

export function returnToMainMenu(game) {
  transitionDOM(() => {
    game.resetGame();
    game.flags.started = false;
    game.flags.paused = false;
    document.body.classList.remove('playing', 'paused', 'start-settings');
    game.ui.pauseScreen.classList.remove('settings-open');
    game.input.keys.clear();
    game.input.pressed.clear();
    updateMenuPageHeight(game);
  }, () => focusAndReveal(game, game.ui.startButton));
}

export function exportBinds(game) {
  const { input, ui } = game;
  ui.bindJson.value = JSON.stringify(input.binds, null, 2);
  ui.bindJson.select();
  navigator.clipboard?.writeText(ui.bindJson.value)
    .then(() => setBindStatus(ui, 'Exported and copied to clipboard.'))
    .catch(() => setBindStatus(ui, 'Exported JSON.'));
}

export function handleImportBinds(game) {
  try {
    importBinds(game.input, game.ui.bindJson.value);
    renderBinds(game);
    setBindStatus(game.ui, 'Imported key binds.');
  } catch (err) {
    setBindStatus(game.ui, `Import failed: ${err.message}`, true);
  }
}

export function setupMenu(game) {
  const { ui, input } = game;
  renderBinds(game);

  for (let i = 0; i < 5; i++) {
    const heart = document.createElement('span');
    heart.className = 'heart full';
    ui.heartsEl.appendChild(heart);
  }

  const menuResizeObserver = new ResizeObserver(() => updateMenuPageHeight(game));
  menuResizeObserver.observe(ui.pauseMain);
  menuResizeObserver.observe(ui.settingsPanel);
  requestAnimationFrame(() => updateMenuPageHeight(game));

  addEventListener('focusin', e => {
    document.querySelectorAll('.controller-focus').forEach(node => {
      if (node !== e.target) node.classList.remove('controller-focus');
    });
  });

  ui.startButton.addEventListener('click', () => startGame(game));
  ui.startSettingsButton.addEventListener('click', () => openSettings(game, true));
  ui.resumeButton.addEventListener('click', () => setPaused(game, false));
  ui.restartButton.addEventListener('click', () => game.resetGame());
  ui.mainMenuButton.addEventListener('click', () => returnToMainMenu(game));
  ui.settingsButton.addEventListener('click', () => openSettings(game, false));
  ui.backButton.addEventListener('click', () => {
    if (document.body.classList.contains('start-settings')) return closeStartSettings(game);
    if (game.bindListenTimer) clearTimeout(game.bindListenTimer);
    game.bindListenTimer = null;
    input.listeningFor = null;
    input.controllerBindAction = null;
    input.bindDeadline = 0;
    ui.pauseScreen.classList.remove('settings-open');
    renderBinds(game);
    updateMenuPageHeight(game);
    requestAnimationFrame(() => focusAndReveal(game, ui.settingsButton));
  });
  ui.editKeyboardButton.addEventListener('click', () => {
    input.bindEditorDevice = 'keyboard';
    cancelBindListening(game);
  });
  ui.editControllerButton.addEventListener('click', () => {
    input.bindEditorDevice = 'controller';
    cancelBindListening(game);
  });
  ui.controllerEnabled.addEventListener('change', () => {
    input.useController = ui.controllerEnabled.checked;
    resetControllerInput(input);
    setControllerStatus(ui, input.useController ? 'Controller enabled.' : 'Controller disabled.');
  });
  ui.advancedMode.addEventListener('change', () => {
    ui.settingsPanel.classList.toggle('advanced', ui.advancedMode.checked);
    updateMenuPageHeight(game);
  });
  ui.exportBindsButton.addEventListener('click', () => exportBinds(game));
  ui.importBindsButton.addEventListener('click', () => handleImportBinds(game));
  ui.bindControllerButton?.addEventListener('click', () => {
    startBindListening(game, ui.controllerAction.value, 'controller');
  });
  ui.resetControllerButton.addEventListener('click', () => {
    resetDefaultGamepadBinds(input);
    renderBinds(game);
    setControllerStatus(ui, 'Restored controller defaults.');
  });
  ui.resetBindsButton.addEventListener('click', () => {
    resetDefaultKeyBinds(input);
    renderBinds(game);
    ui.bindJson.value = '';
    setBindStatus(ui, 'Restored default key binds.');
  });
  ui.bindList.addEventListener('click', e => {
    if (e.target.closest('button[data-cancel-bind]')) {
      cancelBindListening(game, 'Listening cancelled.');
      return;
    }
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (button.dataset.clear === 'extras') {
      clearExtraBinds(input, action);
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
  setBindStatus(game.ui, `${bindLabels[action]} updated.`);
  renderBinds(game);
}
