import { createCatalogRegistry } from '../catalog/registry.js';
import { getAllTilemapLevelDefinitions, getTilemapLevelDefinitionById } from '../tilemaps/registry.js';
import { isVisibleToMode } from '../categories/registry.js';
import { getAllGyms } from '../gyms/registry.js';
import { getAllZooScenarios } from '../zoos/registry.js';

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
  if (definition.id === 'act-01-level-1') return 'campaigns';
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

function tilemapDefinitionIdForScenario(entry) {
  return entry.composition?.stack?.find(layer => layer.props?.tilemapLevelDefinitionId)?.props?.tilemapLevelDefinitionId ?? entry.targetId ?? entry.id;
}

function registerSourceScenario(entry, defaultSource) {
  return registry.register(defineScenarioEntry({
    ...entry,
    source: entry.source ?? defaultSource,
    targetId: entry.targetId ?? tilemapDefinitionIdForScenario(entry),
    artifacts: entry.artifacts ?? [...(entry.tests ?? []), ...(entry.docs ?? [])],
    tests: entry.tests ?? [],
    docs: entry.docs ?? [],
    covers: entry.covers ?? [],
    ci: entry.ci ?? false,
    launch: game => game.levels.switchLevel(tilemapDefinitionIdForScenario(entry))
  }));
}

function registerGymScenario(gym) {
  const sceneId = gym.sceneId ?? gym.composition?.stack?.[0]?.scene;
  const targetId = gym.targetId ?? sceneId ?? tilemapDefinitionIdForScenario(gym);
  return registry.register(defineScenarioEntry({
    ...gym,
    source: 'gyms',
    targetId,
    artifacts: gym.artifacts ?? [...(gym.tests ?? []), ...(gym.docs ?? [])],
    tests: gym.tests ?? gym.artifacts?.filter(artifact => artifact.startsWith('tests/')) ?? [],
    docs: gym.docs ?? [],
    covers: gym.covers ?? [],
    ci: gym.ci ?? true,
    composition: gym.composition ?? {
      type: 'executable-gym',
      stack: [{ scene: sceneId, props: { gymId: gym.id } }]
    },
    launch: game => {
      if (gym.composition?.type === 'tilemap-gameplay') return game.levels.switchLevel(tilemapDefinitionIdForScenario(gym));
      return game.runtime?.scenes?.switchScene?.(sceneId) ?? { ok: false, reason: 'missing-scene-host', level: game.level };
    }
  }));
}

const deprecatedScenarioIds = new Set(['legacy-movement-lab', 'legacy-hazard-lab', 'legacy-enemy-zoo', 'gate-lab']);

export const registeredTilemapScenarios = getAllTilemapLevelDefinitions()
  .filter(definition => !definition.id.endsWith('-map') && !deprecatedScenarioIds.has(definition.id))
  .map(registerTilemapLevelDefinition);
export const registeredGymScenarios = getAllGyms().map(registerGymScenario);
export const registeredZooScenarios = getAllZooScenarios()
  .filter(zoo => zoo.id !== 'legacy-enemy-zoo')
  .map(zoo => registerSourceScenario(zoo, 'zoos'));

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
  if (composition?.stack?.length && game.sceneLibrary && game.runtime?.scenes?.replaceStack) {
    const tilemapDefinitionId = composition.type === 'tilemap-gameplay' ? tilemapDefinitionIdForScenario(entry) : null;
    const levelResult = tilemapDefinitionId ? game.levels?.switchLevel?.(tilemapDefinitionId) : { ok: true };
    if (levelResult && levelResult.ok === false) return { entry, ...levelResult };

    const { resolveSceneComposition } = game.sceneLibrary;
    const resolved = typeof resolveSceneComposition === 'function'
      ? resolveSceneComposition(game.sceneLibrary, game, composition)
      : null;
    if (resolved?.ok === false) return { entry, ...resolved };
    const scenes = resolved?.scenes;
    if (scenes?.length) {
      const stack = game.runtime.scenes.replaceStack(scenes);
      return { ok: true, reason: null, entry, level: levelResult?.level ?? game.level, stack };
    }
  }

  const result = entry.launch?.(game);
  return result && typeof result === 'object' ? { entry, ...result } : { ok: true, entry, result };
}
