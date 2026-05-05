import { assertCatalog } from '../catalog/metadata.js';
import { uiNavigationGym } from './ui-navigation-gym.js';

export const gyms = {
  [uiNavigationGym.id]: uiNavigationGym
};

function assertGym(gym) {
  if (typeof gym.sceneId !== 'string' || !gym.sceneId.trim()) throw new Error(`${gym.id} must have a sceneId`);
  if (!Array.isArray(gym.artifacts) || gym.artifacts.some(artifact => typeof artifact !== 'string')) throw new Error(`${gym.id} artifacts must be strings`);
}

assertCatalog(Object.values(gyms), { allowedKinds: ['executable-gym'] });
Object.values(gyms).forEach(assertGym);

export function getGymById(id) {
  return gyms[id] ?? null;
}

export function getAllGyms() {
  return Object.values(gyms);
}
