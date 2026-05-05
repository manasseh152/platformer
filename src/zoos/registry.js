import { createCatalogRegistry } from '../catalog/registry.js';
import { legacyEnemyZooScenario } from './legacy-enemy-zoo.js';

function assertZooScenario(scenario) {
  if (scenario.source !== 'zoos') throw new Error(`${scenario.id} must use zoos source`);
  if (!scenario.composition?.stack?.length) throw new Error(`${scenario.id} must define a composition stack`);
}

const registry = createCatalogRegistry({
  name: 'zoos',
  allowedKinds: ['zoo-scenario'],
  validateEntry: assertZooScenario
});

export const legacyEnemyZoo = registry.register(legacyEnemyZooScenario);
export const zooScenarios = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getZooScenarioById(id) {
  return registry.getById(id);
}

export function getAllZooScenarios() {
  return registry.getAll();
}
