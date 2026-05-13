import { createCatalogRegistry } from '../../catalog/registry.js';
import { act01Level1Scenario } from './act-01-level-1.js';
import { act01Level2Scenario } from './act-01-level-2.js';
import { act01Level3Scenario } from './act-01-level-3.js';
import { act01Level4Scenario } from './act-01-level-4.js';
import { act01Level5Scenario } from './act-01-level-5.js';
import { act01Level6Scenario } from './act-01-level-6.js';

function assertScenario(scenario) {
  if (scenario.source !== 'campaigns') throw new Error(`${scenario.id} must use campaigns source`);
  if (!scenario.composition?.stack?.length) throw new Error(`${scenario.id} must define a composition stack`);
}

const registry = createCatalogRegistry({
  name: 'campaigns',
  validateEntry: assertScenario
});

export const act01Level1 = registry.register(act01Level1Scenario);
export const act01Level2 = registry.register(act01Level2Scenario);
export const act01Level3 = registry.register(act01Level3Scenario);
export const act01Level4 = registry.register(act01Level4Scenario);
export const act01Level5 = registry.register(act01Level5Scenario);
export const act01Level6 = registry.register(act01Level6Scenario);
export const campaignScenarios = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getCampaignScenarioById(id) {
  return registry.getById(id);
}

export function getAllCampaignScenarios() {
  return registry.getAll();
}

export function getDefaultCampaignScenario() {
  return act01Level1;
}
