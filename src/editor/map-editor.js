import { CELL_SIZE } from '../core/constants.js';
import { drawCollisionDebugOverlay } from '../devtools/debug-render.js';
import { getAllTilemaps, getDefaultTilemap } from '../content/tilemaps/registry.js';
import { planContainedTerrainTileVisuals } from '../render/contained-terrain.js';
import { spikeFieldCommands } from '../render/extractors/primitive-builders.js';
import { TERRAIN_KIND as K, terrainKindConfig } from '../core/tilemaps/terrain-layer.js';
import { compileDraft as compileTilemapDraft, createBlankDraft, createDraftFromTilemap as draftFromTilemap, EMPTY, hasEntitySymbol, normalizeDraft, replaceChar } from './tilemap-draft.js';
import { BRUSHES, brushesForPack, defaultPackForLayer, layerById, packsForLayer } from './edit-domain.js';
import { createPreviewPayload, createSharePayload, draftFromSharePayload, generatedTilemapModule, readBooleanPreference, savedLocalStatus, writeBooleanPreference } from './map-editor-commands.js';
import {
  applyWorldTransform,
  clearViewport,
  clampCamera,
  createViewport,
  eventToScreenPoint,
  eventToWorld,
  panByScreenDelta,
  resetView,
  resizeViewport,
  screenToWorld,
  visibleWorldRect,
  zoomAtScreenPoint
} from './editor-viewport.js';
import { createEditorScheduler } from './editor-scheduler.js';
import { createHistory } from './editor-history.js';
import { isKebabCaseId } from '../catalog/id.js';
import { localDraftStorageKey, localDraftViewStorageKey, readLocalDraft, saveLocalDraft } from '../catalog/local-drafts/storage.js';
import { createBrowserInputAdapter, createGameInputRuntime } from '../app/input/browser-input-adapter.js';
import { renderInputHints, renderTabInputHints } from '../app/input/input-presentation.js';
import { gameInputProfile } from '../app/input/game-input-profile.js';
import { loadSettings } from '#/app/settings/settings.js';
import { currentFocusElement, ensureMenuFocus, moveLinearFocus, visibleFocusables } from '../ui/navigation.js';
import { createNativeBackAdapter } from '../app/navigation/native-back.js';
const AUTO_SAVE_STORAGE_KEY = 'chibi.tilemap-editor.auto-save';
const FLOATING_CONTROLS_STORAGE_KEY = 'chibi.tilemap-editor.floating-controls';
const FINAL_TERRAIN_STORAGE_KEY = 'chibi.tilemap-editor.final-terrain';
const CONTROLLER_BRUSH_SETTINGS_STORAGE_KEY = 'chibi.tilemap-editor.controller-brush';
const CONTROLLER_PALETTE_POSITIONS = new Set(['bottom-right', 'near-cursor']);
const CONTROLLER_PALETTE_SIZES = new Set(['compact', 'normal', 'large']);
const DEFAULT_CONTROLLER_BRUSH_SETTINGS = Object.freeze({
  sensitivity: 5,
  momentumEnabled: false,
  momentumDelayMs: 450,
  momentumMaxSpeed: 2.5,
  palettePosition: 'bottom-right',
  cursorPaletteSize: 'compact',
  bottomRightPaletteSize: 'normal'
});
const CAPTURE_MODE_ENABLED = import.meta.env?.VITE_ENABLE_CAPTURE_MODE === 'true';
const CAPTURE_TARGET = CAPTURE_MODE_ENABLED ? new URLSearchParams(location.search).get('capture') : null;

const dom = {
  canvas: document.querySelector('#editorCanvas'),
  mainMenuButton: document.querySelector('#mainMenuButton'),
  saveLocalButton: document.querySelector('#saveLocalButton'),
  quickPreviewButton: document.querySelector('#quickPreviewButton'),
  overlay: document.querySelector('#editorOverlay'),
  hideOverlayButton: document.querySelector('#hideOverlayButton'),
  overlayToggleLabel: document.querySelector('[data-overlay-toggle-label]'),
  overlayToggleHint: document.querySelector('.overlay-toggle-hint'),
  controllerPanelHint: document.querySelector('#controllerPanelHint'),
  tabs: Array.from(document.querySelectorAll('[data-editor-tab]')),
  tabHints: Array.from(document.querySelectorAll('[data-editor-tab-hint]')),
  panels: Array.from(document.querySelectorAll('[role="tabpanel"]')),
  autoSaveToggle: document.querySelector('#autoSaveToggle'),
  floatingControlsToggle: document.querySelector('#floatingControlsToggle'),
  floatingViewControls: document.querySelector('#floatingViewControls'),
  panToggleButton: document.querySelector('#panToggleButton'),
  tilemapSelect: document.querySelector('#tilemapSelect'),
  nameInput: document.querySelector('#nameInput'),
  idInput: document.querySelector('#idInput'),
  colsInput: document.querySelector('#colsInput'),
  rowsInput: document.querySelector('#rowsInput'),
  newButton: document.querySelector('#newButton'),
  resetButton: document.querySelector('#resetButton'),
  zoomOutButton: document.querySelector('#zoomOutButton'),
  zoomInButton: document.querySelector('#zoomInButton'),
  resetViewButton: document.querySelector('#resetViewButton'),
  zoomReadout: document.querySelector('#zoomReadout'),
  packWheelHud: document.querySelector('#packWheelHud'),
  packWheelItems: document.querySelector('#packWheelItems'),
  wheelLayerLabel: document.querySelector('#wheelLayerLabel'),
  wheelZoomReadout: document.querySelector('#wheelZoomReadout'),
  wheelZoomFill: document.querySelector('#wheelZoomFill'),
  wheelBrushSwatch: document.querySelector('#wheelBrushSwatch'),
  wheelBrushLabel: document.querySelector('#wheelBrushLabel'),
  wheelPackLabel: document.querySelector('#wheelPackLabel'),
  controllerViewportHints: document.querySelector('#controllerViewportHints'),
  undoButton: document.querySelector('#undoButton'),
  redoButton: document.querySelector('#redoButton'),
  editLayerButtons: Array.from(document.querySelectorAll('[data-edit-layer]')),
  packSectionTitle: document.querySelector('#packSectionTitle'),
  packSummary: document.querySelector('#packSummary'),
  brushSectionTitle: document.querySelector('#brushSectionTitle'),
  brushLayerHint: document.querySelector('#brushLayerHint'),
  brushes: document.querySelector('#brushes'),
  controllerBrushSensitivityInput: document.querySelector('#controllerBrushSensitivityInput'),
  controllerBrushSensitivityValue: document.querySelector('#controllerBrushSensitivityValue'),
  controllerBrushMomentumToggle: document.querySelector('#controllerBrushMomentumToggle'),
  controllerBrushMomentumDelayInput: document.querySelector('#controllerBrushMomentumDelayInput'),
  controllerBrushMomentumSpeedInput: document.querySelector('#controllerBrushMomentumSpeedInput'),
  controllerPalettePositionSelect: document.querySelector('#controllerPalettePositionSelect'),
  controllerCursorPaletteSizeSelect: document.querySelector('#controllerCursorPaletteSizeSelect'),
  controllerBottomRightPaletteSizeSelect: document.querySelector('#controllerBottomRightPaletteSizeSelect'),
  gridToggle: document.querySelector('#gridToggle'),
  finalTerrainToggle: document.querySelector('#finalTerrainToggle'),
  collisionToggle: document.querySelector('#collisionToggle'),
  previewButton: document.querySelector('#previewButton'),
  copyButton: document.querySelector('#copyButton'),
  exportMapButton: document.querySelector('#exportMapButton'),
  importMapButton: document.querySelector('#importMapButton'),
  importMapInput: document.querySelector('#importMapInput'),
  exportText: document.querySelector('#exportText'),
  status: document.querySelector('#status')
};

const ctx = dom.canvas.getContext('2d');
const viewport = createViewport(dom.canvas);
const scheduler = createEditorScheduler();
const history = createHistory({ limit: 100 });
const inputRuntime = createGameInputRuntime(loadSettings());
const inputAdapter = createBrowserInputAdapter(inputRuntime);
const registeredTilemaps = getAllTilemaps();
const debug = window.__mapEditorDebug = window.__mapEditorDebug ?? { compileCount: 0, exportCount: 0, persistCount: 0, renderCount: 0, cursorRenderCount: 0 };

let brush = BRUSHES[0];
let draft = createDraftFromTilemap(getDefaultTilemap());
let compiled = null;
let compiledFresh = false;
let pointer = null;
let isPainting = false;
let panPointer = null;
let lastPaintKey = null;
let activePointers = new Map();
let pinch = null;
let editorSource = 'registered';
let loadedLocalDraftId = null;
let activeTab = 'edit';
let activeEditLayerId = brush.layerId;
let activePackId = defaultPackForLayer(activeEditLayerId)?.id ?? null;
let overlayHidden = false;
let autoSaveEnabled = readBooleanPreference(localStorage, AUTO_SAVE_STORAGE_KEY, true);
let floatingControlsEnabled = readBooleanPreference(localStorage, FLOATING_CONTROLS_STORAGE_KEY, true);
let finalTerrainEnabled = readBooleanPreference(localStorage, FINAL_TERRAIN_STORAGE_KEY, true);
let controllerBrushSettings = readControllerBrushSettings();
let dirty = false;
let saving = false;
let panMode = false;
let editorPanelLastFocused = null;
let controllerNavX = 0;
let controllerNavY = 0;
let controllerCanvasMode = 'draw';
let editorInputMode = 'pointer';
let controllerGhostPointer = null;
let controllerPaintActive = false;
let controllerNextMoveAt = 0;
let controllerMoveHeldSince = 0;
let controllerMoveHoldKey = '';
let controllerSelectBrowse = null;
let controllerBrushPickerOpen = false;
let controllerBrushPickerHighlightedIndex = 0;
let controllerPickerNavX = 0;
let controllerPickerNavY = 0;
let controllerPickerNextMoveAt = 0;
let controllerPickerMoveHoldKey = '';
let packWheelWakeTimer = 0;
let nativeBack = null;

function storageKey(id) { return localDraftStorageKey(id); }
function viewStorageKey(id) { return localDraftViewStorageKey(id); }
function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
function readControllerBrushSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONTROLLER_BRUSH_SETTINGS_STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_CONTROLLER_BRUSH_SETTINGS };
    return {
      sensitivity: Math.round(clampNumber(saved.sensitivity, 1, 10, DEFAULT_CONTROLLER_BRUSH_SETTINGS.sensitivity)),
      momentumEnabled: Boolean(saved.momentumEnabled),
      momentumDelayMs: Math.round(clampNumber(saved.momentumDelayMs, 100, 2000, DEFAULT_CONTROLLER_BRUSH_SETTINGS.momentumDelayMs)),
      momentumMaxSpeed: clampNumber(saved.momentumMaxSpeed, 1, 5, DEFAULT_CONTROLLER_BRUSH_SETTINGS.momentumMaxSpeed),
      palettePosition: CONTROLLER_PALETTE_POSITIONS.has(saved.palettePosition) ? saved.palettePosition : DEFAULT_CONTROLLER_BRUSH_SETTINGS.palettePosition,
      cursorPaletteSize: CONTROLLER_PALETTE_SIZES.has(saved.cursorPaletteSize) ? saved.cursorPaletteSize : DEFAULT_CONTROLLER_BRUSH_SETTINGS.cursorPaletteSize,
      bottomRightPaletteSize: CONTROLLER_PALETTE_SIZES.has(saved.bottomRightPaletteSize) ? saved.bottomRightPaletteSize : DEFAULT_CONTROLLER_BRUSH_SETTINGS.bottomRightPaletteSize
    };
  } catch {
    return { ...DEFAULT_CONTROLLER_BRUSH_SETTINGS };
  }
}
function writeControllerBrushSettings() { localStorage.setItem(CONTROLLER_BRUSH_SETTINGS_STORAGE_KEY, JSON.stringify(controllerBrushSettings)); }
function controllerBrushRepeatMs() {
  const t = (controllerBrushSettings.sensitivity - 1) / 9;
  return 170 - t * 125;
}
function controllerBrushMomentumMultiplier(now) {
  if (!controllerBrushSettings.momentumEnabled || !controllerMoveHeldSince) return 1;
  const delay = controllerBrushSettings.momentumDelayMs;
  const elapsed = now - controllerMoveHeldSince;
  if (elapsed <= delay) return 1;
  const ramp = Math.min(1, (elapsed - delay) / delay);
  return 1 + (controllerBrushSettings.momentumMaxSpeed - 1) * ramp;
}
function worldWidth() { return draft.cols * CELL_SIZE.GRID; }
function worldHeight() { return draft.rows * CELL_SIZE.GRID; }
function terrainLayer() { return draft.layers.find(layer => layer.id === 'solid' || layer.id === 'terrain'); }
function entityLayer() { return draft.layers.find(layer => layer.id === 'placedAssets' || layer.id === 'entities'); }
function hazardLayer() { return draft.layers.find(layer => layer.id === 'hazards'); }
function createDraftFromTilemap(tilemap) {
  const saved = localStorage.getItem(storageKey(tilemap.id));
  if (saved) {
    try { return normalizeDraft(JSON.parse(saved)); } catch { localStorage.removeItem(storageKey(tilemap.id)); }
  }
  return draftFromTilemap(tilemap);
}

function compileDraft() {
  debug.compileCount++;
  compiled = compileTilemapDraft(draft);
  compiledFresh = true;
  return compiled;
}

function ensureCompiled() {
  if (!compiled || !compiledFresh) compileDraft();
  return compiled;
}

function generatedModule() {
  debug.exportCount++;
  return generatedTilemapModule(draft);
}

function sharePayload() {
  return createSharePayload(draft);
}

function setStatus(message, kind = '') {
  debug.lastStatus = { message, kind };
  if (!dom.status) return;
  dom.status.textContent = message;
  dom.status.className = `status ${kind}`.trim();
}

function persist({ syncMetadata = true } = {}) {
  debug.persistCount++;
  if (syncMetadata) syncDraftMetadataFromInputs();
  const result = saveLocalDraft(localStorage, draft);
  if (!result.ok) throw new Error(result.message);
  draft = result.draft;
  return result;
}

function tryPersist() {
  try { return persist(); } catch (error) { setStatus(`${error.message} Fix draft ID to save locally.`, 'error'); return { ok: false, error }; }
}

function syncDraftMetadataFromInputs() {
  if (dom.nameInput) draft.name = dom.nameInput.value.trim() || 'Untitled Local Map';
  if (dom.idInput) draft.id = dom.idInput.value.trim();
}

function updateSaveButton() {
  if (!dom.saveLocalButton) return;
  const valid = isKebabCaseId(draft.id);
  if (!valid) {
    dom.saveLocalButton.textContent = 'Fix ID to save';
    dom.saveLocalButton.disabled = true;
    dom.saveLocalButton.dataset.saveState = 'invalid';
    return;
  }
  if (saving) {
    dom.saveLocalButton.textContent = autoSaveEnabled ? 'Saving…' : 'Save local';
    dom.saveLocalButton.disabled = false;
    dom.saveLocalButton.dataset.saveState = 'saving';
    return;
  }
  if (dirty || scheduler.dirty) {
    dom.saveLocalButton.textContent = autoSaveEnabled ? 'Save now' : 'Save local';
    dom.saveLocalButton.disabled = false;
    dom.saveLocalButton.dataset.saveState = 'dirty';
    return;
  }
  dom.saveLocalButton.textContent = 'Saved';
  dom.saveLocalButton.disabled = true;
  dom.saveLocalButton.dataset.saveState = 'clean';
}

function markDirty() {
  dirty = true;
  updateSaveButton();
}

function commitSave({ status = true } = {}) {
  saving = true;
  updateSaveButton();
  try {
    scheduler.flush(() => {
      ensureCompiled();
      persist();
      syncInputs();
      render();
    });
    dirty = false;
    if (status) {
      const savedStatus = savedLocalStatus(draft);
      setStatus(savedStatus.message, savedStatus.kind);
    }
  } finally {
    saving = false;
    updateSaveButton();
  }
}

function saveLocalExplicit() {
  try { commitSave(); } catch (error) { setStatus(error.message, 'error'); updateSaveButton(); }
}

function saveView() {
  localStorage.setItem(viewStorageKey(draft.id), JSON.stringify(viewport.camera));
}

function loadViewOrReset() {
  resizeViewport(viewport);
  try {
    const saved = JSON.parse(localStorage.getItem(viewStorageKey(draft.id)) || 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && Number.isFinite(saved.zoom)) {
      viewport.camera = { x: saved.x, y: saved.y, zoom: Math.max(viewport.minZoom, Math.min(viewport.maxZoom, saved.zoom)) };
      clampCamera(viewport, worldWidth(), worldHeight());
      return;
    }
  } catch {}
  resetView(viewport, worldWidth(), worldHeight());
}

function syncInputs() {
  if (dom.nameInput && document.activeElement !== dom.nameInput) dom.nameInput.value = draft.name || '';
  if (dom.idInput && document.activeElement !== dom.idInput) dom.idInput.value = draft.id || '';
  dom.colsInput.value = draft.cols;
  dom.rowsInput.value = draft.rows;
  dom.exportText.value = generatedModule();
  updateZoomReadout();
  updateHistoryControls();
  updateSaveButton();
}

function updateHistoryControls() {
  if (dom.undoButton) dom.undoButton.disabled = !history.canUndo;
  if (dom.redoButton) dom.redoButton.disabled = !history.canRedo;
}

function syncControllerBrushSettingsUi() {
  if (dom.controllerBrushSensitivityInput) dom.controllerBrushSensitivityInput.value = String(controllerBrushSettings.sensitivity);
  if (dom.controllerBrushSensitivityValue) dom.controllerBrushSensitivityValue.textContent = String(controllerBrushSettings.sensitivity);
  if (dom.controllerBrushMomentumToggle) dom.controllerBrushMomentumToggle.checked = controllerBrushSettings.momentumEnabled;
  if (dom.controllerBrushMomentumDelayInput) dom.controllerBrushMomentumDelayInput.value = String(controllerBrushSettings.momentumDelayMs);
  if (dom.controllerBrushMomentumSpeedInput) dom.controllerBrushMomentumSpeedInput.value = String(controllerBrushSettings.momentumMaxSpeed);
  if (dom.controllerPalettePositionSelect) dom.controllerPalettePositionSelect.value = controllerBrushSettings.palettePosition;
  if (dom.controllerCursorPaletteSizeSelect) dom.controllerCursorPaletteSizeSelect.value = controllerBrushSettings.cursorPaletteSize;
  if (dom.controllerBottomRightPaletteSizeSelect) dom.controllerBottomRightPaletteSizeSelect.value = controllerBrushSettings.bottomRightPaletteSize;
  applyControllerPalettePresentation();
}

function syncPreferencesUi() {
  if (dom.autoSaveToggle) dom.autoSaveToggle.checked = autoSaveEnabled;
  if (dom.floatingControlsToggle) dom.floatingControlsToggle.checked = floatingControlsEnabled;
  if (dom.finalTerrainToggle) dom.finalTerrainToggle.checked = finalTerrainEnabled;
  syncControllerBrushSettingsUi();
  if (dom.floatingViewControls) dom.floatingViewControls.hidden = !floatingControlsEnabled && editorInputMode !== 'gamepad';
  document.body.classList.toggle('pan-mode', panMode);
  document.body.dataset.editorInput = editorInputMode;
  if (dom.panToggleButton) dom.panToggleButton.setAttribute('aria-pressed', panMode ? 'true' : 'false');
  syncTabHints();
  syncViewportHints();
}

function setEditorInputMode(mode) {
  if (editorInputMode === mode) return;
  editorInputMode = mode;
  syncPreferencesUi();
  if (mode === 'gamepad') wakePackWheel();
}

function syncViewportHints() {
  renderInputHints({ inputScheme: editorInputMode === 'gamepad' ? 'gamepad' : 'wasd' }, document, {
    runtime: inputRuntime,
    settings: inputRuntime.settings,
    profile: gameInputProfile
  });
}

function setActiveTab(tabId, { show = true, focus = false } = {}) {
  if (show && controllerBrushPickerOpen) closeControllerBrushPicker({ status: false, syncBack: false });
  activeTab = tabId;
  overlayHidden = !show;
  if (dom.overlay) {
    dom.overlay.hidden = overlayHidden;
    dom.overlay.dataset.collapsed = overlayHidden ? 'true' : 'false';
  }
  if (dom.hideOverlayButton) {
    if (dom.overlayToggleLabel) dom.overlayToggleLabel.textContent = 'Hide';
    dom.hideOverlayButton.setAttribute('aria-expanded', overlayHidden ? 'false' : 'true');
    dom.hideOverlayButton.setAttribute('aria-label', overlayHidden ? 'Show editor panel' : 'Hide editor panel');
    if (dom.overlayToggleHint) dom.overlayToggleHint.hidden = overlayHidden;
  }
  document.body.dataset.editorPanel = overlayHidden ? 'closed' : 'open';
  if (dom.controllerPanelHint) dom.controllerPanelHint.hidden = !overlayHidden;
  for (const tab of dom.tabs) {
    const selected = tab.dataset.editorTab === activeTab;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) focusEditorControl(tab);
  }
  for (const panel of dom.panels) panel.hidden = overlayHidden || panel.id !== `${activeTab}Panel`;
  syncTabHints({ inputScheme: editorInputMode === 'gamepad' ? 'gamepad' : 'wasd' });
  if (!show) clearEditorControllerFocus();
  nativeBack?.sync?.();
}

function toggleTab(tabId) {
  if (tabId === activeTab) setActiveTab(tabId, { show: overlayHidden });
  else setActiveTab(tabId, { show: true });
}

function adjacentTabId(direction) {
  const index = dom.tabs.findIndex(tab => tab.dataset.editorTab === activeTab);
  const nextIndex = ((index < 0 ? 0 : index) + direction + dom.tabs.length) % dom.tabs.length;
  return dom.tabs[nextIndex]?.dataset.editorTab || activeTab;
}

function moveActiveTab(direction, { focus = false } = {}) {
  setActiveTab(adjacentTabId(direction), { show: true, focus });
}

function clearEditorControllerFocus() {
  document.querySelectorAll('.controller-focus').forEach(node => node.classList.remove('controller-focus'));
}

function focusEditorControl(element) {
  if (!element) return;
  clearEditorControllerFocus();
  element.focus({ preventScroll: true });
  element.classList.add('controller-focus');
  const checkRow = element.closest?.('.check');
  if (checkRow?.contains(element)) checkRow.classList.add('controller-focus');
  editorPanelLastFocused = element;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (document.activeElement === element) element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }));
}

function activeEditorPanel() {
  if (overlayHidden) return null;
  return dom.panels.find(panel => panel.id === `${activeTab}Panel` && !panel.hidden) || null;
}

function ensureEditorPanelFocus() {
  const panel = activeEditorPanel();
  return ensureMenuFocus(panel, editorPanelLastFocused, focusEditorControl);
}

function focusCenter(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect };
}

function spatialDistance(from, to, axis) {
  const primary = axis === 'x' ? Math.abs(to.x - from.x) : Math.abs(to.y - from.y);
  const secondary = axis === 'x' ? Math.abs(to.y - from.y) : Math.abs(to.x - from.x);
  return secondary * 4 + primary;
}

function moveSpatialEditorFocus(axis, direction) {
  const panel = activeEditorPanel();
  if (!panel) return false;
  if (ensureEditorPanelFocus()) return true;
  const items = visibleFocusables(panel);
  const current = currentFocusElement(panel, editorPanelLastFocused);
  if (!items.length || !current || !items.includes(current)) return false;
  const from = focusCenter(current);
  const candidates = items
    .filter(item => item !== current)
    .map(item => ({ item, center: focusCenter(item) }))
    .filter(({ center }) => axis === 'x'
      ? direction < 0 ? center.x < from.x - 2 : center.x > from.x + 2
      : direction < 0 ? center.y < from.y - 2 : center.y > from.y + 2)
    .sort((a, b) => spatialDistance(from, a.center, axis) - spatialDistance(from, b.center, axis));
  if (!candidates.length) return false;
  focusEditorControl(candidates[0].item);
  return true;
}

function moveHorizontalEditorGroupFocus(direction) {
  return moveSpatialEditorFocus('x', direction);
}

function moveEditorPanelFocus(direction) {
  const panel = activeEditorPanel();
  if (!panel) return false;
  if (moveSpatialEditorFocus('y', direction)) return true;
  return moveLinearFocus(panel, editorPanelLastFocused, direction, focusEditorControl);
}

function moveEditorPanelFocusForKey(event) {
  const keyDirections = {
    ArrowLeft: ['x', -1],
    KeyA: ['x', -1],
    ArrowRight: ['x', 1],
    KeyD: ['x', 1],
    ArrowUp: ['y', -1],
    KeyW: ['y', -1],
    ArrowDown: ['y', 1],
    KeyS: ['y', 1]
  };
  const direction = keyDirections[event.code] || keyDirections[event.key];
  if (!direction) return false;
  const editableText = ['TEXTAREA'].includes(event.target?.tagName) || (event.target?.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'number'].includes(event.target.type));
  if (editableText && !event.key.startsWith('Arrow')) return false;
  const moved = direction[0] === 'x' ? moveSpatialEditorFocus('x', direction[1]) : moveEditorPanelFocus(direction[1]);
  if (moved) event.preventDefault();
  return moved;
}

function isControllerPassiveInput(element) {
  if (!element) return false;
  if (element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') return true;
  if (element.tagName !== 'INPUT') return false;
  return !['button', 'checkbox', 'radio', 'submit', 'reset'].includes(element.type);
}

function focusedEditorSelect() {
  const panel = activeEditorPanel();
  const current = currentFocusElement(panel, editorPanelLastFocused);
  return panel && current?.tagName === 'SELECT' && panel.contains(current) ? current : null;
}

function clearControllerSelectBrowse({ restore = false, commit = false } = {}) {
  const state = controllerSelectBrowse;
  if (!state) return;
  controllerSelectBrowse = null;
  const { element } = state;
  element?.removeAttribute?.('data-controller-select-open');
  if (element) element.size = state.originalSize;
  if (restore && element?.isConnected) element.value = state.originalValue;
  if (commit && element?.isConnected && element.value !== state.originalValue) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function beginControllerSelectBrowse(select) {
  clearControllerSelectBrowse();
  const enabledCount = Array.from(select.options).filter(option => !option.disabled).length;
  controllerSelectBrowse = { element: select, originalValue: select.value, originalSize: select.size || 0 };
  select.setAttribute('data-controller-select-open', 'true');
  select.size = Math.max(2, Math.min(8, enabledCount || select.options.length || 2));
  select.focus({ preventScroll: true });
  select.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const label = select.closest('label')?.querySelector('span')?.textContent || 'select';
  setStatus(`Opened ${label}. D-pad or stick highlights an option; A selects; B cancels.`, '');
}

function stepSelectOption(select, direction) {
  const enabledOptions = Array.from(select.options).filter(option => !option.disabled);
  if (enabledOptions.length < 2) return false;
  const currentOption = select.selectedOptions?.[0] || select.options[select.selectedIndex];
  const currentIndex = Math.max(0, enabledOptions.indexOf(currentOption));
  const nextOption = enabledOptions[(currentIndex + direction + enabledOptions.length) % enabledOptions.length];
  if (!nextOption || nextOption.value === select.value) return false;
  select.value = nextOption.value;
  return true;
}

function controllerSelectStepDirection(route, actionId) {
  const pressedValue = route.pressedValue(actionId);
  if (!pressedValue) return 0;
  return navDirection(pressedValue) || (pressedValue < 0 ? -1 : 1);
}

function stepOpenSelectWithController(route) {
  const current = focusedEditorSelect();
  if (!current || controllerSelectBrowse?.element !== current) return false;
  const verticalDirection = controllerSelectStepDirection(route, 'menu.navigateY');
  const horizontalDirection = verticalDirection ? 0 : controllerSelectStepDirection(route, 'menu.navigateX');
  const direction = verticalDirection || horizontalDirection;
  if (!direction) return false;
  const action = verticalDirection ? 'menu.navigateY' : 'menu.navigateX';

  stepSelectOption(current, direction);
  route.consume(action);
  return true;
}

function handleFocusedSelectController(route) {
  const current = focusedEditorSelect();
  if (!current) { clearControllerSelectBrowse(); return false; }
  if (controllerSelectBrowse && controllerSelectBrowse.element !== current) clearControllerSelectBrowse();

  if (route.wasPressed('menu.accept')) {
    route.consume('menu.accept');
    if (controllerSelectBrowse?.element === current) {
      clearControllerSelectBrowse({ commit: true });
      setStatus('Selection confirmed.', 'ok');
    } else beginControllerSelectBrowse(current);
    return true;
  }

  if (controllerSelectBrowse?.element === current) {
    if (route.wasPressed('menu.back')) {
      route.consume('menu.back');
      clearControllerSelectBrowse({ restore: true });
      setStatus('Selection cancelled.', '');
      return true;
    }
    stepOpenSelectWithController(route);
    return true;
  }

  return false;
}

function activateFocusedEditorControl() {
  const panel = activeEditorPanel();
  if (!panel) return false;
  if (ensureEditorPanelFocus()) return true;
  const current = currentFocusElement(panel, editorPanelLastFocused);
  if (!current || !panel.contains(current)) return false;
  if (isControllerPassiveInput(current)) return true;
  current.click?.();
  return true;
}

function syncTabHints({ consoleActive, inputScheme = 'wasd' } = {}) {
  renderTabInputHints({ inputScheme }, document, {
    profile: gameInputProfile,
    settings: inputRuntime.settings,
    runtime: inputRuntime,
    consoleActive: overlayHidden ? false : consoleActive
  });
}

function navigateMainMenu() {
  if (!autoSaveEnabled && dirty && !confirm('You have unsaved local changes. Leave without saving?')) return;
  if (autoSaveEnabled) flushPending();
  window.location.assign('/index.html');
}

function flushPending() {
  if (!autoSaveEnabled) { updateSaveButton(); return; }
  scheduler.flush(() => {
    ensureCompiled();
    persist();
    dirty = false;
    syncInputs();
    render();
    setStatus(`Valid ${draft.cols}×${draft.rows} tilemap.`, 'ok');
    updateSaveButton();
  });
}

function scheduleAfterEdit() {
  compiledFresh = false;
  markDirty();
  if (!autoSaveEnabled) {
    try { ensureCompiled(); syncInputs(); render(); }
    catch (error) { setStatus(error.message, 'error'); }
    updateSaveButton();
    return;
  }
  scheduler.scheduleDebounced(() => {
    try {
      saving = true;
      updateSaveButton();
      ensureCompiled();
      persist();
      dirty = false;
      syncInputs();
      render();
      setStatus(`Valid ${draft.cols}×${draft.rows} tilemap.`, 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      saving = false;
      updateSaveButton();
    }
  });
}

function scheduleRender() { scheduler.scheduleFrame(render); }

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportMap() {
  scheduler.flush(() => { syncDraftMetadataFromInputs(); compiledFresh = false; ensureCompiled(); syncInputs(); render(); });
  downloadText(`${draft.id || 'local-draft'}.chibi-map.json`, JSON.stringify(sharePayload(), null, 2), 'application/json');
  setStatus('Exported shareable map file.', 'ok');
}

async function importMapFile(file) {
  if (!file) return;
  try {
    history.clear();
    draft = draftFromSharePayload(JSON.parse(await file.text()));
    compiledFresh = false;
    ensureCompiled();
    persist({ syncMetadata: false });
    dirty = false;
    syncInputs();
    dom.tilemapSelect.value = getDefaultTilemap().id;
    resetView(viewport, worldWidth(), worldHeight());
    saveView();
    syncInputs();
    render();
    setStatus(`Imported ${draft.name} and saved locally. Ready to preview.`, 'ok');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    dom.importMapInput.value = '';
  }
}

function previewDraft() {
  try {
    scheduler.flush(() => { syncDraftMetadataFromInputs(); compiledFresh = false; ensureCompiled(); syncInputs(); render(); });
    if (!hasEntitySymbol(draft, 'P')) {
      setStatus('Add a Player P before previewing.', 'error');
      return;
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const payload = createPreviewPayload(draft, { id });
    localStorage.setItem(payload.storageKey, JSON.stringify(payload.payload));
    const preview = window.open(payload.url, 'chibiTilemapPreview');
    if (!preview) {
      localStorage.removeItem(payload.storageKey);
      setStatus('Preview popup blocked. Allow popups for this site and try again.', 'error');
      return;
    }
    const warning = hasEntitySymbol(draft, 'G') ? '' : ' No finish gate in draft.';
    setStatus(`Opened playable preview.${warning}`, hasEntitySymbol(draft, 'G') ? 'ok' : '');
  } catch (error) { setStatus(error.message, 'error'); }
}

function drawContainedTerrainTile(ctx, tile) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(tile.x, tile.y, tile.w, tile.h);
  ctx.clip();
  for (const primitive of planContainedTerrainTileVisuals(tile)) {
    ctx.fillStyle = primitive.color;
    ctx.fillRect(primitive.x, primitive.y, primitive.w, primitive.h);
  }
  ctx.restore();
}

function intersects(rect, x, y, w, h) { return x < rect.x + rect.w && x + w > rect.x && y < rect.y + rect.h && y + h > rect.y; }

function drawCompiledTerrain(ctx, rect) {
  if (!compiledFresh || !compiled?.renderLayers?.containedTerrainTiles) return false;
  for (const tile of compiled.renderLayers.containedTerrainTiles) if (intersects(rect, tile.x, tile.y, tile.w, tile.h)) drawContainedTerrainTile(ctx, tile);
  return true;
}

function visibleCellRange(layer, rect) {
  const maxRow = layer.rows.length - 1;
  const maxCol = layer.rows[0].length - 1;
  return {
    startCol: Math.max(0, Math.floor(rect.x / layer.cellSize) - 1),
    endCol: Math.min(maxCol, Math.ceil((rect.x + rect.w) / layer.cellSize) + 1),
    startRow: Math.max(0, Math.floor(rect.y / layer.cellSize) - 1),
    endRow: Math.min(maxRow, Math.ceil((rect.y + rect.h) / layer.cellSize) + 1)
  };
}

function drawDraftTerrain(ctx, rect) {
  const layer = terrainLayer();
  if (!layer) return;
  const range = visibleCellRange(layer, rect);
  const colors = { grass: '#a7643b', dirt: '#8f5634', stone: '#66717d', sand: '#d9b86f', log: '#7a4a2a', leaves: '#3f8f4c' };
  ctx.fillStyle = '#40504a';
  for (let row = range.startRow; row <= range.endRow; row++) {
    const line = layer.rows[row];
    for (let col = range.startCol; col <= range.endCol; col++) {
      const kind = line[col];
      if (kind === null) continue;
      const config = terrainKindConfig(kind);
      const invisible = kind === 'invisible-solid' || config?.visible === false;
      ctx.fillStyle = invisible ? 'rgba(167,139,250,.38)' : config?.visual?.baseColor ?? colors[kind] ?? '#40504a';
      ctx.fillRect(col * layer.cellSize, row * layer.cellSize, layer.cellSize, layer.cellSize);
      if (invisible) {
        ctx.strokeStyle = 'rgba(216,204,255,.72)';
        ctx.lineWidth = 1 / viewport.camera.zoom;
        ctx.strokeRect(col * layer.cellSize + 2, row * layer.cellSize + 2, layer.cellSize - 4, layer.cellSize - 4);
      }
    }
  }
}

function drawGrid(ctx, rect) {
  ctx.save();
  ctx.lineWidth = 1 / viewport.camera.zoom;
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  const drawLines = (step) => {
    const startX = Math.max(0, Math.floor(rect.x / step) * step);
    const endX = Math.min(worldWidth(), rect.x + rect.w);
    const startY = Math.max(0, Math.floor(rect.y / step) * step);
    const endY = Math.min(worldHeight(), rect.y + rect.h);
    if (startX > endX || startY > endY) return;
    for (let x = startX; x <= endX; x += step) line(ctx, x, startY, x, endY);
    for (let y = startY; y <= endY; y += step) line(ctx, startX, y, endX, y);
  };
  drawLines(CELL_SIZE.BUILD);
  ctx.strokeStyle = 'rgba(121,240,197,.22)';
  drawLines(CELL_SIZE.GRID);
  ctx.restore();
}
function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

function drawEntities(ctx, rect) {
  const layer = entityLayer();
  if (!layer) return;
  const range = visibleCellRange(layer, rect);
  const rowPad = Math.ceil(((layer.objectSize ?? CELL_SIZE.GRID) - layer.cellSize) / layer.cellSize);
  range.startRow = Math.max(0, range.startRow - rowPad);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 18px "Geist Sans", ui-sans-serif, system-ui, sans-serif';
  for (let row = range.startRow; row <= range.endRow; row++) {
    const line = layer.rows[row];
    for (let col = range.startCol; col <= range.endCol; col++) {
      const ch = line[col];
      if (ch === EMPTY) continue;
      const objectSize = layer.objectSize ?? CELL_SIZE.GRID;
      const px = col * layer.cellSize;
      const py = (row + 1) * layer.cellSize - objectSize;
      ctx.fillStyle = ch === 'P' ? '#78a8ff' : ch === 'E' ? '#ff7bd5' : '#ffd36a';
      ctx.globalAlpha = .88;
      ctx.fillRect(px + 4, py + 4, objectSize - 8, objectSize - 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#071018';
      ctx.fillText(ch, px + objectSize / 2, py + objectSize / 2 + 1);
    }
  }
  ctx.restore();
}

function drawSpikeFieldPath(ctx, rect, toothWidth, offset = 0, direction = 'up') {
  const commands = spikeFieldCommands(rect, toothWidth, offset, direction);
  ctx.beginPath();
  for (const command of commands) {
    if (command.op === 'moveTo') ctx.moveTo(command.x, command.y);
    else if (command.op === 'lineTo') ctx.lineTo(command.x, command.y);
    else if (command.op === 'closePath') ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
}

function drawHazards(ctx, rect) {
  const layer = hazardLayer();
  if (!layer) return;
  const range = visibleCellRange(layer, rect);
  ctx.save();
  ctx.globalAlpha = activeEditLayerId === 'hazards' ? .95 : .62;
  ctx.fillStyle = '#ff4d7d';
  ctx.strokeStyle = 'rgba(28, 4, 16, .86)';
  ctx.lineWidth = 1.5 / viewport.camera.zoom;
  const consumed = new Set();
  const key = (col, row) => `${col},${row}`;
  for (let row = range.startRow; row <= range.endRow; row++) {
    const line = layer.rows[row];
    let runStart = null;
    for (let col = range.startCol; col <= range.endCol + 1; col++) {
      const filled = col <= range.endCol && line[col] !== EMPTY && line[col] !== null;
      if (filled && runStart === null) runStart = col;
      if ((!filled || col === range.endCol + 1) && runStart !== null) {
        const runEnd = col;
        if (runEnd - runStart > 1) {
          const x = runStart * layer.cellSize;
          const y = row * layer.cellSize;
          drawSpikeFieldPath(ctx, { x, y, w: (runEnd - runStart) * layer.cellSize, h: layer.cellSize }, layer.cellSize, runStart, 'up');
          for (let usedCol = runStart; usedCol < runEnd; usedCol++) consumed.add(key(usedCol, row));
        }
        runStart = null;
      }
    }
  }

  for (let col = range.startCol; col <= range.endCol; col++) {
    let runStart = null;
    for (let row = range.startRow; row <= range.endRow + 1; row++) {
      const line = layer.rows[row];
      const filled = row <= range.endRow && line?.[col] !== EMPTY && line?.[col] !== null && !consumed.has(key(col, row));
      if (filled && runStart === null) runStart = row;
      if ((!filled || row === range.endRow + 1) && runStart !== null) {
        const runEnd = row;
        const x = col * layer.cellSize;
        const y = runStart * layer.cellSize;
        const direction = runEnd - runStart > 1 ? 'right' : 'up';
        drawSpikeFieldPath(ctx, { x, y, w: layer.cellSize, h: (runEnd - runStart) * layer.cellSize }, layer.cellSize, runStart, direction);
        runStart = null;
      }
    }
  }
  ctx.restore();
}

function drawCursor(ctx, cursor, { ghost = false } = {}) {
  const layer = draft.layers.find(layer => layer.id === brush.layerId);
  if (!layer || cursor.row < 0 || cursor.row >= layer.rows.length || cursor.col < 0 || cursor.col >= layer.rows[0].length) return;
  const debugCursor = { col: cursor.col, row: cursor.row, layerId: brush.layerId, brushId: brush.id };
  if (ghost) {
    debug.ghostCursorRenderCount = (debug.ghostCursorRenderCount ?? 0) + 1;
    debug.ghostCursor = debugCursor;
  } else {
    debug.cursorRenderCount = (debug.cursorRenderCount ?? 0) + 1;
    debug.cursor = debugCursor;
  }
  const x = cursor.col * brush.cellSize;
  const cursorSize = layer.objectSize ?? brush.cellSize;
  const y = (cursor.row + 1) * brush.cellSize - cursorSize;
  const inset = 1 / viewport.camera.zoom;
  const haloWidth = (ghost ? 4 : 6) / viewport.camera.zoom;
  const lineWidth = (ghost ? 2 : 3) / viewport.camera.zoom;
  const corner = Math.max(4, cursorSize * 0.32);
  ctx.save();
  ctx.fillStyle = ghost ? 'rgba(255, 255, 255, .08)' : 'rgba(8, 12, 22, .22)';
  ctx.fillRect(x + inset, y + inset, cursorSize - inset * 2, cursorSize - inset * 2);
  ctx.lineJoin = 'round';
  ctx.setLineDash(ghost ? [6 / viewport.camera.zoom, 5 / viewport.camera.zoom] : []);
  ctx.strokeStyle = ghost ? 'rgba(0, 0, 0, .55)' : 'rgba(0, 0, 0, .82)';
  ctx.lineWidth = haloWidth;
  ctx.strokeRect(x + inset, y + inset, cursorSize - inset * 2, cursorSize - inset * 2);
  ctx.strokeStyle = brush.cursor;
  ctx.globalAlpha = ghost ? .62 : 1;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x + inset, y + inset, cursorSize - inset * 2, cursorSize - inset * 2);
  ctx.setLineDash([]);
  ctx.globalAlpha = ghost ? .7 : 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, .95)';
  ctx.lineWidth = 1.5 / viewport.camera.zoom;
  const right = x + cursorSize - inset;
  const bottom = y + cursorSize - inset;
  const left = x + inset;
  const top = y + inset;
  line(ctx, left, top, left + corner, top);
  line(ctx, left, top, left, top + corner);
  line(ctx, right, top, right - corner, top);
  line(ctx, right, top, right, top + corner);
  line(ctx, left, bottom, left + corner, bottom);
  line(ctx, left, bottom, left, bottom - corner);
  line(ctx, right, bottom, right - corner, bottom);
  line(ctx, right, bottom, right, bottom - corner);
  ctx.restore();
}

function render() {
  debug.renderCount++;
  resizeViewport(viewport);
  clampCamera(viewport, worldWidth(), worldHeight());
  clearViewport(ctx, viewport);
  applyWorldTransform(ctx, viewport);
  const rect = visibleWorldRect(viewport);
  ctx.fillStyle = '#090d15';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const drewFinalTerrain = finalTerrainEnabled && drawCompiledTerrain(ctx, rect);
  dom.canvas.dataset.terrainRender = drewFinalTerrain ? 'final' : 'preview';
  if (!drewFinalTerrain) drawDraftTerrain(ctx, rect);
  drawHazards(ctx, rect);
  drawEntities(ctx, rect);
  if (dom.collisionToggle.checked && compiled) drawCollisionDebugOverlay(ctx, compiled, { showCollisionRects: true });
  if (dom.gridToggle.checked) drawGrid(ctx, rect);
  if (controllerCanvasMode === 'navigate' && overlayHidden && controllerGhostPointer) drawCursor(ctx, controllerGhostPointer, { ghost: true });
  if (pointer && controllerCanvasMode !== 'navigate') drawCursor(ctx, pointer);
  updateZoomReadout();
  if (controllerBrushPickerOpen) applyControllerPalettePresentation();
}

function updateZoomReadout() {
  const zoomPercent = Math.round(viewport.camera.zoom * 100);
  if (dom.zoomReadout) dom.zoomReadout.textContent = `${zoomPercent}%`;
  if (dom.wheelZoomReadout) dom.wheelZoomReadout.textContent = `${zoomPercent}%`;
  if (dom.wheelZoomFill) {
    const range = viewport.maxZoom - viewport.minZoom || 1;
    const zoomFill = Math.max(6, Math.min(100, ((viewport.camera.zoom - viewport.minZoom) / range) * 100));
    dom.wheelZoomFill.style.width = `${zoomFill}%`;
  }
  dom.canvas.dataset.zoom = viewport.camera.zoom.toFixed(3);
}

function activePackConfig() {
  return packsForLayer(activeEditLayerId).find(candidate => candidate.id === activePackId) ?? defaultPackForLayer(activeEditLayerId);
}

function wakePackWheel() {
  if (!dom.packWheelHud) return;
  dom.packWheelHud.classList.add('is-awake');
  clearTimeout(packWheelWakeTimer);
  packWheelWakeTimer = setTimeout(() => dom.packWheelHud?.classList.remove('is-awake'), 1300);
}

function controllerPaletteAnchorCell() {
  if (controllerCanvasMode === 'navigate') return clampBrushCell(controllerGhostPointer ?? controllerCenterCell());
  return clampBrushCell(pointer ?? controllerCenterCell());
}

function worldToViewportScreen(point) {
  return {
    x: (point.x - viewport.camera.x) * viewport.camera.zoom,
    y: (point.y - viewport.camera.y) * viewport.camera.zoom
  };
}

function applyControllerPalettePresentation() {
  if (!dom.packWheelHud) return;
  const hud = dom.packWheelHud;
  const position = controllerBrushPickerOpen ? controllerBrushSettings.palettePosition : 'bottom-right';
  const size = controllerBrushPickerOpen
    ? (position === 'near-cursor' ? controllerBrushSettings.cursorPaletteSize : controllerBrushSettings.bottomRightPaletteSize)
    : DEFAULT_CONTROLLER_BRUSH_SETTINGS.bottomRightPaletteSize;
  hud.dataset.palettePosition = position;
  hud.dataset.paletteSize = size;
  hud.style.left = '';
  hud.style.top = '';
  hud.style.right = '';
  hud.style.bottom = '';
  hud.style.transformOrigin = '';
  delete hud.dataset.anchorCell;
  if (!controllerBrushPickerOpen || position !== 'near-cursor') return;

  resizeViewport(viewport);
  const workspace = dom.canvas.parentElement;
  const workspaceRect = workspace.getBoundingClientRect();
  const canvasRect = dom.canvas.getBoundingClientRect();
  const cell = controllerPaletteAnchorCell();
  const world = { x: (cell.col + 0.5) * brush.cellSize, y: (cell.row + 0.5) * brush.cellSize };
  const screen = worldToViewportScreen(world);
  const anchorX = canvasRect.left - workspaceRect.left + screen.x;
  const anchorY = canvasRect.top - workspaceRect.top + screen.y;
  const width = hud.offsetWidth || 198;
  const height = hud.offsetHeight || 198;
  const padding = 12;
  const left = Math.max(padding, Math.min(workspaceRect.width - width - padding, anchorX - width / 2));
  const top = Math.max(padding, Math.min(workspaceRect.height - height - padding, anchorY - height / 2));
  hud.style.left = `${left}px`;
  hud.style.top = `${top}px`;
  hud.style.right = 'auto';
  hud.style.bottom = 'auto';
  hud.style.transformOrigin = 'center center';
  hud.dataset.anchorCell = `${cell.col},${cell.row}`;
}

function highlightedPickerBrush() {
  const items = brushesForActivePack();
  if (!items.length) return brush;
  const index = ((controllerBrushPickerHighlightedIndex % items.length) + items.length) % items.length;
  return items[index] ?? brush;
}

function updatePackWheel() {
  const layer = activeLayerConfig();
  const pack = activePackConfig();
  const displayBrush = controllerBrushPickerOpen ? highlightedPickerBrush() : brush;
  document.body.dataset.editorBrushPicker = controllerBrushPickerOpen ? 'open' : 'closed';
  if (dom.packWheelHud) {
    dom.packWheelHud.toggleAttribute('data-picker-open', controllerBrushPickerOpen);
    dom.packWheelHud.dataset.highlightedBrush = displayBrush.id;
    dom.packWheelHud.dataset.committedBrush = brush.id;
  }
  applyControllerPalettePresentation();
  debug.controllerBrushPicker = {
    open: controllerBrushPickerOpen,
    highlightedBrushId: displayBrush.id,
    committedBrushId: brush.id,
    highlightedIndex: controllerBrushPickerHighlightedIndex,
    palettePosition: dom.packWheelHud?.dataset.palettePosition,
    paletteSize: dom.packWheelHud?.dataset.paletteSize,
    paletteAnchorCell: dom.packWheelHud?.dataset.anchorCell || null
  };
  if (dom.wheelLayerLabel) dom.wheelLayerLabel.textContent = layer.label;
  if (dom.wheelBrushLabel) dom.wheelBrushLabel.textContent = displayBrush.label;
  if (dom.wheelPackLabel) dom.wheelPackLabel.textContent = pack?.label ?? layer.gridLabel;
  if (dom.wheelBrushSwatch) dom.wheelBrushSwatch.style.setProperty('--swatch', displayBrush.swatch ?? displayBrush.cursor);
  updateZoomReadout();
}

function buildPackWheelItems() {
  if (!dom.packWheelItems) return;
  const items = brushesForActivePack();
  if (!items.length) { dom.packWheelItems.innerHTML = ''; updatePackWheel(); return; }
  const brushIndex = Math.max(0, items.findIndex(candidate => candidate.id === brush.id));
  const activeIndex = controllerBrushPickerOpen ? ((controllerBrushPickerHighlightedIndex % items.length) + items.length) % items.length : brushIndex;
  const selectedAngle = -52;
  const step = 36;
  const visualSlots = items.length >= 9 ? items.length : 11;
  const beforeSlots = Math.floor((visualSlots - 1) / 2);
  const afterSlots = visualSlots - beforeSlots - 1;
  dom.packWheelItems.innerHTML = '';
  for (let slot = -beforeSlots; slot <= afterSlots; slot++) {
    const itemIndex = ((activeIndex + slot) % items.length + items.length) % items.length;
    const candidate = items[itemIndex];
    const visualItem = document.createElement('span');
    const duplicate = Math.abs(slot) >= items.length;
    visualItem.className = `pack-wheel-hud__item${slot === 0 ? ' is-active' : ''}${controllerBrushPickerOpen && candidate.id === brush.id ? ' is-committed' : ''}${duplicate ? ' is-duplicate' : ''}`;
    visualItem.style.setProperty('--angle', `${selectedAngle + slot * step}deg`);
    visualItem.style.setProperty('--swatch', candidate.swatch ?? candidate.cursor);
    visualItem.dataset.shortLabel = candidate.shortLabel ?? candidate.label;
    visualItem.title = duplicate ? `${candidate.label} (visual repeat)` : candidate.label;
    dom.packWheelItems.append(visualItem);
  }
  updatePackWheel();
}

function pointerCell(event) {
  const point = eventToWorld(viewport, event);
  return { col: Math.floor(point.x / brush.cellSize), row: Math.floor(point.y / brush.cellSize) };
}

function applyBrushToCell(cell) {
  pointer = cell;
  const key = `${brush.layerId}:${cell.col},${cell.row}:${brush.symbol ?? 'null'}`;
  if (key === lastPaintKey) return;
  lastPaintKey = key;
  const layer = draft.layers.find(layer => layer.id === brush.layerId);
  if (!layer || cell.row < 0 || cell.row >= layer.rows.length || cell.col < 0 || cell.col >= layer.rows[0].length) { scheduleRender(); return; }
  const before = layer.rows[cell.row][cell.col];
  if (before !== brush.symbol) {
    if (Array.isArray(layer.rows[cell.row])) layer.rows[cell.row][cell.col] = brush.symbol;
    else layer.rows[cell.row] = replaceChar(layer.rows[cell.row], cell.col, brush.symbol ?? EMPTY);
    history.recordCellChange({ layerId: brush.layerId, col: cell.col, row: cell.row, before, after: brush.symbol });
    updateHistoryControls();
    scheduleAfterEdit();
    setStatus('Editing…', '');
  }
  scheduleRender();
}

function cellsOnLine(from, to) {
  const cells = [];
  let x0 = from.col;
  let y0 = from.row;
  const x1 = to.col;
  const y1 = to.row;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    cells.push({ col: x0, row: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) { error += dy; x0 += sx; }
    if (e2 <= dx) { error += dx; y0 += sy; }
  }
  return cells;
}

function applyBrushLine(from, to) {
  for (const cell of cellsOnLine(from, to)) applyBrushToCell(cell);
}

function paint(event) {
  const cell = pointerCell(event);
  if (pointer) applyBrushLine(pointer, cell);
  else applyBrushToCell(cell);
}

function applyHistoryCellChange(change) {
  const layer = draft.layers.find(layer => layer.id === change.layerId);
  if (!layer || change.row < 0 || change.row >= layer.rows.length || change.col < 0 || change.col >= layer.rows[0].length) return;
  if (Array.isArray(layer.rows[change.row])) layer.rows[change.row][change.col] = change.value;
  else layer.rows[change.row] = replaceChar(layer.rows[change.row], change.col, change.value ?? EMPTY);
}

function applyHistoryAction(kind) {
  const action = kind === 'undo' ? history.undo(applyHistoryCellChange) : history.redo(applyHistoryCellChange);
  if (!action) return;
  compiledFresh = false;
  updateHistoryControls();
  scheduleAfterEdit();
  render();
  setStatus(`${kind === 'undo' ? 'Undid' : 'Redid'} ${action.label}.`, '');
}

function startPan(event) {
  const point = eventToScreenPoint(dom.canvas, event);
  panPointer = { id: event.pointerId, x: point.x, y: point.y };
  dom.canvas.setPointerCapture(event.pointerId);
}

function updatePan(event) {
  const point = eventToScreenPoint(dom.canvas, event);
  panByScreenDelta(viewport, point.x - panPointer.x, point.y - panPointer.y, worldWidth(), worldHeight());
  panPointer = { ...panPointer, x: point.x, y: point.y };
  saveView();
  scheduleRender();
}

function editorInputRoute() { return inputRuntime.route(['editor', 'menu']); }

function processEditorKeyboardEvent(event) {
  setEditorInputMode('keyboard');
  const primaryModifier = event.ctrlKey || event.metaKey || event.altKey;
  if (event.type === 'keydown' && !primaryModifier && moveEditorPanelFocusForKey(event)) return;
  inputAdapter.queueKeyboardEvent(event);
  inputAdapter.beginFrame({ controllerEnabled: false });
  const route = editorInputRoute();
  syncTabHints({ consoleActive: false });
  if (route.wasPressed('editor.mainMenu')) { event.preventDefault(); route.consume('editor.mainMenu'); navigateMainMenu(); inputRuntime.endFrame(); return; }
  if (route.wasPressed('editor.save')) { event.preventDefault(); route.consume('editor.save'); saveLocalExplicit(); inputRuntime.endFrame(); return; }
  if (route.wasPressed('editor.preview')) { event.preventDefault(); route.consume('editor.preview'); previewDraft(); inputRuntime.endFrame(); return; }
  if (route.wasPressed('editor.redo')) { event.preventDefault(); route.consume('editor.redo'); applyHistoryAction('redo'); inputRuntime.endFrame(); return; }
  if (route.wasPressed('editor.undo')) { event.preventDefault(); route.consume('editor.undo'); applyHistoryAction('undo'); inputRuntime.endFrame(); return; }
  if (event.type === 'keydown' && moveEditorPanelFocusForKey(event)) { inputRuntime.endFrame(); return; }
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) { inputRuntime.endFrame(); return; }
  inputRuntime.endFrame();
}

function navDirection(value) {
  if (value < -0.35) return -1;
  if (value > 0.35) return 1;
  return 0;
}

function hasActiveGamepadInput() {
  for (const key of inputRuntime.state.controls.keys()) if (key.startsWith('gamepad:')) return true;
  return false;
}

function processEditorControllerFrame() {
  inputAdapter.beginFrame({ controllerEnabled: true });
  if (inputRuntime.lastActiveSource?.()?.deviceType === 'gamepad' || hasActiveGamepadInput()) setEditorInputMode('gamepad');
  syncTabHints({ inputScheme: 'gamepad' });
  const route = editorInputRoute();

  if (route.wasPressed('editor.mainMenu')) { route.consume('editor.mainMenu'); navigateMainMenu(); inputRuntime.endFrame(); requestAnimationFrame(processEditorControllerFrame); return; }
  if (route.wasPressed('editor.preview')) { route.consume('editor.preview'); previewDraft(); }

  const xValue = route.value('menu.navigateX');
  const yValue = route.value('menu.navigateY');
  const xDirection = navDirection(xValue);
  const yDirection = navDirection(yValue);

  if (handleControllerBrushPickerInput(route, xDirection, yDirection)) {
    controllerNavX = xDirection;
    controllerNavY = yDirection;
    syncTabHints({ inputScheme: 'gamepad' });
    inputRuntime.endFrame();
    requestAnimationFrame(processEditorControllerFrame);
    return;
  }

  if (route.wasPressed('editor.togglePanel')) { route.consume('editor.togglePanel'); toggleEditorPanel(); }

  if (overlayHidden) {
    if (route.wasPressed('menu.back')) { route.consume('menu.back'); openControllerBrushPicker(); }
    else {
    if (route.wasPressed('editor.toggleMode')) { route.consume('editor.toggleMode'); toggleControllerCanvasMode(); }
    if (route.wasPressed('editor.zoomOut')) { route.consume('editor.zoomOut'); zoomBy(0.88); }
    if (route.wasPressed('editor.zoomIn')) { route.consume('editor.zoomIn'); zoomBy(1.14); }
    if (route.wasPressed('editor.resetView')) { route.consume('editor.resetView'); resetCurrentView(); }
    if (route.wasPressed('editor.previousBrush')) { route.consume('editor.previousBrush'); cycleBrush(-1); }
    if (route.wasPressed('editor.nextBrush')) { route.consume('editor.nextBrush'); cycleBrush(1); }

    if (controllerCanvasMode === 'navigate') {
      syncControllerGhostPointer({ renderIfChanged: true });
      if (xValue || yValue) {
        panByScreenDelta(viewport, -xValue * 12, -yValue * 12, worldWidth(), worldHeight());
        syncControllerGhostPointer({ renderIfChanged: true });
        saveView();
        scheduleRender();
        route.consume('menu.navigateX');
        route.consume('menu.navigateY');
      }
    } else {
      if (controllerGhostPointer) adoptControllerGhostPointer({ renderIfChanged: true });
      ensureControllerPointer({ renderIfChanged: true });
      const paintPressed = route.wasPressed('editor.paint');
      const paintReleased = route.wasReleased('editor.paint');
      const paintDown = route.isDown('editor.paint');
      if (paintPressed && !controllerPaintActive) {
        route.consume('editor.paint');
        controllerPaintActive = true;
        lastPaintKey = null;
        history.beginAction('controller paint stroke');
        applyBrushToCell(ensureControllerPointer());
      }
      if (paintReleased && controllerPaintActive) {
        route.consume('editor.paint');
        controllerPaintActive = false;
        lastPaintKey = null;
        history.commitAction();
        updateHistoryControls();
        flushPending();
      }
      const now = performance.now();
      const holdKey = `${xDirection},${yDirection}`;
      if (xDirection || yDirection) {
        if (holdKey !== controllerMoveHoldKey) {
          controllerMoveHoldKey = holdKey;
          controllerMoveHeldSince = now;
          controllerNextMoveAt = 0;
        }
      } else {
        controllerMoveHoldKey = '';
        controllerMoveHeldSince = 0;
        controllerNextMoveAt = 0;
      }
      const shouldMove = (xDirection || yDirection) && (xDirection !== controllerNavX || yDirection !== controllerNavY || now >= controllerNextMoveAt);
      if (shouldMove) {
        const from = ensureControllerPointer();
        moveControllerPointer(xDirection, yDirection);
        const to = ensureControllerPointer();
        if (paintDown) applyBrushLine(from, to);
        controllerNextMoveAt = now + controllerBrushRepeatMs() / controllerBrushMomentumMultiplier(now);
        route.consume('menu.navigateX');
        route.consume('menu.navigateY');
      }
    }
    }
  } else {
    if (route.wasPressed('editor.previousTab')) { route.consume('editor.previousTab'); moveActiveTab(-1); }
    if (route.wasPressed('editor.nextTab')) { route.consume('editor.nextTab'); moveActiveTab(1); }

    if (handleFocusedSelectController(route)) {
      controllerNavX = xDirection;
      controllerNavY = yDirection;
      syncTabHints({ inputScheme: 'gamepad' });
      inputRuntime.endFrame();
      requestAnimationFrame(processEditorControllerFrame);
      return;
    }

    if (xDirection && xDirection !== controllerNavX) {
      if (xDirection < 0 && moveHorizontalEditorGroupFocus(-1)) route.consume('menu.navigateX');
      else if (xDirection > 0 && moveHorizontalEditorGroupFocus(1)) route.consume('menu.navigateX');
    }

    if (yDirection && yDirection !== controllerNavY) {
      if (yDirection < 0) { route.consume('menu.navigateY'); moveEditorPanelFocus(-1); }
      if (yDirection > 0) { route.consume('menu.navigateY'); moveEditorPanelFocus(1); }
    }

    if (route.wasPressed('menu.accept')) { route.consume('menu.accept'); activateFocusedEditorControl(); }
    if (route.wasPressed('menu.back')) { route.consume('menu.back'); setActiveTab(activeTab, { show: false }); }
  }

  controllerNavX = xDirection;
  controllerNavY = yDirection;
  syncTabHints({ inputScheme: 'gamepad' });
  inputRuntime.endFrame();
  requestAnimationFrame(processEditorControllerFrame);
}

function isPanGesture(event) { return panMode || event.button === 1 || editorInputRoute().isDown('editor.panModifier'); }

function layerBoundsForBrush() {
  const layer = draft.layers.find(layer => layer.id === brush.layerId);
  return { cols: layer?.rows?.[0]?.length ?? 1, rows: layer?.rows?.length ?? 1 };
}

function clampBrushCell(cell) {
  const bounds = layerBoundsForBrush();
  return {
    col: Math.max(0, Math.min(bounds.cols - 1, cell.col)),
    row: Math.max(0, Math.min(bounds.rows - 1, cell.row))
  };
}

function sameCell(a, b) { return Boolean(a && b && a.col === b.col && a.row === b.row); }

function controllerCenterCell() {
  const rect = visibleWorldRect(viewport);
  return clampBrushCell({
    col: Math.floor((rect.x + rect.w / 2) / brush.cellSize),
    row: Math.floor((rect.y + rect.h / 2) / brush.cellSize)
  });
}

function syncControllerGhostPointer({ renderIfChanged = false } = {}) {
  const previous = controllerGhostPointer ? { ...controllerGhostPointer } : null;
  controllerGhostPointer = controllerCenterCell();
  if (renderIfChanged && !sameCell(previous, controllerGhostPointer)) scheduleRender();
  return controllerGhostPointer;
}

function adoptControllerGhostPointer({ renderIfChanged = false } = {}) {
  const previous = pointer ? { ...pointer } : null;
  pointer = clampBrushCell(controllerGhostPointer ?? controllerCenterCell());
  controllerGhostPointer = null;
  if (renderIfChanged && !sameCell(previous, pointer)) scheduleRender();
  return pointer;
}

function ensureControllerPointer({ renderIfChanged = false } = {}) {
  const previous = pointer ? { ...pointer } : null;
  if (pointer) {
    pointer = clampBrushCell(pointer);
  } else {
    const rect = visibleWorldRect(viewport);
    pointer = clampBrushCell({
      col: Math.floor((rect.x + rect.w / 2) / brush.cellSize),
      row: Math.floor((rect.y + rect.h / 2) / brush.cellSize)
    });
  }
  if (renderIfChanged && !sameCell(previous, pointer)) scheduleRender();
  return pointer;
}

function moveControllerPointer(dx, dy) {
  const current = ensureControllerPointer();
  pointer = clampBrushCell({ col: current.col + dx, row: current.row + dy });
  scheduleRender();
}

function setBrush(candidate) {
  const previous = brush;
  activeEditLayerId = candidate.layerId;
  const pack = packsForLayer(activeEditLayerId).find(candidatePack => candidatePack.brushIds.includes(candidate.id)) ?? defaultPackForLayer(activeEditLayerId);
  activePackId = pack?.id ?? activePackId;
  const anchor = controllerGhostPointer ?? pointer;
  const worldPoint = anchor ? { x: (anchor.col + 0.5) * previous.cellSize, y: (anchor.row + 0.5) * previous.cellSize } : null;
  brush = candidate;
  if (worldPoint) {
    const nextCell = clampBrushCell({ col: Math.floor(worldPoint.x / brush.cellSize), row: Math.floor(worldPoint.y / brush.cellSize) });
    if (controllerGhostPointer) controllerGhostPointer = nextCell;
    else pointer = nextCell;
  }
  buildLayerButtons();
  buildBrushButtons();
  wakePackWheel();
  render();
}

function brushesForActivePack() {
  const packBrushes = brushesForPack(activePackId).filter(candidate => candidate.layerId === activeEditLayerId);
  return packBrushes.length ? packBrushes : BRUSHES.filter(candidate => candidate.layerId === activeEditLayerId);
}

function activeLayerConfig() { return layerById(activeEditLayerId); }

function setActiveEditLayer(layerId) {
  const nextLayer = layerById(layerId);
  if (nextLayer.disabled) return;
  activeEditLayerId = nextLayer.id;
  activePackId = defaultPackForLayer(activeEditLayerId)?.id ?? null;
  const layerBrushes = brushesForActivePack();
  if (!layerBrushes.some(candidate => candidate.id === brush.id)) setBrush(layerBrushes[0]);
  else { buildLayerButtons(); buildBrushButtons(); }
  setStatus(`Layer: ${activeLayerConfig().label} · ${activeLayerConfig().gridLabel}.`, '');
}

function cycleBrush(direction) {
  const packBrushes = brushesForActivePack();
  const index = packBrushes.findIndex(candidate => candidate.id === brush.id);
  const nextIndex = ((index < 0 ? 0 : index) + direction + packBrushes.length) % packBrushes.length;
  setBrush(packBrushes[nextIndex]);
  setStatus(`Pack: ${brush.label}.`, '');
}

function resetControllerBrushPickerRepeat() {
  controllerPickerNavX = 0;
  controllerPickerNavY = 0;
  controllerPickerNextMoveAt = 0;
  controllerPickerMoveHoldKey = '';
}

function openControllerBrushPicker() {
  const items = brushesForActivePack();
  controllerBrushPickerHighlightedIndex = Math.max(0, items.findIndex(candidate => candidate.id === brush.id));
  controllerBrushPickerOpen = true;
  resetControllerBrushPickerRepeat();
  if (dom.packWheelHud) {
    dom.packWheelHud.classList.add('is-awake');
    clearTimeout(packWheelWakeTimer);
  }
  buildPackWheelItems();
  nativeBack?.sync?.();
  setStatus('Brush palette: D-pad or stick chooses, A selects, B cancels.', '');
}

function closeControllerBrushPicker({ status = true, syncBack = true } = {}) {
  if (!controllerBrushPickerOpen) return;
  controllerBrushPickerOpen = false;
  resetControllerBrushPickerRepeat();
  buildPackWheelItems();
  wakePackWheel();
  if (syncBack) nativeBack?.sync?.();
  if (status) setStatus('Brush palette cancelled.', '');
}

function commitControllerBrushPicker() {
  if (!controllerBrushPickerOpen) return;
  const candidate = highlightedPickerBrush();
  controllerBrushPickerOpen = false;
  resetControllerBrushPickerRepeat();
  if (candidate && candidate.id !== brush.id) setBrush(candidate);
  else buildPackWheelItems();
  wakePackWheel();
  nativeBack?.sync?.();
  setStatus(`Pack: ${brush.label}.`, '');
}

function moveControllerBrushPicker(direction) {
  const items = brushesForActivePack();
  if (!controllerBrushPickerOpen || !items.length) return;
  controllerBrushPickerHighlightedIndex = ((controllerBrushPickerHighlightedIndex + direction) % items.length + items.length) % items.length;
  buildPackWheelItems();
}

function pickerNavigationDirection(xDirection, yDirection) {
  if (xDirection) return xDirection;
  if (yDirection) return yDirection;
  return 0;
}

function handleControllerBrushPickerInput(route, xDirection, yDirection) {
  if (!controllerBrushPickerOpen) return false;
  if (route.wasPressed('editor.togglePanel')) {
    route.consume('editor.togglePanel');
    closeControllerBrushPicker({ status: false, syncBack: false });
    setActiveTab(activeTab, { show: true });
    setStatus('Pack panel shown. Press B or Y to return to canvas.', '');
    return true;
  }
  if (route.wasPressed('menu.back')) { route.consume('menu.back'); closeControllerBrushPicker(); return true; }
  if (route.wasPressed('menu.accept') || route.wasPressed('editor.paint')) {
    route.consume('menu.accept');
    route.consume('editor.paint');
    commitControllerBrushPicker();
    return true;
  }
  if (route.wasPressed('editor.previousBrush')) { route.consume('editor.previousBrush'); moveControllerBrushPicker(-1); return true; }
  if (route.wasPressed('editor.nextBrush')) { route.consume('editor.nextBrush'); moveControllerBrushPicker(1); return true; }

  const now = performance.now();
  const holdKey = `${xDirection},${yDirection}`;
  if (xDirection || yDirection) {
    if (holdKey !== controllerPickerMoveHoldKey) {
      controllerPickerMoveHoldKey = holdKey;
      controllerPickerNextMoveAt = 0;
    }
  } else resetControllerBrushPickerRepeat();
  const shouldMove = (xDirection || yDirection) && (xDirection !== controllerPickerNavX || yDirection !== controllerPickerNavY || now >= controllerPickerNextMoveAt);
  if (shouldMove) {
    moveControllerBrushPicker(pickerNavigationDirection(xDirection, yDirection));
    controllerPickerNextMoveAt = now + controllerBrushRepeatMs();
    route.consume('menu.navigateX');
    route.consume('menu.navigateY');
  }
  controllerPickerNavX = xDirection;
  controllerPickerNavY = yDirection;
  return true;
}

function toggleControllerCanvasMode() {
  const nextMode = controllerCanvasMode === 'draw' ? 'navigate' : 'draw';
  controllerCanvasMode = nextMode;
  if (nextMode === 'navigate') syncControllerGhostPointer({ renderIfChanged: true });
  else adoptControllerGhostPointer({ renderIfChanged: true });
  document.body.dataset.editorControllerMode = controllerCanvasMode;
  setStatus(controllerCanvasMode === 'draw' ? 'Controller draw mode: cursor moved to ghost target. Left stick moves cursor, A paints, LB/RB changes pack item.' : 'Controller navigate mode: left stick pans the map under the ghost target. Press X for draw mode.', '');
}

function toggleEditorPanel() {
  if (controllerBrushPickerOpen) {
    closeControllerBrushPicker({ status: false, syncBack: false });
    setActiveTab(activeTab, { show: true });
    setStatus('Pack panel shown. Press B or Y to return to canvas.', '');
    return;
  }
  setActiveTab(activeTab, { show: overlayHidden });
  if (overlayHidden) {
    if (controllerCanvasMode === 'draw') ensureControllerPointer({ renderIfChanged: true });
    else syncControllerGhostPointer({ renderIfChanged: true });
    setStatus('Pack panel hidden. Press Y to show it.', '');
  } else setStatus('Pack panel shown. Press B or Y to return to canvas.', '');
}

function buildLayerButtons() {
  for (const button of dom.editLayerButtons) {
    const layer = layerById(button.dataset.editLayer);
    const selected = layer.id === activeEditLayerId;
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    button.disabled = Boolean(layer.disabled);
    button.setAttribute('aria-disabled', layer.disabled ? 'true' : 'false');
    button.querySelector('span').textContent = layer.label;
    button.querySelector('small').textContent = `${layer.description} · ${layer.gridLabel}`;
  }
}

function buildBrushButtons() {
  const layer = activeLayerConfig();
  const pack = packsForLayer(activeEditLayerId).find(candidate => candidate.id === activePackId) ?? defaultPackForLayer(activeEditLayerId);
  if (dom.packSectionTitle) dom.packSectionTitle.textContent = layer.packTitle;
  if (dom.packSummary) dom.packSummary.textContent = pack ? `${pack.label}: ${pack.description}. ${layer.gridLabel}.` : layer.gridLabel;
  if (dom.brushSectionTitle) dom.brushSectionTitle.textContent = `Selected: ${brush.label}`;
  if (dom.brushLayerHint) dom.brushLayerHint.textContent = layer.hint;
  dom.brushes.innerHTML = '';
  for (const candidate of brushesForActivePack()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = candidate.id === brush.id ? 'active pack-chip' : 'pack-chip';
    button.setAttribute('aria-pressed', candidate.id === brush.id ? 'true' : 'false');
    button.setAttribute('aria-label', candidate.label);
    button.innerHTML = `<span class="pack-chip__swatch" aria-hidden="true"></span><span class="pack-chip__label"></span>`;
    button.querySelector('.pack-chip__swatch').style.setProperty('--swatch', candidate.swatch ?? candidate.cursor);
    button.querySelector('.pack-chip__label').textContent = candidate.shortLabel ?? candidate.label;
    button.addEventListener('click', () => { setBrush(candidate); });
    dom.brushes.append(button);
  }
  buildPackWheelItems();
}

function loadSelected(resetSaved = false) {
  if (editorSource === 'local' && resetSaved && loadedLocalDraftId) {
    const read = readLocalDraft(localStorage, loadedLocalDraftId);
    if (read.ok) {
      history.clear();
      draft = normalizeDraft(read.draft);
      compiledFresh = false;
      ensureCompiled();
      loadViewOrReset();
      dirty = false;
      syncInputs();
      render();
      setStatus(`Reloaded local draft ${draft.name}.`, 'ok');
      return;
    }
  }
  editorSource = 'registered';
  loadedLocalDraftId = null;
  const tilemap = registeredTilemaps.find(tilemap => tilemap.id === dom.tilemapSelect.value) ?? getDefaultTilemap();
  if (resetSaved) localStorage.removeItem(storageKey(tilemap.id));
  history.clear();
  draft = createDraftFromTilemap(tilemap);
  compiledFresh = false;
  ensureCompiled();
  loadViewOrReset();
  dirty = false;
  syncInputs();
  render();
  setStatus(`Valid ${draft.cols}×${draft.rows} tilemap.`, 'ok');
}

function zoomBy(factor, screenPoint = { x: viewport.width / 2, y: viewport.height / 2 }) {
  zoomAtScreenPoint(viewport, screenPoint.x, screenPoint.y, viewport.camera.zoom * factor, worldWidth(), worldHeight());
  saveView();
  wakePackWheel();
  render();
}

function resetCurrentView() {
  resetView(viewport, worldWidth(), worldHeight());
  saveView();
  wakePackWheel();
  render();
}

function setupTouchPinch() {
  if (activePointers.size !== 2) { pinch = null; return; }
  const points = [...activePointers.values()];
  const dx = points[1].x - points[0].x;
  const dy = points[1].y - points[0].y;
  const distance = Math.hypot(dx, dy) || 1;
  const center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  pinch = { distance, center, zoom: viewport.camera.zoom, world: screenToWorld(viewport, center.x, center.y) };
}

function updateTouchPinch() {
  if (activePointers.size !== 2 || !pinch) return;
  const points = [...activePointers.values()];
  const dx = points[1].x - points[0].x;
  const dy = points[1].y - points[0].y;
  const distance = Math.hypot(dx, dy) || 1;
  const center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  viewport.camera.zoom = Math.max(viewport.minZoom, Math.min(viewport.maxZoom, pinch.zoom * distance / pinch.distance));
  viewport.camera.x = pinch.world.x - center.x / viewport.camera.zoom;
  viewport.camera.y = pinch.world.y - center.y / viewport.camera.zoom;
  clampCamera(viewport, worldWidth(), worldHeight());
  saveView();
  scheduleRender();
}

function setStringCell(rows, x, y, symbol) {
  if (!rows[y] || x < 0 || x >= rows[y].length) return;
  rows[y] = replaceChar(rows[y], x, symbol);
}

function paintTerrainBlock(rows, x, y, w, h, kind) {
  for (let row = y; row < y + h; row += 1) {
    if (!rows[row]) continue;
    for (let col = x; col < x + w && col < rows[row].length; col += 1) rows[row][col] = kind;
  }
}

function createCaptureShowcaseDraft() {
  const showcase = createBlankDraft({ id: 'capture-showcase-draft', name: 'Capture Showcase Draft', cols: 30, rows: 16 });
  showcase.description = 'Generated capture-only editor showcase. Not persisted as a Local Draft.';
  const terrain = showcase.layers.find(layer => layer.id === 'terrain');
  const entities = showcase.layers.find(layer => layer.id === 'entities');
  const hazards = showcase.layers.find(layer => layer.id === 'hazards');

  paintTerrainBlock(terrain.rows, 0, 26, 60, 6, K.DIRT);
  paintTerrainBlock(terrain.rows, 0, 24, 14, 2, K.GRASS);
  paintTerrainBlock(terrain.rows, 20, 22, 10, 2, K.GRASS);
  paintTerrainBlock(terrain.rows, 38, 18, 8, 2, K.STONE);
  paintTerrainBlock(terrain.rows, 50, 14, 8, 2, K.GRASS);
  paintTerrainBlock(terrain.rows, 7, 16, 6, 2, K.LOG);
  paintTerrainBlock(terrain.rows, 8, 13, 4, 3, K.LEAVES);
  paintTerrainBlock(terrain.rows, 31, 10, 5, 2, K.SAND);
  paintTerrainBlock(terrain.rows, 54, 10, 3, 4, K.INVISIBLE);

  setStringCell(entities.rows, 5, 23, 'P');
  setStringCell(entities.rows, 23, 21, 'E');
  setStringCell(entities.rows, 53, 13, 'G');
  setStringCell(entities.rows, 54, 13, 'G');
  setStringCell(entities.rows, 55, 13, 'G');
  setStringCell(hazards.rows, 17, 25, '^');
  setStringCell(hazards.rows, 18, 25, '^');
  setStringCell(hazards.rows, 40, 17, '^');
  return showcase;
}

function markCaptureReady() {
  if (CAPTURE_TARGET !== 'map-editor') return;
  document.documentElement.dataset.captureReady = 'map-editor';
  document.body.dataset.captureReady = 'map-editor';
}

function loadInitialDraftFromUrl() {
  if (CAPTURE_TARGET === 'map-editor') {
    editorSource = 'capture';
    loadedLocalDraftId = null;
    autoSaveEnabled = false;
    draft = createCaptureShowcaseDraft();
    compiledFresh = false;
    return;
  }
  const draftId = new URLSearchParams(location.search).get('draft');
  if (!draftId) return;
  const read = readLocalDraft(localStorage, draftId);
  if (!read.ok) { setStatus(read.message || 'Local draft not found.', 'error'); return; }
  editorSource = 'local';
  loadedLocalDraftId = draftId;
  draft = normalizeDraft(read.draft);
  compiledFresh = false;
}

function setup() {
  loadInitialDraftFromUrl();
  for (const tilemap of registeredTilemaps) {
    const option = document.createElement('option');
    option.value = tilemap.id;
    option.textContent = `${tilemap.name} (${tilemap.id})`;
    dom.tilemapSelect.append(option);
  }
  dom.tilemapSelect.value = registeredTilemaps.some(tilemap => tilemap.id === draft.id) ? draft.id : getDefaultTilemap().id;
  buildLayerButtons();
  buildBrushButtons();
  resizeViewport(viewport);
  compileDraft();
  loadViewOrReset();
  syncInputs();
  syncPreferencesUi();
  document.body.dataset.editorControllerMode = controllerCanvasMode;
  nativeBack = createNativeBackAdapter({
    canGoBack: () => controllerBrushPickerOpen || !overlayHidden,
    onBack: () => {
      if (controllerBrushPickerOpen) closeControllerBrushPicker({ status: false });
      else setActiveTab(activeTab, { show: false });
    }
  });
  setActiveTab('edit', { show: true });

  new ResizeObserver(() => { resizeViewport(viewport); clampCamera(viewport, worldWidth(), worldHeight()); render(); applyControllerPalettePresentation(); }).observe(dom.canvas.parentElement);
  document.addEventListener('pointerup', () => setTimeout(() => syncTabHints({ consoleActive: false }), 0));
  dom.mainMenuButton?.addEventListener('click', navigateMainMenu);
  dom.hideOverlayButton?.addEventListener('click', () => toggleEditorPanel());
  for (const tab of dom.tabs) {
    tab.addEventListener('click', () => toggleTab(tab.dataset.editorTab));
    tab.addEventListener('focus', () => { editorPanelLastFocused = tab; });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home' || event.key === 'End') {
        setActiveTab(dom.tabs[event.key === 'Home' ? 0 : dom.tabs.length - 1].dataset.editorTab, { show: true, focus: true });
      } else {
        moveActiveTab(event.key === 'ArrowRight' ? 1 : -1, { focus: true });
      }
    });
  }
  dom.autoSaveToggle?.addEventListener('change', () => {
    autoSaveEnabled = dom.autoSaveToggle.checked;
    writeBooleanPreference(localStorage, AUTO_SAVE_STORAGE_KEY, autoSaveEnabled);
    syncPreferencesUi();
    if (autoSaveEnabled && dirty) commitSave({ status: false });
    else updateSaveButton();
  });
  dom.floatingControlsToggle?.addEventListener('change', () => {
    floatingControlsEnabled = dom.floatingControlsToggle.checked;
    writeBooleanPreference(localStorage, FLOATING_CONTROLS_STORAGE_KEY, floatingControlsEnabled);
    syncPreferencesUi();
  });
  for (const button of dom.editLayerButtons) button.addEventListener('click', () => setActiveEditLayer(button.dataset.editLayer));
  dom.controllerBrushSensitivityInput?.addEventListener('input', () => {
    controllerBrushSettings.sensitivity = Math.round(clampNumber(dom.controllerBrushSensitivityInput.value, 1, 10, DEFAULT_CONTROLLER_BRUSH_SETTINGS.sensitivity));
    writeControllerBrushSettings();
    syncControllerBrushSettingsUi();
    setStatus(`Controller brush sensitivity: ${controllerBrushSettings.sensitivity}.`, '');
  });
  dom.controllerBrushMomentumToggle?.addEventListener('change', () => {
    controllerBrushSettings.momentumEnabled = dom.controllerBrushMomentumToggle.checked;
    writeControllerBrushSettings();
    syncControllerBrushSettingsUi();
    setStatus(controllerBrushSettings.momentumEnabled ? 'Controller brush momentum enabled.' : 'Controller brush momentum disabled.', '');
  });
  dom.controllerBrushMomentumDelayInput?.addEventListener('input', () => {
    controllerBrushSettings.momentumDelayMs = Math.round(clampNumber(dom.controllerBrushMomentumDelayInput.value, 100, 2000, DEFAULT_CONTROLLER_BRUSH_SETTINGS.momentumDelayMs));
    writeControllerBrushSettings();
    syncControllerBrushSettingsUi();
  });
  dom.controllerBrushMomentumSpeedInput?.addEventListener('input', () => {
    controllerBrushSettings.momentumMaxSpeed = clampNumber(dom.controllerBrushMomentumSpeedInput.value, 1, 5, DEFAULT_CONTROLLER_BRUSH_SETTINGS.momentumMaxSpeed);
    writeControllerBrushSettings();
    syncControllerBrushSettingsUi();
  });
  dom.controllerPalettePositionSelect?.addEventListener('change', () => {
    controllerBrushSettings.palettePosition = CONTROLLER_PALETTE_POSITIONS.has(dom.controllerPalettePositionSelect.value) ? dom.controllerPalettePositionSelect.value : DEFAULT_CONTROLLER_BRUSH_SETTINGS.palettePosition;
    writeControllerBrushSettings();
    syncControllerBrushSettingsUi();
    setStatus(`Controller palette position: ${dom.controllerPalettePositionSelect.selectedOptions[0]?.textContent ?? controllerBrushSettings.palettePosition}.`, '');
  });
  dom.controllerCursorPaletteSizeSelect?.addEventListener('change', () => {
    controllerBrushSettings.cursorPaletteSize = CONTROLLER_PALETTE_SIZES.has(dom.controllerCursorPaletteSizeSelect.value) ? dom.controllerCursorPaletteSizeSelect.value : DEFAULT_CONTROLLER_BRUSH_SETTINGS.cursorPaletteSize;
    writeControllerBrushSettings();
    syncControllerBrushSettingsUi();
  });
  dom.controllerBottomRightPaletteSizeSelect?.addEventListener('change', () => {
    controllerBrushSettings.bottomRightPaletteSize = CONTROLLER_PALETTE_SIZES.has(dom.controllerBottomRightPaletteSizeSelect.value) ? dom.controllerBottomRightPaletteSizeSelect.value : DEFAULT_CONTROLLER_BRUSH_SETTINGS.bottomRightPaletteSize;
    writeControllerBrushSettings();
    syncControllerBrushSettingsUi();
  });
  dom.panToggleButton?.addEventListener('click', () => { panMode = !panMode; syncPreferencesUi(); });
  dom.tilemapSelect.addEventListener('change', () => loadSelected());
  dom.resetButton.addEventListener('click', () => loadSelected(true));
  dom.newButton.addEventListener('click', () => {
    history.clear();
    editorSource = 'local';
    loadedLocalDraftId = null;
    draft = createBlankDraft({ cols: Number(dom.colsInput.value), rows: Number(dom.rowsInput.value) });
    dom.tilemapSelect.value = getDefaultTilemap().id;
    compiledFresh = false;
    ensureCompiled();
    resetView(viewport, worldWidth(), worldHeight());
    if (autoSaveEnabled) { tryPersist(); dirty = false; } else { dirty = true; }
    syncInputs(); render();
  });
  dom.gridToggle.addEventListener('change', render);
  dom.finalTerrainToggle?.addEventListener('change', () => {
    finalTerrainEnabled = dom.finalTerrainToggle.checked;
    writeBooleanPreference(localStorage, FINAL_TERRAIN_STORAGE_KEY, finalTerrainEnabled);
    render();
    setStatus(finalTerrainEnabled ? 'Final terrain tiles enabled.' : 'Preview-only terrain tiles enabled.', '');
  });
  dom.collisionToggle.addEventListener('change', () => { if (dom.collisionToggle.checked) ensureCompiled(); render(); });
  dom.nameInput?.addEventListener('input', () => { syncDraftMetadataFromInputs(); scheduleAfterEdit(); });
  dom.idInput?.addEventListener('input', () => { syncDraftMetadataFromInputs(); compiledFresh = false; markDirty(); syncInputs(); if (!isKebabCaseId(draft.id)) setStatus('Draft id must be kebab-case. Fix ID to save locally or copy JS.', 'error'); else scheduleAfterEdit(); });
  dom.saveLocalButton?.addEventListener('click', saveLocalExplicit);
  dom.quickPreviewButton?.addEventListener('click', previewDraft);
  dom.previewButton.addEventListener('click', previewDraft);
  dom.copyButton.addEventListener('click', async () => { syncDraftMetadataFromInputs(); if (!isKebabCaseId(draft.id)) { setStatus('Fix draft ID before copying JS.', 'error'); return; } flushPending(); await navigator.clipboard.writeText(dom.exportText.value); setStatus('Copied generated tilemap module.', 'ok'); });
  dom.exportMapButton.addEventListener('click', exportMap);
  dom.importMapButton.addEventListener('click', () => dom.importMapInput.click());
  dom.importMapInput.addEventListener('change', () => importMapFile(dom.importMapInput.files?.[0]));
  dom.undoButton?.addEventListener('click', () => applyHistoryAction('undo'));
  dom.redoButton?.addEventListener('click', () => applyHistoryAction('redo'));
  dom.zoomOutButton?.addEventListener('click', () => zoomBy(0.8));
  dom.zoomInButton?.addEventListener('click', () => zoomBy(1.25));
  dom.resetViewButton?.addEventListener('click', resetCurrentView);
  dom.overlay?.addEventListener('focusin', event => { editorPanelLastFocused = event.target; clearEditorControllerFocus(); });
  dom.canvas.addEventListener('contextmenu', event => event.preventDefault());
  dom.canvas.addEventListener('wheel', event => {
    setEditorInputMode('pointer');
    event.preventDefault();
    const point = eventToScreenPoint(dom.canvas, event);
    zoomBy(event.deltaY > 0 ? 0.9 : 1.1, point);
  }, { passive: false });
  dom.canvas.addEventListener('pointerdown', event => {
    setEditorInputMode(event.pointerType === 'touch' ? 'touch' : 'pointer');
    event.preventDefault();
    const screen = eventToScreenPoint(dom.canvas, event);
    activePointers.set(event.pointerId, screen);
    if (activePointers.size === 2) { isPainting = false; setupTouchPinch(); return; }
    if (isPanGesture(event)) { startPan(event); return; }
    isPainting = true;
    lastPaintKey = null;
    history.beginAction('paint stroke');
    updateHistoryControls();
    dom.canvas.setPointerCapture(event.pointerId);
    paint(event);
  });
  dom.canvas.addEventListener('pointermove', event => {
    const screen = eventToScreenPoint(dom.canvas, event);
    if (activePointers.has(event.pointerId)) activePointers.set(event.pointerId, screen);
    if (pinch) { updateTouchPinch(); return; }
    if (panPointer?.id === event.pointerId) { updatePan(event); return; }
    pointer = pointerCell(event);
    if (isPainting) paint(event); else scheduleRender();
  });
  dom.canvas.addEventListener('pointerleave', () => { if (!isPainting && !panPointer) { pointer = null; scheduleRender(); } });
  addEventListener('pointerup', event => {
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) pinch = null;
    if (panPointer?.id === event.pointerId) panPointer = null;
    if (isPainting) {
      isPainting = false;
      lastPaintKey = null;
      history.commitAction();
      updateHistoryControls();
      flushPending();
    }
  });
  addEventListener('keydown', processEditorKeyboardEvent);
  addEventListener('keyup', processEditorKeyboardEvent);
  requestAnimationFrame(processEditorControllerFrame);
  addEventListener('beforeunload', event => {
    if (autoSaveEnabled || !dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
  addEventListener('pagehide', () => { if (autoSaveEnabled) flushPending(); });
  document.addEventListener('visibilitychange', () => { if (autoSaveEnabled && document.visibilityState === 'hidden') flushPending(); });
  render();
  if (CAPTURE_TARGET === 'map-editor') {
    resetView(viewport, worldWidth(), worldHeight());
    viewport.camera.zoom = Math.max(viewport.minZoom, Math.min(1.75, viewport.camera.zoom * 1.18));
    viewport.camera.x = Math.max(0, Math.min(180, worldWidth() - viewport.width / viewport.camera.zoom));
    viewport.camera.y = Math.max(0, Math.min(80, worldHeight() - viewport.height / viewport.camera.zoom));
    clampCamera(viewport, worldWidth(), worldHeight());
    setActiveTab('edit', { show: true });
    render();
    requestAnimationFrame(() => requestAnimationFrame(markCaptureReady));
  }
  setStatus(`Valid ${draft.cols}×${draft.rows} tilemap.`, 'ok');
}

setup();
