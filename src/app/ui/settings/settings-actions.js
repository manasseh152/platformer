import { setBindStatus, setControllerStatus } from '../../input/controller-diagnostics.js';
import { createBindCapture } from '#/core/input/index.js';
import { createBrowserInputAdapter, createGameInputRuntime } from '../../input/browser-input-adapter.js';
import { bindLabel, commitBindRow, resetBindRowsToDefaults } from '../../input/semantic-bind-rows.js';
import { bindingLabel } from '../../input/input-hints.js';
import { replaceSettings, saveSettings, serializeSettings } from '../../settings/settings.js';
import { applyMotionPreference } from '../transitions.js';
import { renderSettings, renderSettingsCategory } from './settings-view.js';
import { syncGymApi } from '../../testing/gym.js';
import { browserRuntime } from '../../runtime/browser-runtime.js';
import { getDefaultTilemap } from '#/content/tilemaps/registry.js';
import { renderSelectedTilemapSummary } from '../scenario-browser.js';
import { isStarted, isWon } from '../../app-state.js';
import { clearSpeedRunRecords, prepareSpeedRunAttempt } from '../../speedrun/speedrun.js';

const motionOrder = ['system', 'on', 'off'];

export function cancelBindListening(game, message = '') {
  const { input, ui } = game;
  input.listeningFor = null;
  input.controllerBindAction = null;
  input.bindCapture = null;
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
  input.bindDeadline = runtime.now() + 6000;
  input.bindCapture = createBindCapture({
    actionId: action,
    deviceType: type === 'controller' ? 'gamepad' : 'keyboard',
    timeoutAt: input.bindDeadline,
    cancelBindings: type === 'controller'
      ? [{ deviceType: 'gamepad', control: 'button', index: 1 }]
      : [{ deviceType: 'keyboard', control: 'key', code: 'Escape' }]
  });
  const label = bindLabel(action);
  setBindStatus(ui, type === 'keyboard' ? `Press a key for ${label}. Escape cancels.` : `Press a controller button for ${label}. B / Circle cancels.`);
  renderSettingsCategory(game);
  game.bindListenTimer = setTimeout(() => cancelBindListening(game, 'Listening cancelled.'), 6000);
}

export function renderBinds(game) {
  renderSettingsCategory(game);
}

function dumpSettings(game) {
  game.ui.settingsJson.value = serializeSettings(game);
  game.ui.settingsJson.select();
  game.ui.settingsJsonStatus.textContent = 'Dumped app settings.';
}

function handleReplaceSettings(game, runtime = browserRuntime, callbacks = {}) {
  const { updateMenuChrome, focusFirstMenuItem } = callbacks;
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
      updateMenuChrome?.(game);
    };
    const after = () => {
      if (!game.settings.developerMode && game.tilemap?.visibility === 'developer') game.tilemaps.switchTilemap(getDefaultTilemap().id);
      ui.settingsJson.value = serializeSettings(game);
      ui.settingsJsonStatus.textContent = 'Replaced app settings.';
      renderSelectedTilemapSummary(game);
      focusFirstMenuItem?.(game);
    };
    const developerChangesLayout = developerWasVisible !== game.settings.developerMode || normalized.developerMode !== game.settings.developerMode;
    if (developerChangesLayout) callbacks.runDOMTransition?.(game, apply, after); else { apply(); after(); }
  } catch (err) { ui.settingsJsonStatus.textContent = `Replace failed: ${err.message}`; }
}

function cycleMotion(game, runtime = browserRuntime, callbacks = {}) {
  const index = motionOrder.indexOf(game.settings.motion);
  game.settings.motion = motionOrder[(index + 1) % motionOrder.length];
  game.settings = saveSettings(game.settings, runtime.storage);
  runtime.emit('settings.change', { key: 'motion', value: game.settings.motion });
  renderSettingsCategory(game);
  callbacks.updateMenuChrome?.(game);
  applyMotionPreference(game);
}

function cycleGpuExtras(game, runtime = browserRuntime) {
  game.settings.gpuExtras = game.settings.gpuExtras === 'auto' ? 'off' : 'auto';
  game.settings = saveSettings(game.settings, runtime.storage);
  runtime.emit('settings.change', { key: 'gpuExtras', value: game.settings.gpuExtras });
  if (game.settings.gpuExtras === 'auto') {
    game.presentation.tryEnableWebGpu?.(game.gpu).then(enabled => {
      if (enabled) {
        runtime.emit('gpu.presentation-enabled', { mode: game.presentation.mode });
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

function refreshInputRuntime(game, runtime = browserRuntime) {
  game.inputRuntime = createGameInputRuntime(game.settings);
  game.inputAdapter = createBrowserInputAdapter(game.inputRuntime, { now: game.runtime?.now || runtime.now });
}

function commitSettings(game, runtime = browserRuntime) {
  game.settings = saveSettings(game.settings, runtime.storage);
  refreshInputRuntime(game, runtime);
  return game.settings;
}

function toggleController(game, runtime = browserRuntime) {
  const { input, ui } = game;
  const device = game.settings.input.slots.player1.devices.gamepad;
  device.enabled = !device.enabled;
  input.gamepadDown.clear();
  input.gamepadPressed.clear();
  input.previousGamepadDown.clear();
  input.controllerBindAction = null;
  input.bindCapture = null;
  input.bindDeadline = 0;
  commitSettings(game, runtime);
  runtime.emit('settings.change', { key: 'controllerEnabled', value: game.settings.input.slots.player1.devices.gamepad.enabled });
  renderSettingsCategory(game);
  setBindStatus(ui, device.enabled ? 'Controller enabled.' : 'Controller disabled.');
  setControllerStatus(ui, device.enabled ? 'Controller enabled.' : 'Controller disabled.');
}

function setControllerSubpage(game, pageId, callbacks = {}) {
  game.menu.settingsSubpage = pageId;
  if (pageId === 'diagnostics') {
    game.input.controllerDebugLock = true;
    game.input.controllerDebugExitStartedAt = 0;
    game.input.controllerBindAction = null;
    game.input.bindCapture = null;
    game.input.bindDeadline = 0;
    game.input.suppressMenuInputOnce = true;
  }
  renderSettingsCategory(game);
  callbacks.updateMenuChrome?.(game);
  callbacks.focusFirstMenuItem?.(game);
}

function closeControllerSubpage(game, callbacks = {}) {
  game.input.controllerDebugLock = false;
  game.input.controllerDebugExitStartedAt = 0;
  game.menu.settingsSubpage = null;
  renderSettingsCategory(game);
  callbacks.updateMenuChrome?.(game);
  callbacks.focusFirstMenuItem?.(game);
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

function toggleDeveloperMode(game, runtime = browserRuntime, callbacks = {}) {
  const { updateMenuChrome, focusAndReveal, focusFirstMenuItem, activeMenuRoot } = callbacks;
  callbacks.runDOMTransition?.(game, () => {
    game.settings.developerMode = !game.settings.developerMode;
    game.settings = saveSettings(game.settings, runtime.storage);
    runtime.emit('settings.change', { key: 'developerMode', value: game.settings.developerMode });
    syncGymApi(game, runtime);
    if (!game.settings.developerMode && game.tilemap?.visibility === 'developer') game.tilemaps.switchTilemap(getDefaultTilemap().id);
    renderSettingsCategory(game);
    updateMenuChrome?.(game);
    game.devTools?.sync?.();
    renderSelectedTilemapSummary(game);
  }, () => {
    const root = activeMenuRoot?.(game);
    const active = document.activeElement;
    if (root?.contains(active) && !active?.matches?.('[data-settings-back]')) return;
    const developerRow = game.ui.settingsCategoryBody?.querySelector('[data-setting-row="developer-mode"]');
    if (developerRow) return focusAndReveal?.(game, developerRow);
    if (!root?.contains(document.activeElement)) focusFirstMenuItem?.(game);
  });
}

function resetBinds(game, device, runtime = browserRuntime) {
  game.input.listeningFor = null;
  game.input.controllerBindAction = null;
  game.input.bindCapture = null;
  game.input.bindDeadline = 0;
  game.settings = resetBindRowsToDefaults(game.settings, device);
  commitSettings(game, runtime);
  setBindStatus(game.ui, device === 'controller' ? 'Restored controller defaults.' : 'Restored keyboard defaults.');
  runtime.emit('settings.binds-reset', { device });
  renderSettingsCategory(game);
}

export function handleSettingsActionsClick(game, e, runtime = browserRuntime, callbacks = {}) {
  const controllerPage = e.target.closest('button[data-controller-settings-page]');
  if (controllerPage) { setControllerSubpage(game, controllerPage.dataset.controllerSettingsPage, callbacks); return true; }
  const controllerBack = e.target.closest('[data-controller-settings-back]');
  if (controllerBack) { closeControllerSubpage(game, callbacks); return true; }
  const bindButton = e.target.closest('button[data-bind-action]');
  if (bindButton) { startBindListening(game, bindButton.dataset.bindAction, bindButton.dataset.bindDevice, runtime); return true; }
  const controllerSelect = e.target.closest('button[data-controller-select]');
  if (controllerSelect) { selectController(game, controllerSelect.dataset.controllerSelect, runtime); return true; }
  const row = e.target.closest('[data-setting-row]');
  if (row) {
    if (row.dataset.settingRow === 'motion') { cycleMotion(game, runtime, callbacks); return true; }
    if (row.dataset.settingRow === 'controller-enabled') { toggleController(game, runtime); return true; }
    if (row.dataset.settingRow === 'speed-run-mode') { toggleSpeedRunMode(game, runtime); return true; }
    if (row.dataset.settingRow === 'gpu-extras') { cycleGpuExtras(game, runtime); return true; }
    if (row.dataset.settingRow === 'developer-mode') { toggleDeveloperMode(game, runtime, callbacks); return true; }
  }
  const action = e.target.closest('[data-settings-action]')?.dataset.settingsAction;
  if (action === 'reset-keyboard') { resetBinds(game, 'keyboard', runtime); return true; }
  if (action === 'reset-controller') { resetBinds(game, 'controller', runtime); return true; }
  if (action === 'clear-speedrun-records') { clearRecords(game, runtime); return true; }
  if (action === 'dump-settings') { dumpSettings(game); return true; }
  if (action === 'replace-settings') { handleReplaceSettings(game, runtime, callbacks); return true; }
  return false;
}

export function handleListeningKey(game, code, runtime = browserRuntime) {
  const action = game.input.listeningFor;
  if (!action) return;
  const captured = game.input.bindCapture?.event?.({ code, timestamp: runtime.now() });
  if (captured?.status === 'cancelled' || code === 'Escape') return cancelBindListening(game, 'Listening cancelled.');
  if (captured?.status !== 'captured') return;
  if (game.bindListenTimer) clearTimeout(game.bindListenTimer);
  game.bindListenTimer = null;
  const result = commitBindRow(game.settings, action, captured.binding, { device: 'keyboard' });
  if (!result.ok) {
    game.input.listeningFor = null;
    game.input.bindCapture = null;
    game.input.bindDeadline = 0;
    game.input.bindError = { device: 'keyboard', action, until: runtime.now() + 1800 };
    setBindStatus(game.ui, `${bindingLabel(captured.binding)} is already bound to ${result.conflict.label}.`, true);
    renderSettingsCategory(game);
    setTimeout(() => renderSettingsCategory(game), 1850);
    return;
  }
  game.settings = result.settings;
  game.input.listeningFor = null;
  game.input.bindCapture = null;
  game.input.bindDeadline = 0;
  commitSettings(game, runtime);
  runtime.emit('settings.bind-changed', { device: 'keyboard', action, code });
  setBindStatus(game.ui, `${bindLabel(action)} updated.`);
  renderSettingsCategory(game);
}
