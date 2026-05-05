// Deprecated adapter. Level Select currently consumes scenario entries until ScenarioBrowserScene lands.
import {
  defineScenarioEntry,
  scenarioEntries,
  getScenarioEntryById,
  getAllScenarioEntries,
  getVisibleScenarioEntries,
  launchScenarioEntry
} from '../scenarios/registry.js';

export const defineLevelEntry = defineScenarioEntry;
export const levelEntries = scenarioEntries;

export const act01Level1Entry = getScenarioEntryById('act-01-level-1');
export const legacyMovementLabEntry = getScenarioEntryById('legacy-movement-lab');
export const legacyHazardLabEntry = getScenarioEntryById('legacy-hazard-lab');
export const legacyEnemyZooEntry = getScenarioEntryById('legacy-enemy-zoo');
export const gateLabEntry = getScenarioEntryById('gate-lab');

export function getLevelEntryById(id) {
  return getScenarioEntryById(id);
}

export function getAllLevelEntries() {
  return getAllScenarioEntries();
}

export function getVisibleLevelEntries(options = {}) {
  return getVisibleScenarioEntries(options);
}

export function launchLevelEntry(game, entryId) {
  return launchScenarioEntry(game, entryId);
}
