import { bindLabels, bindText, controllerBindText, controllerName, defaultBinds, defaultGamepadBinds } from './app/input/legacy-bind-state.js';
import { motionStatusText } from './transitions.js';
import { browserRuntime } from './runtime.js';
import { formatRunTime, getBestTime } from './speedrun.js';

const categoryDescriptions = {
  keyboard: 'Remap keyboard controls. Selecting a binding replaces that action’s current keys. Reset defaults restores alternate keys.',
  controller: 'Enable controller input, test detection, and remap controller buttons.',
  gameplay: 'Tune optional run tracking and gameplay-facing helpers.',
  accessibility: 'Adjust motion and comfort options.',
  graphics: 'Optional GPU-backed render and shader extras.',
  advanced: 'Developer tools and raw settings.'
};

export const settingsCategories = [
  { id: 'keyboard', title: 'Keyboard', description: categoryDescriptions.keyboard },
  { id: 'controller', title: 'Controller', description: categoryDescriptions.controller },
  { id: 'gameplay', title: 'Gameplay', description: categoryDescriptions.gameplay },
  { id: 'accessibility', title: 'Accessibility', description: categoryDescriptions.accessibility },
  { id: 'graphics', title: 'Graphics', description: categoryDescriptions.graphics },
  { id: 'advanced', title: 'Advanced', description: categoryDescriptions.advanced }
];

const bindGroups = [
  { title: 'Movement', actions: ['left', 'right', 'jump', 'dash'] },
  { title: 'Actions', actions: ['attack'] },
  { title: 'System', actions: ['pause', 'restart'] }
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

function bindRow(game, device, action) {
  const listening = device === 'controller' ? game.input.controllerBindAction === action : game.input.listeningFor === action;
  const text = device === 'controller' ? controllerBindText(game.input, action) : bindText(game.input, action);
  const prompt = device === 'controller' ? 'Press controller input…' : 'Press a key…';
  const value = listening ? prompt : keycaps(text);
  const error = game.input.bindError?.device === device && game.input.bindError?.action === action;
  return `<button type="button" class="ds-setting-row ds-setting-row--bind${listening ? ' is-listening' : ''}${error ? ' is-error' : ''}" data-bind-action="${action}" data-bind-device="${device}">
    <span class="ds-setting-row__copy"><span class="ds-setting-row__label">${bindLabels[action]}</span></span>
    <span class="ds-setting-row__value bind-keycaps">${value}</span>
  </button>`;
}

function bindSections(game, device) {
  return bindGroups.map(group => section(group.title, `<div class="settings-row-list">${group.actions.map(action => bindRow(game, device, action)).join('')}</div>`)).join('');
}

function pageNote(text) {
  return `<p class="settings-page-note helper">${text}</p>`;
}

function renderKeyboard(game) {
  return `${pageNote('Select a row, then press a key. Escape cancels. Duplicate keys are blocked.')}
    ${bindSections(game, 'keyboard')}
    <div class="settings-actions ds-action-row"><button type="button" class="secondary ds-button ds-button--secondary" data-settings-action="reset-keyboard">Reset Keyboard Defaults</button></div>`;
}

function renderController(game) {
  return `${section('Controller Setup', `<div class="settings-row-list">
      ${valueRow({ id: 'controller-enabled', label: 'Controller Input', value: onOff(game.input.useController), description: 'Allow gamepad input during play and menus.', kind: 'toggle' })}
      ${infoRow('Detected Controller', 'None detected', 'controllerName')}
      ${controllerSelectionRow(game)}
      ${infoRow('Pressed Inputs', 'None', 'controllerInputs')}
    </div><div id="controllerStatus" class="status-line"></div>`)}
    ${pageNote('Select a bind row, then press a controller input. B / Circle cancels. Duplicate buttons are blocked.')}
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
    ${infoRow('Active Presenter', game.presenter?.mode?.toUpperCase?.() || 'Unknown')}
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
  ui.settingsCategoryDescription.textContent = category.description;
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

export function defaultActionsForDevice(device) {
  return Object.keys(device === 'controller' ? defaultGamepadBinds : defaultBinds);
}
