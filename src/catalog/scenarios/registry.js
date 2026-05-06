import { createCatalogRegistry } from '../registry.js';
import { isVisibleToMode } from '../categories/registry.js';
import { getAllCampaignScenarios } from '../../content/campaigns/registry.js';
import { getAllGyms } from '../../content/gyms/registry.js';
import { getAllZooScenarios } from '../../content/zoos/registry.js';

function tilemapIdForScenario(entry) {
  return entry.composition?.stack?.find(layer => layer.props?.tilemapId)?.props?.tilemapId ?? null;
}

function assertScenarioEntry(entry) {
  if (typeof entry.source !== 'string' || !entry.source.trim()) throw new Error(`${entry.id} must have a source`);
  if (!entry.composition?.stack?.length) throw new Error(`${entry.id} must define a composition stack`);
}

export function defineScenarioEntry(entry) {
  const tests = entry.tests ?? [];
  const docs = entry.docs ?? [];
  return {
    ...entry,
    tests,
    docs,
    covers: entry.covers ?? [],
    artifacts: entry.artifacts ?? [...tests, ...docs],
    ci: entry.ci ?? entry.source === 'gyms'
  };
}

const registry = createCatalogRegistry({
  name: 'scenarios',
  validateEntry: assertScenarioEntry
});

function registerScenario(entry) {
  return registry.register(defineScenarioEntry(entry));
}

export const registeredCampaignScenarios = getAllCampaignScenarios().map(registerScenario);
export const registeredGymScenarios = getAllGyms().map(registerScenario);
export const registeredZooScenarios = getAllZooScenarios().map(registerScenario);

export const scenarioEntries = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getScenarioEntryById(id) {
  return registry.getById(id);
}

export function getAllScenarioEntries() {
  return registry.getAll();
}

export function getDefaultScenarioEntry() {
  return getScenarioEntryById('act-01-level-1');
}

export function getVisibleScenarioEntries({ developerMode = false } = {}) {
  return getAllScenarioEntries().filter(entry => isVisibleToMode(entry, developerMode));
}

export function launchScenarioEntry(game, entryId) {
  const entry = getScenarioEntryById(entryId);
  if (!entry) return { ok: false, reason: 'missing-scenario-entry', entry: null };

  const composition = entry.composition;
  if (!composition?.stack?.length) return { ok: false, reason: 'empty-composition', entry };
  if (!game.sceneLibrary || !game.runtime?.scenes?.replaceStack) return { ok: false, reason: 'missing-scene-composition-runtime', entry };

  const { resolveSceneComposition } = game.sceneLibrary;
  const resolved = typeof resolveSceneComposition === 'function'
    ? resolveSceneComposition(game.sceneLibrary, game, composition)
    : null;
  if (resolved?.ok === false) return { entry, ...resolved };
  const scenes = resolved?.scenes;
  if (!scenes?.length) return { ok: false, reason: 'empty-resolved-composition', entry };

  const stack = game.runtime.scenes.replaceStack(scenes);
  return { ok: true, reason: null, entry, tilemap: game.tilemap, tilemapId: tilemapIdForScenario(entry), stack };
}
