import {
  defineSceneEntry,
  sceneEntries,
  getSceneEntryById,
  getAllSceneEntries,
  getVisibleSceneEntries,
  launchSceneEntry
} from '../scenes/registry.js';

export const defineLevelEntry = defineSceneEntry;
export const levelEntries = sceneEntries;

export const act01Level1Entry = getSceneEntryById('act-01-level-1');
export const legacyMovementLabEntry = getSceneEntryById('legacy-movement-lab');
export const legacyHazardLabEntry = getSceneEntryById('legacy-hazard-lab');
export const legacyEnemyZooEntry = getSceneEntryById('legacy-enemy-zoo');
export const gateLabEntry = getSceneEntryById('gate-lab');

export function getLevelEntryById(id) {
  return getSceneEntryById(id);
}

export function getAllLevelEntries() {
  return getAllSceneEntries();
}

export function getVisibleLevelEntries(options = {}) {
  return getVisibleSceneEntries(options);
}

export function launchLevelEntry(game, entryId) {
  return launchSceneEntry(game, entryId);
}
