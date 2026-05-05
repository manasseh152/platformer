import {
  getAllScenarioEntries,
  getDefaultScenarioEntry,
  getScenarioEntryById,
  getVisibleScenarioEntries,
  launchScenarioEntry
} from './registry.js';

function canSeeScenario(game, scenario) {
  return scenario?.visibility === 'public' || Boolean(game.settings?.developerMode || game.session?.developerModeOverride);
}

export function createScenarioService(game, runtime = game.runtime) {
  let selectedScenarioId = getDefaultScenarioEntry().id;
  let current = null;

  function getSelected() {
    return getScenarioEntryById(selectedScenarioId) ?? getDefaultScenarioEntry();
  }

  function select(id) {
    const scenario = getScenarioEntryById(id);
    if (!scenario) return { ok: false, reason: 'missing-scenario', scenario: null };
    if (!canSeeScenario(game, scenario)) return { ok: false, reason: 'developer-only', scenario };
    selectedScenarioId = scenario.id;
    runtime?.emit?.('scenario.select', { scenarioId: scenario.id, source: scenario.source });
    return { ok: true, reason: null, scenario };
  }

  function launch(id = selectedScenarioId, options = {}) {
    const scenario = getScenarioEntryById(id);
    if (!scenario) return { ok: false, reason: 'missing-scenario', scenario: null };
    if (!canSeeScenario(game, scenario)) return { ok: false, reason: 'developer-only', scenario };
    selectedScenarioId = scenario.id;
    const result = launchScenarioEntry(game, scenario.id);
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
    getById: getScenarioEntryById,
    getAll: getAllScenarioEntries,
    getVisible: options => getVisibleScenarioEntries({ developerMode: Boolean(game.settings?.developerMode || game.session?.developerModeOverride), ...options }),
    getSelected,
    select,
    launch,
    restartCurrent
  };
}
