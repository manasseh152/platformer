import { CELL_SIZE } from '../core/constants.js';
import { drawCollisionDebugOverlay } from '../devtools/debug-render.js';
import { getAllTilemaps, getDefaultTilemap } from '../content/tilemaps/registry.js';
import { planContainedTerrainTileVisuals } from '../render/contained-terrain.js';
import { terrainKindConfig } from '../core/tilemaps/terrain-layer.js';
import { compileDraft as compileTilemapDraft, createBlankDraft, createDraftFromTilemap as draftFromTilemap, EMPTY, hasEntitySymbol, normalizeDraft, replaceChar } from './tilemap-draft.js';
import { BRUSHES, brushesForPalette, defaultPaletteForLayer, layerById, palettesForLayer } from './edit-domain.js';
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
const AUTO_SAVE_STORAGE_KEY = 'chibi.tilemap-editor.auto-save';
const FLOATING_CONTROLS_STORAGE_KEY = 'chibi.tilemap-editor.floating-controls';
const CONTROLLER_BRUSH_SETTINGS_STORAGE_KEY = 'chibi.tilemap-editor.controller-brush';
const DEFAULT_CONTROLLER_BRUSH_SETTINGS = Object.freeze({ sensitivity: 5, momentumEnabled: false, momentumDelayMs: 450, momentumMaxSpeed: 2.5 });

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
  controllerViewportHints: document.querySelector('#controllerViewportHints'),
  undoButton: document.querySelector('#undoButton'),
  redoButton: document.querySelector('#redoButton'),
  editLayerButtons: Array.from(document.querySelectorAll('[data-edit-layer]')),
  paletteSectionTitle: document.querySelector('#paletteSectionTitle'),
  paletteSummary: document.querySelector('#paletteSummary'),
  brushSectionTitle: document.querySelector('#brushSectionTitle'),
  brushLayerHint: document.querySelector('#brushLayerHint'),
  brushes: document.querySelector('#brushes'),
  controllerBrushSensitivityInput: document.querySelector('#controllerBrushSensitivityInput'),
  controllerBrushSensitivityValue: document.querySelector('#controllerBrushSensitivityValue'),
  controllerBrushMomentumToggle: document.querySelector('#controllerBrushMomentumToggle'),
  controllerBrushMomentumDelayInput: document.querySelector('#controllerBrushMomentumDelayInput'),
  controllerBrushMomentumSpeedInput: document.querySelector('#controllerBrushMomentumSpeedInput'),
  gridToggle: document.querySelector('#gridToggle'),
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
let activePaletteId = defaultPaletteForLayer(activeEditLayerId)?.id ?? null;
let overlayHidden = false;
let autoSaveEnabled = readBooleanPreference(localStorage, AUTO_SAVE_STORAGE_KEY, true);
let floatingControlsEnabled = readBooleanPreference(localStorage, FLOATING_CONTROLS_STORAGE_KEY, true);
let controllerBrushSettings = readControllerBrushSettings();
let dirty = false;
let saving = false;
let panMode = false;
let editorPanelLastFocused = null;
let controllerNavX = 0;
let controllerNavY = 0;
let controllerCanvasMode = 'draw';
let editorInputMode = 'pointer';
let controllerPaintActive = false;
let controllerNextMoveAt = 0;
let controllerMoveHeldSince = 0;
let controllerMoveHoldKey = '';

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
      momentumMaxSpeed: clampNumber(saved.momentumMaxSpeed, 1, 5, DEFAULT_CONTROLLER_BRUSH_SETTINGS.momentumMaxSpeed)
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
function terrainLayer() { return draft.layers.find(layer => layer.id === 'terrain'); }
function entityLayer() { return draft.layers.find(layer => layer.id === 'entities'); }
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
  if (dom.nameInput) dom.nameInput.value = draft.name || '';
  if (dom.idInput) dom.idInput.value = draft.id || '';
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
}

function syncPreferencesUi() {
  if (dom.autoSaveToggle) dom.autoSaveToggle.checked = autoSaveEnabled;
  if (dom.floatingControlsToggle) dom.floatingControlsToggle.checked = floatingControlsEnabled;
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
}

function syncViewportHints() {
  renderInputHints({ inputScheme: editorInputMode === 'gamepad' ? 'gamepad' : 'wasd' }, document, {
    runtime: inputRuntime,
    settings: inputRuntime.settings,
    profile: gameInputProfile
  });
}

function setActiveTab(tabId, { show = true, focus = false } = {}) {
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
  if (!show) clearEditorControllerFocus();
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
  renderTabInputHints({ inputScheme }, document, { profile: gameInputProfile, settings: inputRuntime.settings, runtime: inputRuntime, consoleActive });
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
  const range = visibleCellRange(layer, rect);
  ctx.fillStyle = '#40504a';
  for (let row = range.startRow; row <= range.endRow; row++) {
    const line = layer.rows[row];
    for (let col = range.startCol; col <= range.endCol; col++) {
      const kind = line[col];
      if (kind === null) continue;
      const config = terrainKindConfig(kind);
      ctx.fillStyle = config?.visible === false ? 'rgba(167,139,250,.38)' : config?.palette?.baseColor ?? '#40504a';
      ctx.fillRect(col * layer.cellSize, row * layer.cellSize, layer.cellSize, layer.cellSize);
      if (config?.visible === false) {
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
  const range = visibleCellRange(layer, rect);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 18px "Geist Sans", ui-sans-serif, system-ui, sans-serif';
  for (let row = range.startRow; row <= range.endRow; row++) {
    const line = layer.rows[row];
    for (let col = range.startCol; col <= range.endCol; col++) {
      const ch = line[col];
      if (ch === EMPTY) continue;
      const px = col * CELL_SIZE.GRID;
      const py = row * CELL_SIZE.GRID;
      ctx.fillStyle = ch === 'P' ? '#78a8ff' : ch === 'E' ? '#ff7bd5' : '#ffd36a';
      ctx.globalAlpha = .88;
      ctx.fillRect(px + 4, py + 4, CELL_SIZE.GRID - 8, CELL_SIZE.GRID - 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#071018';
      ctx.fillText(ch, px + CELL_SIZE.GRID / 2, py + CELL_SIZE.GRID / 2 + 1);
    }
  }
  ctx.restore();
}

function drawCursor(ctx, cursor) {
  const layer = draft.layers.find(layer => layer.id === brush.layerId);
  if (!layer || cursor.row < 0 || cursor.row >= layer.rows.length || cursor.col < 0 || cursor.col >= layer.rows[0].length) return;
  debug.cursorRenderCount = (debug.cursorRenderCount ?? 0) + 1;
  debug.cursor = { col: cursor.col, row: cursor.row, layerId: brush.layerId, brushId: brush.id };
  const x = cursor.col * brush.cellSize;
  const y = cursor.row * brush.cellSize;
  const inset = 1 / viewport.camera.zoom;
  const haloWidth = 6 / viewport.camera.zoom;
  const lineWidth = 3 / viewport.camera.zoom;
  const corner = Math.max(4, brush.cellSize * 0.32);
  ctx.save();
  ctx.fillStyle = 'rgba(8, 12, 22, .22)';
  ctx.fillRect(x + inset, y + inset, brush.cellSize - inset * 2, brush.cellSize - inset * 2);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0, 0, 0, .82)';
  ctx.lineWidth = haloWidth;
  ctx.strokeRect(x + inset, y + inset, brush.cellSize - inset * 2, brush.cellSize - inset * 2);
  ctx.strokeStyle = brush.cursor;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x + inset, y + inset, brush.cellSize - inset * 2, brush.cellSize - inset * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, .95)';
  ctx.lineWidth = 1.5 / viewport.camera.zoom;
  const right = x + brush.cellSize - inset;
  const bottom = y + brush.cellSize - inset;
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
  if (!drawCompiledTerrain(ctx, rect)) drawDraftTerrain(ctx, rect);
  drawEntities(ctx, rect);
  if (dom.collisionToggle.checked && compiled) drawCollisionDebugOverlay(ctx, compiled, { showCollisionRects: true });
  if (dom.gridToggle.checked) drawGrid(ctx, rect);
  if (pointer) drawCursor(ctx, pointer);
  updateZoomReadout();
}

function updateZoomReadout() {
  if (dom.zoomReadout) dom.zoomReadout.textContent = `${Math.round(viewport.camera.zoom * 100)}%`;
  dom.canvas.dataset.zoom = viewport.camera.zoom.toFixed(3);
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
    else layer.rows[cell.row] = replaceChar(layer.rows[cell.row], cell.col, brush.symbol);
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
  else layer.rows[change.row] = replaceChar(layer.rows[change.row], change.col, change.value);
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

  if (route.wasPressed('editor.togglePanel')) { route.consume('editor.togglePanel'); toggleEditorPanel(); }

  const xValue = route.value('menu.navigateX');
  const yValue = route.value('menu.navigateY');
  const xDirection = navDirection(xValue);
  const yDirection = navDirection(yValue);

  if (overlayHidden) {
    if (route.wasPressed('editor.toggleMode')) { route.consume('editor.toggleMode'); toggleControllerCanvasMode(); }
    if (route.wasPressed('editor.zoomOut')) { route.consume('editor.zoomOut'); zoomBy(0.88); }
    if (route.wasPressed('editor.zoomIn')) { route.consume('editor.zoomIn'); zoomBy(1.14); }
    if (route.wasPressed('editor.resetView')) { route.consume('editor.resetView'); resetCurrentView(); }
    if (route.wasPressed('editor.previousBrush')) { route.consume('editor.previousBrush'); cycleBrush(-1); }
    if (route.wasPressed('editor.nextBrush')) { route.consume('editor.nextBrush'); cycleBrush(1); }

    if (controllerCanvasMode === 'navigate') {
      if (xValue || yValue) {
        panByScreenDelta(viewport, -xValue * 12, -yValue * 12, worldWidth(), worldHeight());
        saveView();
        scheduleRender();
        route.consume('menu.navigateX');
        route.consume('menu.navigateY');
      }
    } else {
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
  } else {
    if (route.wasPressed('editor.previousTab')) { route.consume('editor.previousTab'); moveActiveTab(-1); }
    if (route.wasPressed('editor.nextTab')) { route.consume('editor.nextTab'); moveActiveTab(1); }

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
  const palette = palettesForLayer(activeEditLayerId).find(candidatePalette => candidatePalette.brushIds.includes(candidate.id)) ?? defaultPaletteForLayer(activeEditLayerId);
  activePaletteId = palette?.id ?? activePaletteId;
  const worldPoint = pointer ? { x: (pointer.col + 0.5) * previous.cellSize, y: (pointer.row + 0.5) * previous.cellSize } : null;
  brush = candidate;
  if (worldPoint) pointer = clampBrushCell({ col: Math.floor(worldPoint.x / brush.cellSize), row: Math.floor(worldPoint.y / brush.cellSize) });
  buildLayerButtons();
  buildBrushButtons();
  render();
}

function brushesForActivePalette() {
  const paletteBrushes = brushesForPalette(activePaletteId);
  return paletteBrushes.length ? paletteBrushes : BRUSHES.filter(candidate => candidate.layerId === activeEditLayerId);
}

function activeLayerConfig() { return layerById(activeEditLayerId); }

function setActiveEditLayer(layerId) {
  const nextLayer = layerById(layerId);
  if (nextLayer.disabled) return;
  activeEditLayerId = nextLayer.id;
  activePaletteId = defaultPaletteForLayer(activeEditLayerId)?.id ?? null;
  const layerBrushes = brushesForActivePalette();
  if (!layerBrushes.some(candidate => candidate.id === brush.id)) setBrush(layerBrushes[0]);
  else { buildLayerButtons(); buildBrushButtons(); }
  setStatus(`Layer: ${activeLayerConfig().label} · ${activeLayerConfig().gridLabel}.`, '');
}

function cycleBrush(direction) {
  const paletteBrushes = brushesForActivePalette();
  const index = paletteBrushes.findIndex(candidate => candidate.id === brush.id);
  const nextIndex = ((index < 0 ? 0 : index) + direction + paletteBrushes.length) % paletteBrushes.length;
  setBrush(paletteBrushes[nextIndex]);
  setStatus(`Palette: ${brush.label}.`, '');
}

function toggleControllerCanvasMode() {
  controllerCanvasMode = controllerCanvasMode === 'draw' ? 'navigate' : 'draw';
  document.body.dataset.editorControllerMode = controllerCanvasMode;
  setStatus(controllerCanvasMode === 'draw' ? 'Controller draw mode: left stick moves cursor, A paints, LB/RB changes palette item.' : 'Controller navigate mode: left stick pans. Press X for draw mode.', '');
}

function toggleEditorPanel() {
  setActiveTab(activeTab, { show: overlayHidden });
  if (overlayHidden) {
    if (controllerCanvasMode === 'draw') ensureControllerPointer({ renderIfChanged: true });
    setStatus('Palette panel hidden. Press Y to show it.', '');
  } else setStatus('Palette panel shown. Press B or Y to return to canvas.', '');
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
  const palette = palettesForLayer(activeEditLayerId).find(candidate => candidate.id === activePaletteId) ?? defaultPaletteForLayer(activeEditLayerId);
  if (dom.paletteSectionTitle) dom.paletteSectionTitle.textContent = layer.paletteTitle;
  if (dom.paletteSummary) dom.paletteSummary.textContent = palette ? `${palette.label}: ${palette.description}. ${layer.gridLabel}.` : layer.gridLabel;
  if (dom.brushSectionTitle) dom.brushSectionTitle.textContent = `Selected: ${brush.label}`;
  if (dom.brushLayerHint) dom.brushLayerHint.textContent = layer.hint;
  dom.brushes.innerHTML = '';
  for (const candidate of brushesForActivePalette()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = candidate.id === brush.id ? 'active palette-chip' : 'palette-chip';
    button.setAttribute('aria-pressed', candidate.id === brush.id ? 'true' : 'false');
    button.setAttribute('aria-label', candidate.label);
    button.innerHTML = `<span class="palette-chip__swatch" aria-hidden="true"></span><span class="palette-chip__label"></span>`;
    button.querySelector('.palette-chip__swatch').style.setProperty('--swatch', candidate.swatch ?? candidate.cursor);
    button.querySelector('.palette-chip__label').textContent = candidate.shortLabel ?? candidate.label;
    button.addEventListener('click', () => { setBrush(candidate); });
    dom.brushes.append(button);
  }
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
  render();
}

function resetCurrentView() {
  resetView(viewport, worldWidth(), worldHeight());
  saveView();
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

function loadInitialDraftFromUrl() {
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
  setActiveTab('edit', { show: true });

  new ResizeObserver(() => { resizeViewport(viewport); clampCamera(viewport, worldWidth(), worldHeight()); render(); }).observe(dom.canvas.parentElement);
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
  setStatus(`Valid ${draft.cols}×${draft.rows} tilemap.`, 'ok');
}

setup();
