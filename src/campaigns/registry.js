import { createCatalogRegistry } from '../catalog/registry.js';
import { act01Level1Scenario } from './act-01-level-1.js';

function assertScenario(scenario) {
  if (scenario.source !== 'campaigns') throw new Error(`${scenario.id} must use campaigns source`);
  if (!scenario.composition?.stack?.length) throw new Error(`${scenario.id} must define a composition stack`);
}

const registry = createCatalogRegistry({
  name: 'campaigns',
  allowedKinds: ['campaign-scenario'],
  validateEntry: assertScenario
});

export const act01Level1 = registry.register(act01Level1Scenario);
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
