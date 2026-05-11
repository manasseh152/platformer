import { getCategoryById, primaryGroupCategoryFor } from '../../catalog/categories/registry.js';
import { countLocalDraftRecords, listLocalDraftRecords } from '../../catalog/local-drafts/storage.js';
import { getVisibleScenarioEntries } from '../../catalog/scenarios/registry.js';
import { runDOMTransition } from './transitions.js';

const LEVEL_SELECT_TAB_KEY = 'chibi.level-select.active-tab';
const LEVEL_SELECT_TABS = [
  { id: 'acts', label: 'Acts', developer: false },
  { id: 'local', label: 'Local', developer: false },
  { id: 'gyms', label: 'Gyms', developer: true },
  { id: 'zoos', label: 'Zoos', developer: true }
];

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

export function setLevelSelectTab(game, tabId, focusElement) {
  if (!availableLevelSelectTabs(game).some(tab => tab.id === tabId)) return;
  runDOMTransition(game, () => {
    game.menu.levelSelectTab = tabId;
    game.runtime?.storage?.setItem?.(LEVEL_SELECT_TAB_KEY, tabId);
    renderScenarioBrowser(game);
  }, () => focusElement?.(game.ui.levelSelectList?.querySelector(`[role="tab"][data-level-select-tab="${tabId}"]`)), 'scenario-tab');
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
  if (tabId === 'local') return `${localCount} local map${localCount === 1 ? '' : 's'} saved on this device.`;
  if (tabId === 'gyms') return 'Developer gyms validate focused mechanics.';
  if (tabId === 'zoos') return 'Developer zoos demonstrate entities and interactions.';
  const current = game.scenarios?.current?.entry || game.scenarios?.getSelected?.() || game.tilemaps.getCurrentTilemap();
  return `Current scenario: ${current.name}.`;
}

export function renderSelectedTilemapSummary(game) {
  const tilemap = game.tilemaps.getCurrentTilemap();
  if (game.ui.selectedLevelSummary) game.ui.selectedLevelSummary.textContent = `Selected level: ${tilemap.name}`;
  const heroTitle = document.querySelector('.hero-scene__title');
  if (heroTitle) heroTitle.textContent = tilemap.name;
  if (game.ui.hudLevelName) game.ui.hudLevelName.textContent = tilemap.name;
}

export function renderScenarioBrowser(game, message = '') {
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

export function selectScenario(game, entryId, { closeScenarioBrowser } = {}) {
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
  if (game.menu.origin === 'start') closeScenarioBrowser?.(game);
}
