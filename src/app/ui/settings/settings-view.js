import { bindGroups, bindLabel, rowText } from '../../input/semantic-bind-rows.js';
import { motionStatusText } from '../transitions.js';
import { browserRuntime } from '../../runtime/browser-runtime.js';
import { formatRunTime, getBestTime } from '../../speedrun/speedrun.js';

const categoryDescriptions = {
  keyboard: 'Remap keyboard controls. Selecting a binding replaces that action’s current keys. Reset defaults restores alternate keys.',
  controller: 'Enable controller input, verify detection, inspect raw input, and remap controller buttons.',
  gameplay: 'Tune optional run tracking and gameplay-facing helpers.',
  accessibility: 'Adjust motion and comfort options.',
  graphics: 'Optional GPU-backed render and shader extras.',
  advanced: 'Developer tools and raw settings.'
};

const controllerSubpages = [
  { id: 'diagnostics', title: 'Verify & Debug', description: 'Controller input is locked to a live diagnostic view until you use the mouse or hold B / Circle for 2 seconds.' }
];

export const settingsCategories = [
  { id: 'keyboard', title: 'Keyboard', description: categoryDescriptions.keyboard },
  { id: 'controller', title: 'Controller', description: categoryDescriptions.controller },
  { id: 'gameplay', title: 'Gameplay', description: categoryDescriptions.gameplay },
  { id: 'accessibility', title: 'Accessibility', description: categoryDescriptions.accessibility },
  { id: 'graphics', title: 'Graphics', description: categoryDescriptions.graphics },
  { id: 'advanced', title: 'Advanced', description: categoryDescriptions.advanced }
];

const keycaps = text => text.split(' / ').map(part => `<span class="ds-keycap">${part}</span>`).join(' ');
const onOff = value => value ? 'On' : 'Off';

function section(title, body) {
  return `<section class="ds-section settings-section"><h3>${title}</h3>${body}</section>`;
}

function valueRow({ id, label, value, description = '', kind = 'setting' }) {
  return `<button type="button" class="ds-setting-row ds-setting-row--${kind}" data-setting-row="${id}">
    <span class="ds-setting-row__copy"><span class="ds-setting-row__label">${label}</span>${description ? `<span class="ds-setting-row__description">${description}</span>` : ''}</span>
    <span class="ds-setting-row__value">${value}</span>
  </button>`;
}

function infoRow(label, value, id) {
  return `<div class="ds-setting-row ds-setting-row--info">
    <span class="ds-setting-row__copy"><span class="ds-setting-row__label">${label}</span></span>
    <span class="ds-setting-row__value"${id ? ` id="${id}"` : ''}>${value}</span>
  </div>`;
}

function controllerSelectionRow(game) {
  const selectedRuntimeId = game.settings.input.slots.player1.devices.gamepad.selectedRuntimeId;
  const devices = game.inputRuntime?.connectedDevices?.('gamepad') || [];
  if (!devices.length) return infoRow('Selected Controller', selectedRuntimeId || 'Auto / none connected', 'selectedControllerName');
  const buttons = devices.map(device => `<button type="button" class="ds-button ds-button--secondary" data-controller-select="${device.runtimeId}"${device.runtimeId === selectedRuntimeId ? ' aria-pressed="true"' : ''}>${device.runtimeId === selectedRuntimeId ? 'Selected: ' : 'Select: '}${device.id || device.runtimeId}</button>`).join(' ');
  return `<div class="ds-setting-row ds-setting-row--info">
    <span class="ds-setting-row__copy"><span class="ds-setting-row__label">Selected Controller</span><span class="ds-setting-row__description">Selection is explicit; disconnects do not silently switch to another controller.</span></span>
    <span class="ds-setting-row__value controller-select-list" id="selectedControllerName">${buttons}</span>
  </div>`;
}

const xboxAsset = file => `/assets/kenney-input-prompts/xbox/${file}`;
const debugPadButton = ({ code, label, className = '' }) => `<span class="controller-debugger__pad-button ${className}" data-controller-debug-code="${code}" aria-pressed="false"><span>${label}</span></span>`;
const debugAxisReadout = ({ axis, label }) => `<span class="controller-debugger__axis-readout" data-controller-debug-axis="${axis}" style="--axis-value:0"><span>${label}</span><b data-controller-axis-value="${axis}">0.00</b></span>`;

function controllerDebugger(game) {
  return section('Controller Debugger', `${infoRow('Controller Input Lock', game.input.controllerDebugLock ? 'On' : 'Off')}
  <p class="settings-page-note helper">Controller presses update this panel only. Hold <b>B / Circle</b> for 2 seconds to leave with the controller.</p>
  <div class="controller-debugger${game.input.controllerDebugLock ? ' is-input-locked' : ''}" data-controller-debugger-layout="fallback" aria-label="Controller-shaped live input debugger">
    <div class="controller-debugger__title"><span>Default controller</span><b data-controller-debug-lock-label>${game.input.controllerDebugLock ? 'Hold B to exit' : 'Fallback layout'}</b></div>
    <div class="controller-debugger__pad" aria-hidden="false">
      <img class="controller-debugger__body" src="${xboxAsset('controller_xboxseries.svg')}" alt="" loading="lazy">
      ${debugPadButton({ code: 'PadButton4', label: 'LB', className: 'is-shoulder is-left' })}
      ${debugPadButton({ code: 'PadButton5', label: 'RB', className: 'is-shoulder is-right' })}
      ${debugPadButton({ code: 'PadButton6', label: 'LT', className: 'is-trigger is-left' })}
      ${debugPadButton({ code: 'PadButton7', label: 'RT', className: 'is-trigger is-right' })}
      <span class="controller-debugger__stick is-left" data-controller-stick="left" data-controller-debug-code="PadButton10" aria-pressed="false"><i></i><b>LS</b></span>
      <span class="controller-debugger__stick is-right" data-controller-stick="right" data-controller-debug-code="PadButton11" aria-pressed="false"><i></i><b>RS</b></span>
      <span class="controller-debugger__dpad" aria-label="D-pad">
        ${debugPadButton({ code: 'PadButton12', label: '▲', className: 'is-dpad is-up' })}
        ${debugPadButton({ code: 'PadButton13', label: '▼', className: 'is-dpad is-down' })}
        ${debugPadButton({ code: 'PadButton14', label: '◀', className: 'is-dpad is-left' })}
        ${debugPadButton({ code: 'PadButton15', label: '▶', className: 'is-dpad is-right' })}
      </span>
      ${debugPadButton({ code: 'PadButton0', label: 'A', className: 'is-face is-a' })}
      ${debugPadButton({ code: 'PadButton1', label: 'B', className: 'is-face is-b' })}
      ${debugPadButton({ code: 'PadButton2', label: 'X', className: 'is-face is-x' })}
      ${debugPadButton({ code: 'PadButton3', label: 'Y', className: 'is-face is-y' })}
      ${debugPadButton({ code: 'PadButton8', label: 'View', className: 'is-system is-view' })}
      ${debugPadButton({ code: 'PadButton16', label: 'Guide', className: 'is-system is-guide' })}
      ${debugPadButton({ code: 'PadButton9', label: 'Menu', className: 'is-system is-menu' })}
      ${debugPadButton({ code: 'PadButton17', label: 'Share', className: 'is-system is-share' })}
    </div>
    <div class="controller-debugger__meters" aria-label="Analog input values">
      ${debugAxisReadout({ axis: 6, label: 'Left Trigger' })}
      ${debugAxisReadout({ axis: 7, label: 'Right Trigger' })}
      ${debugAxisReadout({ axis: 0, label: 'Left Stick X' })}
      ${debugAxisReadout({ axis: 1, label: 'Left Stick Y' })}
      ${debugAxisReadout({ axis: 2, label: 'Right Stick X' })}
      ${debugAxisReadout({ axis: 3, label: 'Right Stick Y' })}
    </div>
  </div>`);
}

function bindRow(game, device, action) {
  const listening = device === 'controller' ? game.input.controllerBindAction === action : game.input.listeningFor === action;
  const text = rowText(game.settings, action, device);
  const prompt = device === 'controller' ? 'Press controller input…' : 'Press a key…';
  const value = listening ? prompt : keycaps(text);
  const error = game.input.bindError?.device === device && game.input.bindError?.action === action;
  return `<button type="button" class="ds-setting-row ds-setting-row--bind${listening ? ' is-listening' : ''}${error ? ' is-error' : ''}" data-bind-action="${action}" data-bind-device="${device}">
    <span class="ds-setting-row__copy"><span class="ds-setting-row__label">${bindLabel(action)}</span></span>
    <span class="ds-setting-row__value bind-keycaps">${value}</span>
  </button>`;
}

function bindSections(game, device) {
  return bindGroups.map(group => section(group.title, `<div class="settings-row-list">${group.rows.map(action => bindRow(game, device, action)).join('')}</div>`)).join('');
}

function pageNote(text) {
  return `<p class="settings-page-note helper">${text}</p>`;
}

function renderKeyboard(game) {
  return `${pageNote('Select a row, then press a key. Escape cancels. Duplicate keys are blocked.')}
    ${bindSections(game, 'keyboard')}
    <div class="settings-actions ds-action-row"><button type="button" class="secondary ds-button ds-button--secondary" data-settings-action="reset-keyboard">Reset Keyboard Defaults</button></div>`;
}

function controllerSubpageCard(page) {
  return `<button type="button" class="settings-category-card ds-list-card" data-controller-settings-page="${page.id}">
    <span class="settings-category-card__title">${page.title}</span>
    <span class="settings-category-card__description">${page.description}</span>
  </button>`;
}

function controllerSubpageHeader(game, title, note = '') {
  return `<div class="settings-subpage-header">
    <button type="button" class="settings-back-button ds-button ds-button--secondary" data-controller-settings-back>Controller</button>
    <span class="settings-subpage-header__crumb">Settings / Controller / ${title}</span>
  </div>${note ? pageNote(note) : ''}`;
}

function renderControllerDiagnostics(game) {
  return `${controllerSubpageHeader(game, 'Verify & Debug', 'Controller input is locked to this diagnostic page. Use the mouse or hold B / Circle for 2 seconds to return.')}
    ${section('Live Status', `<div class="settings-row-list">
      ${infoRow('Detected Controller', 'None detected', 'controllerName')}
      ${controllerSelectionRow(game)}
      ${infoRow('Pressed Inputs', 'None', 'controllerInputs')}
    </div><div id="controllerStatus" class="status-line">Controller input lock on. Hold B / Circle for 2 seconds to exit.</div>`)}
    ${controllerDebugger(game)}`;
}

function renderController(game) {
  const page = controllerSubpages.find(entry => entry.id === game.menu.settingsSubpage);
  if (page?.id === 'diagnostics') return renderControllerDiagnostics(game);
  game.input.controllerDebugLock = false;
  game.input.controllerDebugExitStartedAt = 0;
  return `${pageNote('Select a row, then press a controller input. B / Circle cancels. Duplicate buttons are blocked.')}
    ${section('Controller Setup', `<div class="settings-row-list">
      ${valueRow({ id: 'controller-enabled', label: 'Controller Input', value: onOff(game.settings.input.slots.player1.devices.gamepad.enabled), description: 'Allow gamepad input during play and menus.', kind: 'toggle' })}
    </div><div id="controllerStatus" class="status-line"></div>`)}
    ${section('Diagnostics', `<div class="settings-category-list settings-subpage-list">${controllerSubpages.map(controllerSubpageCard).join('')}</div>`)}
    ${bindSections(game, 'controller')}
    <div class="settings-actions ds-action-row"><button type="button" class="secondary ds-button ds-button--secondary" data-settings-action="reset-controller">Reset Controller Defaults</button></div>`;
}

function renderGameplay(game) {
  const bestMs = getBestTime(game.speedRun, game.tilemap?.id || '');
  return `${section('Speed Run', `<div class="settings-row-list">
    ${valueRow({ id: 'speed-run-mode', label: 'Speed Run Mode', value: onOff(game.settings.speedRunMode), description: 'Shows an in-game timer and saves your best Any% time per level.', kind: 'toggle' })}
    ${infoRow('Current Level Best Any%', bestMs === null ? '--:--.---' : formatRunTime(bestMs))}
  </div>`)}
  <div class="settings-actions ds-action-row"><button type="button" class="secondary ds-button ds-button--secondary" data-settings-action="clear-speedrun-records">Clear Speed Run Records</button></div>`;
}

function renderAccessibility(game) {
  const labels = { system: 'System', on: 'On', off: 'Off' };
  return section('Comfort', `<div class="settings-row-list">
    ${valueRow({ id: 'motion', label: 'Motion Effects', value: labels[game.settings.motion], description: 'Cycles System, On, and Off.', kind: 'cycle' })}
  </div><div id="motionStatus" class="status-line">${motionStatusText(game)}</div>`);
}

function renderGraphics(game) {
  const labels = { auto: 'Auto', off: 'Off' };
  return section('GPU Extras', `<div class="settings-row-list">
    ${valueRow({ id: 'gpu-extras', label: 'GPU Extras', value: labels[game.settings.gpuExtras], description: 'Enables optional WebGPU-backed render, compute, and shader features when supported. Turning off takes effect after reload.', kind: 'cycle' })}
    ${infoRow('Active Presentation', game.presentation?.mode?.toUpperCase?.() || 'Unknown')}
  </div>`);
}

function renderAdvanced(game) {
  return `${section('Developer', `<div class="settings-row-list">
    ${valueRow({ id: 'developer-mode', label: 'Developer Mode', value: onOff(game.settings.developerMode), description: 'Shows raw settings tools.', kind: 'toggle' })}
  </div>`)}
  <div id="developerTools" class="advanced-tools"${game.settings.developerMode ? '' : ' hidden'}>
    ${section('Raw App Settings', `<textarea id="settingsJson" class="bind-json" spellcheck="false" placeholder="App settings JSON appears here."></textarea>
      <div class="settings-actions ds-action-row">
        <button type="button" class="secondary ds-button ds-button--secondary" data-settings-action="dump-settings">Dump app settings</button>
        <button type="button" class="secondary ds-button ds-button--secondary" data-settings-action="replace-settings">Replace app settings</button>
      </div>
      <div id="settingsJsonStatus" class="status-line" aria-live="polite"></div>`)}
  </div>`;
}

const renderers = { keyboard: renderKeyboard, controller: renderController, gameplay: renderGameplay, accessibility: renderAccessibility, graphics: renderGraphics, advanced: renderAdvanced };

export function activeSettingsCategory(game) {
  return selectedCategory(game) || settingsCategories[0];
}

export function renderSettingsTabs(game) {
  const active = activeSettingsCategory(game).id;
  return `<div class="settings-tabs" role="tablist" aria-label="Settings categories">
    <span class="settings-tabs__hint" data-settings-tab-hint="previous" data-input-tab-hint data-input-action="menu.previousTab" aria-hidden="true" hidden>LB</span>
    ${settingsCategories.map(category => {
      const selected = category.id === active;
      return `<button type="button" role="tab" aria-selected="${selected ? 'true' : 'false'}" data-settings-tab="${category.id}">
        <span class="settings-tab__label">${category.title}</span>
      </button>`;
    }).join('')}
    <span class="settings-tabs__hint" data-settings-tab-hint="next" data-input-tab-hint data-input-action="menu.nextTab" aria-hidden="true" hidden>RB</span>
  </div>`;
}

export function selectedCategory(game) {
  return settingsCategories.find(category => category.id === game.menu.settingsCategory) || null;
}

export function renderSettingsHub(game) {
  const { ui } = game;
  ui.settingsRootRows.innerHTML = renderSettingsTabs(game);
  ui.settingsCategoryList.innerHTML = settingsCategories.map(category => `
    <button type="button" class="settings-category-card ds-list-card" data-settings-category="${category.id}">
      <span class="settings-category-card__title">${category.title}</span>
      <span class="settings-category-card__description">${category.description}</span>
    </button>`).join('');
}

export function refreshDynamicRefs(game) {
  const { ui } = game;
  ui.settingsJson = document.getElementById('settingsJson');
  ui.dumpSettingsButton = document.querySelector('[data-settings-action="dump-settings"]');
  ui.replaceSettingsButton = document.querySelector('[data-settings-action="replace-settings"]');
  ui.settingsJsonStatus = document.getElementById('settingsJsonStatus');
  ui.developerTools = document.getElementById('developerTools');
  ui.controllerName = document.getElementById('controllerName');
  ui.controllerInputs = document.getElementById('controllerInputs');
  ui.selectedControllerName = document.getElementById('selectedControllerName');
  ui.controllerStatus = document.getElementById('controllerStatus');
  ui.motionStatus = document.getElementById('motionStatus');
  ui.bindStatus = ui.settingsStatus;
  ui.bindList = ui.settingsCategoryBody;
}

export function renderSettingsCategory(game, runtime = browserRuntime) {
  const category = selectedCategory(game);
  const { ui } = game;
  if (!category) return;
  const controllerPage = category.id === 'controller' ? controllerSubpages.find(page => page.id === game.menu.settingsSubpage) : null;
  ui.settingsCategoryDescription.textContent = controllerPage ? controllerPage.description : category.description;
  if (game.input.bindError && runtime.now() > game.input.bindError.until) game.input.bindError = null;
  ui.settingsCategoryBody.innerHTML = `${renderSettingsTabs(game)}<div class="settings-tab-panel" role="tabpanel">${renderers[category.id](game)}</div>`;
  refreshDynamicRefs(game);
}

export function renderSettings(game) {
  if (game.menu.page === 'settings-category') {
    game.ui.settingsRootRows.innerHTML = '';
    game.ui.settingsCategoryList.innerHTML = '';
    renderSettingsCategory(game);
    return;
  }
  renderSettingsHub(game);
}

export function defaultActionsForDevice() {
  return Object.keys(bindGroups.flatMap(group => group.rows).reduce((acc, row) => ({ ...acc, [row]: true }), {}));
}
