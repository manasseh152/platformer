import { createCatalogRegistry } from '../catalog/registry.js';
import { uiNavigationGym } from './ui-navigation-gym.js';
import { movementGymScenario } from './movement-gym.js';
import { finishGateGymScenario } from './finish-gate-gym.js';

function assertGymScenario(gym) {
  if (gym.source !== 'gyms') throw new Error(`${gym.id} must use gyms source`);
  if (!gym.composition?.stack?.length) throw new Error(`${gym.id} must define a composition stack`);
  if (!Array.isArray(gym.tests) || gym.tests.some(test => typeof test !== 'string')) throw new Error(`${gym.id} tests must be strings`);
  if (!Array.isArray(gym.docs) || gym.docs.some(doc => typeof doc !== 'string')) throw new Error(`${gym.id} docs must be strings`);
  if (!Array.isArray(gym.covers) || gym.covers.some(cover => typeof cover !== 'string')) throw new Error(`${gym.id} covers must be strings`);
}

const registry = createCatalogRegistry({
  name: 'gyms',
  validateEntry: assertGymScenario
});

export const movementGym = registry.register(movementGymScenario);
export const finishGateGym = registry.register(finishGateGymScenario);
export const registeredUiNavigationGym = registry.register(uiNavigationGym);
export const gyms = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getGymById(id) {
  return registry.getById(id);
}

export function getAllGyms() {
  return registry.getAll();
}
