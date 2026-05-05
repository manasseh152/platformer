// Deprecated adapter. Launchable catalog entries are scenarios; runtime scenes live in src/scenes/*.
export {
  defineScenarioEntry as defineSceneEntry,
  registeredTilemapScenarios as registeredCampaignScenes,
  registeredGymScenarios,
  scenarioEntries as sceneEntries,
  getScenarioEntryById as getSceneEntryById,
  getAllScenarioEntries as getAllSceneEntries,
  getVisibleScenarioEntries as getVisibleSceneEntries,
  launchScenarioEntry as launchSceneEntry
} from '../scenarios/registry.js';
