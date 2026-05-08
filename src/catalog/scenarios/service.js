import {
  getAllScenarioEntries,
  getDefaultScenarioEntry,
  getScenarioEntryById,
  getVisibleScenarioEntries,
  launchScenarioEntry
} from './registry.js';
import { getAllLocalDraftScenarios, getLocalDraftScenarioById, localDraftIdFromScenarioId } from '../local-drafts/storage.js';

function canSeeScenario(game, scenario) {
  return scenario?.visibility === 'public' || Boolean(game.settings?.developerMode || game.session?.developerModeOverride);
}

export function createScenarioService(game, runtime = game.runtime) {
  let selectedScenarioId = getDefaultScenarioEntry().id;
  let current = null;

  function getById(id) {
    return getScenarioEntryById(id) ?? getLocalDraftScenarioById(runtime?.storage, id);
  }

  function getAll() {
    return [...getAllScenarioEntries(), ...getAllLocalDraftScenarios(runtime?.storage)];
  }

  function getSelected() {
    return getById(selectedScenarioId) ?? getDefaultScenarioEntry();
  }

  function select(id) {
    const scenario = getById(id);
    if (!scenario) return { ok: false, reason: localDraftIdFromScenarioId(id) ? 'missing-local-draft' : 'missing-scenario', scenario: null };
    if (scenario.source === 'local' && !scenario.localDraft?.validation?.playable) return { ok: false, reason: scenario.localDraft?.validation?.reason || 'unplayable-local-draft', scenario };
    if (!canSeeScenario(game, scenario)) return { ok: false, reason: 'developer-only', scenario };
    selectedScenarioId = scenario.id;
    runtime?.emit?.('scenario.select', { scenarioId: scenario.id, source: scenario.source });
    return { ok: true, reason: null, scenario };
  }

  function launch(id = selectedScenarioId, options = {}) {
    const scenario = getById(id);
    if (!scenario) return { ok: false, reason: localDraftIdFromScenarioId(id) ? 'missing-local-draft' : 'missing-scenario', scenario: null };
    if (scenario.source === 'local' && !scenario.localDraft?.validation?.playable) return { ok: false, reason: scenario.localDraft?.validation?.reason || 'unplayable-local-draft', scenario };
    if (!canSeeScenario(game, scenario)) return { ok: false, reason: 'developer-only', scenario };
    selectedScenarioId = scenario.id;
    const result = scenario.source === 'local' ? launchScenarioEntry(game, scenario) : launchScenarioEntry(game, scenario.id);
    if (!result.ok) return result;
    current = {
      id: scenario.id,
      source: scenario.source,
      entry: scenario,
      launchedAt: runtime?.now?.() ?? Date.now(),
      origin: options.origin ?? null
    };
    runtime?.emit?.('scenario.launch', { scenarioId: scenario.id, source: scenario.source, origin: current.origin });
    return { ...result, scenario, current };
  }

  function restartCurrent() {
    return current ? launch(current.id, { origin: 'restart' }) : launch(selectedScenarioId, { origin: 'restart' });
  }

  return {
    get selectedScenarioId() { return selectedScenarioId; },
    get current() { return current; },
    getById,
    getAll,
    getVisible: options => getAll().filter(entry => canSeeScenario(game, entry)),
    getSelected,
    select,
    launch,
    restartCurrent
  };
}
