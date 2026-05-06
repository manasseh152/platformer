import { createCatalogRegistry } from '../../catalog/registry.js';
import { enemyZooScenario } from './enemy-zoo.js';

function assertZooScenario(scenario) {
  if (scenario.source !== 'zoos') throw new Error(`${scenario.id} must use zoos source`);
  if (!scenario.composition?.stack?.length) throw new Error(`${scenario.id} must define a composition stack`);
}

const registry = createCatalogRegistry({
  name: 'zoos',
  validateEntry: assertZooScenario
});

export const enemyZoo = registry.register(enemyZooScenario);
export const zooScenarios = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getZooScenarioById(id) {
  return registry.getById(id);
}

export function getAllZooScenarios() {
  return registry.getAll();
}
