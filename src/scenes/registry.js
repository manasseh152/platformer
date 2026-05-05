import { createCatalogRegistry } from '../catalog/registry.js';
import { getAllLevels, getLevelById } from '../campaign/registry.js';
import { isVisibleToMode } from '../categories/registry.js';
import { getAllGyms } from '../gyms/registry.js';

function assertSceneEntry(entry) {
  if (typeof entry.source !== 'string' || !entry.source.trim()) throw new Error(`${entry.id} must have a source`);
  if (typeof entry.targetId !== 'string' || !entry.targetId.trim()) throw new Error(`${entry.id} must have a targetId`);
  if (typeof entry.launch !== 'function') throw new Error(`${entry.id} must have a launch function`);
}

export function defineSceneEntry(entry) {
  return { ...entry };
}

const registry = createCatalogRegistry({
  name: 'scenes',
  allowedKinds: ['tilemap-level', 'executable-gym', 'scene'],
  validateEntry: assertSceneEntry
});

function registerCampaignLevel(level) {
  if (!getLevelById(level.id)) throw new Error(`${level.id} targets missing campaign level: ${level.id}`);
  return registry.register(defineSceneEntry({
    id: level.id,
    name: level.name,
    kind: level.kind,
    categories: level.categories,
    visibility: level.visibility,
    description: level.description,
    source: 'campaign',
    targetId: level.id,
    launch: game => game.levels.switchLevel(level.id)
  }));
}

function registerExecutableGym(gym) {
  return registry.register(defineSceneEntry({
    id: gym.id,
    name: gym.name,
    kind: gym.kind,
    categories: gym.categories,
    visibility: gym.visibility,
    description: gym.description,
    source: 'gyms',
    targetId: gym.sceneId,
    artifacts: gym.artifacts,
    launch: game => game.runtime?.scenes?.switchScene?.(gym.sceneId) ?? { ok: false, reason: 'missing-scene-host', level: game.level }
  }));
}

export const registeredCampaignScenes = getAllLevels().map(registerCampaignLevel);
export const registeredGymScenes = getAllGyms().map(registerExecutableGym);

export const sceneEntries = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getSceneEntryById(id) {
  return registry.getById(id);
}

export function getAllSceneEntries() {
  return registry.getAll();
}

export function getVisibleSceneEntries({ developerMode = false } = {}) {
  return getAllSceneEntries().filter(entry => isVisibleToMode(entry, developerMode));
}

export function launchSceneEntry(game, entryId) {
  const entry = getSceneEntryById(entryId);
  if (!entry) return { ok: false, reason: 'missing-scene-entry', entry: null };
  const result = entry.launch(game);
  return result && typeof result === 'object' ? { entry, ...result } : { ok: true, entry, result };
}
