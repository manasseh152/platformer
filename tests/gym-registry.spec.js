import { expect, test } from '@playwright/test';
import { getAllGyms, getGymById } from '../src/gyms/registry.js';

test('executable gyms use shared catalog metadata conventions', () => {
  expect(getGymById('ui-navigation-gym')).toMatchObject({
    id: 'ui-navigation-gym',
    name: 'UI Navigation Gym',
    kind: 'executable-gym',
    categories: ['gyms'],
    sceneId: 'level',
    visibility: 'developer'
  });
  expect(getGymById('ui-navigation')).toBeNull();
  expect(getAllGyms().map(gym => gym.id)).toContain('ui-navigation-gym');
});
