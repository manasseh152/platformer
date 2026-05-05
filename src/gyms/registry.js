import { createCatalogRegistry } from '../catalog/registry.js';
import { uiNavigationGym } from './ui-navigation-gym.js';

function assertGym(gym) {
  if (typeof gym.sceneId !== 'string' || !gym.sceneId.trim()) throw new Error(`${gym.id} must have a sceneId`);
  if (!Array.isArray(gym.artifacts) || gym.artifacts.some(artifact => typeof artifact !== 'string')) throw new Error(`${gym.id} artifacts must be strings`);
}

const registry = createCatalogRegistry({
  name: 'gyms',
  allowedKinds: ['executable-gym'],
  validateEntry: assertGym
});

export const registeredUiNavigationGym = registry.register(uiNavigationGym);
export const gyms = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getGymById(id) {
  return registry.getById(id);
}

export function getAllGyms() {
  return registry.getAll();
}
