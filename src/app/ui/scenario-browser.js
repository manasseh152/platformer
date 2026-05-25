import { getCategoryById, primaryGroupCategoryFor } from '../../catalog/categories/registry.js';
import { countLocalDraftRecords, listLocalDraftRecords } from '../../catalog/local-drafts/storage.js';
import { getVisibleScenarioEntries } from '../../catalog/scenarios/registry.js';
import { escapeHtml, renderInfoRow, renderSection, renderSettingRow, renderTabList, renderTabPanel } from './components/primitives.js';
import { renderIconLabel } from './components/icons.js';
import { runDOMTransition } from './transitions.js';

const LEVEL_SELECT_TAB_KEY = 'chibi.level-select.active-tab';
const LEVEL_SELECT_TABS = [
  { id: 'acts', label: 'Acts', developer: false },
  { id: 'local', label: 'Local', developer: false },
  { id: 'gyms', label: 'Gyms', developer: true },
  { id: 'zoos', label: 'Zoos', developer: true }
];

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
function actionIconFor(label) { return label === 'Selected' ? 'check' : label === 'Select' ? 'mousePointerClick' : 'play'; }

function renderScenarioRow(game, entry, current, currentScenarioId) {
  const isCurrent = currentScenarioId ? currentScenarioId === entry.id : tilemapDefinitionIdForScenario(entry) === current.id;
  const tags = scenarioTagNames(entry);
  const docs = entry.docs?.length ? ` // Docs: ${entry.docs.join(', ')}` : '';
  const tests = entry.tests?.length ? ` // Tests: ${entry.tests.join(', ')}` : '';
  const covers = entry.covers?.length ? ` // Covers: ${entry.covers.join(', ')}` : '';
  const description = `${entry.description || ''}${tags ? ` // ${tags}` : ''}${entry.visibility === 'developer' ? ' // Developer' : ''}${entry.ci ? ' // CI' : ''}${docs}${tests}${covers}`;
  return renderSettingRow({
    label: entry.name,
    description,
    value: renderIconLabel(actionIconFor(actionLabelFor(game, isCurrent)), actionLabelFor(game, isCurrent)),
    className: `level-select-row${isCurrent ? ' is-current' : ''}`,
    attributes: { 'data-scenario-id': entry.id, 'data-scenario-source': entry.source || '' }
  });
}

function formatSavedAt(value) {
  if (!Number.isFinite(value)) return 'Saved date unknown';
  return `Saved ${new Date(value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
}

function renderLocalDraftRow(game, record, currentScenarioId) {
  const draft = record.draft;
  if (!draft) return renderInfoRow({
    label: record.id || 'Unreadable local draft',
    description: `Invalid: ${record.validation?.message || 'Saved JSON is malformed.'}`,
    value: renderIconLabel('triangleAlert', 'Invalid'),
    className: 'local-draft-row is-invalid'
  });
  const scenarioId = `local:${draft.id}`;
  const validation = record.validation;
  const status = !validation.ok ? `Invalid: ${validation.message}` : (!validation.playable ? validation.message : (validation.warning || 'Ready'));
  const isCurrent = currentScenarioId === scenarioId;
  const disabled = !validation.playable;
  return renderSettingRow({
    label: draft.name || draft.id,
    description: `${draft.id} // ${draft.cols}×${draft.rows} // ${formatSavedAt(draft.updatedAt)} // ${status}`,
    value: `<button type="button" class="ds-button ds-button--secondary" data-scenario-id="${escapeHtml(scenarioId)}" data-scenario-source="local"${disabled ? ' disabled' : ''}>${renderIconLabel(actionIconFor(actionLabelFor(game, isCurrent)), actionLabelFor(game, isCurrent))}</button><button type="button" class="ds-button ds-button--secondary" data-local-draft-edit="${escapeHtml(draft.id)}">${renderIconLabel('pencil', 'Edit')}</button>`,
    tag: 'div',
    className: `local-draft-row${isCurrent ? ' is-current' : ''}${disabled ? ' is-invalid' : ''}`,
    valueClassName: 'local-draft-actions',
    attributes: { 'data-local-draft-id': draft.id }
  });
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
  return [...groups.values()].sort((a, b) => a.group.order - b.group.order).map(({ group, entries }) => renderSection({
    title: group.name,
    body: `<div class="settings-row-list">${entries.map(entry => renderScenarioRow(game, entry, current, currentScenarioId)).join('')}</div>`,
    className: 'settings-section level-select-group',
    attributes: { 'data-scenario-source': 'campaigns' }
  })).join('');
}

function renderSourceTab(game, entries, current, currentScenarioId, title) {
  return renderSection({
    title,
    body: `<div class="settings-row-list">${entries.map(entry => renderScenarioRow(game, entry, current, currentScenarioId)).join('')}</div>`,
    className: 'settings-section level-select-group',
    attributes: { 'data-scenario-source': title.toLowerCase() }
  });
}

function renderLocalTab(game, currentScenarioId) {
  const records = listLocalDraftRecords(game.runtime?.storage);
  const rows = records.map(record => renderLocalDraftRow(game, record, currentScenarioId)).join('');
  return `<section class="ds-section settings-section level-select-group" data-scenario-source="local">
    <div class="level-select-toolbar"><h3>Local maps</h3><button type="button" class="ds-button ds-button--secondary" data-open-map-editor>${renderIconLabel('map', 'Open Map Editor')}</button></div>
    ${records.length ? `<div class="settings-row-list">${rows}</div>` : `<div class="ds-setting-row ds-setting-row--info"><span class="ds-setting-row--copy"><span class="ds-setting-row--label">No local maps saved yet.</span><span class="ds-setting-row--description">Create or import a map in the editor, then save it locally.</span></span><span class="ds-setting-row--value"><button type="button" class="ds-button ds-button--primary" data-open-map-editor>${renderIconLabel('map', 'Open Map Editor')}</button></span></div>`}
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
  const heroTitle = document.querySelector('.hero-scene--title');
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
  const tabMarkup = renderTabList({
    label: 'Scenario categories',
    tabs: tabs.map(tab => ({
      id: tab.id,
      label: tab.id === 'local' ? `${tab.label} (${localCount})` : tab.label,
      className: 'ds-button level-select-tab',
      attributes: { 'data-level-select-tab': tab.id }
    })),
    activeId: tabId,
    className: 'level-select-tabs',
    variant: 'primary'
  });
  const tabEntries = entriesForTab(entries, tabId);
  let panel = '';
  if (tabId === 'acts') panel = renderActsTab(game, tabEntries, current, currentScenarioId);
  else if (tabId === 'local') panel = renderLocalTab(game, currentScenarioId);
  else panel = renderSourceTab(game, tabEntries, current, currentScenarioId, tabId === 'gyms' ? 'Gyms' : 'Zoos');
  ui.levelSelectList.innerHTML = `${tabMarkup}${renderTabPanel({ body: panel, className: 'level-select-panel' })}`;
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
