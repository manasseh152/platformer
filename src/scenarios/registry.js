import { createCatalogRegistry } from '../catalog/registry.js';
import { getAllTilemapLevelDefinitions, getTilemapLevelDefinitionById } from '../tilemaps/registry.js';
import { isVisibleToMode } from '../categories/registry.js';
import { getAllGyms } from '../gyms/registry.js';

function assertScenarioEntry(entry) {
  if (typeof entry.source !== 'string' || !entry.source.trim()) throw new Error(`${entry.id} must have a source`);
  if (typeof entry.targetId !== 'string' || !entry.targetId.trim()) throw new Error(`${entry.id} must have a targetId`);
  if (!entry.composition && typeof entry.launch !== 'function') throw new Error(`${entry.id} must have a composition or launch function`);
}

export function defineScenarioEntry(entry) {
  return { ...entry };
}

const registry = createCatalogRegistry({
  name: 'scenarios',
  // Deprecated compatibility: scenario kind will be removed in favor of source + composition.type.
  allowedKinds: ['tilemap-level', 'executable-gym', 'campaign-scenario', 'gym-scenario', 'zoo-scenario', 'scene'],
  validateEntry: assertScenarioEntry
});

function sourceForTilemapLevelDefinition(definition) {
  if (definition.id === 'act-01-level-1') return 'campaign';
  if (definition.categories?.includes('zoos')) return 'zoos';
  return 'gyms';
}

function registerTilemapLevelDefinition(definition) {
  if (!getTilemapLevelDefinitionById(definition.id)) throw new Error(`${definition.id} targets missing tilemap level definition: ${definition.id}`);
  return registry.register(defineScenarioEntry({
    id: definition.id,
    name: definition.name,
    kind: definition.kind,
    categories: definition.categories,
    visibility: definition.visibility,
    description: definition.description,
    source: sourceForTilemapLevelDefinition(definition),
    targetId: definition.id,
    composition: {
      type: 'tilemap-gameplay',
      stack: [
        {
          scene: 'gameplay',
          props: {
            tilemapLevelDefinitionId: definition.id,
            goal: { type: 'finish-gate' }
          }
        }
      ]
    },
    launch: game => game.levels.switchLevel(definition.id)
  }));
}

function registerExecutableGym(gym) {
  return registry.register(defineScenarioEntry({
    id: gym.id,
    name: gym.name,
    kind: gym.kind,
    categories: gym.categories,
    visibility: gym.visibility,
    description: gym.description,
    source: 'gyms',
    targetId: gym.sceneId,
    artifacts: gym.artifacts,
    tests: gym.artifacts?.filter(artifact => artifact.startsWith('tests/')) ?? [],
    docs: gym.docs ?? [],
    covers: gym.covers ?? [],
    ci: gym.ci ?? true,
    composition: {
      type: 'executable-gym',
      stack: [{ scene: gym.sceneId, props: { gymId: gym.id } }]
    },
    launch: game => game.runtime?.scenes?.switchScene?.(gym.sceneId) ?? { ok: false, reason: 'missing-scene-host', level: game.level }
  }));
}

export const registeredTilemapScenarios = getAllTilemapLevelDefinitions().map(registerTilemapLevelDefinition);
export const registeredGymScenarios = getAllGyms().map(registerExecutableGym);

export const scenarioEntries = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getScenarioEntryById(id) {
  return registry.getById(id);
}

export function getAllScenarioEntries() {
  return registry.getAll();
}

export function getVisibleScenarioEntries({ developerMode = false } = {}) {
  return getAllScenarioEntries().filter(entry => isVisibleToMode(entry, developerMode));
}

export function launchScenarioEntry(game, entryId) {
  const entry = getScenarioEntryById(entryId);
  if (!entry) return { ok: false, reason: 'missing-scenario-entry', entry: null };
  const result = entry.launch?.(game);
  return result && typeof result === 'object' ? { entry, ...result } : { ok: true, entry, result };
}
