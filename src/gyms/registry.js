import { uiNavigationGym } from './ui-navigation-gym.js';

export const gyms = {
  [uiNavigationGym.id]: uiNavigationGym
};

export function getGymById(id) {
  return gyms[id] ?? null;
}

export function getAllGyms() {
  return Object.values(gyms);
}
