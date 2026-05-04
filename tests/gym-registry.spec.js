import { expect, test } from '@playwright/test';
import { getAllGyms, getGymById } from '../src/gyms/registry.js';

test('executable gyms are registered separately from deprecated tilemap test maps', () => {
  expect(getGymById('ui-navigation')).toMatchObject({
    id: 'ui-navigation',
    name: 'UI Navigation Gym',
    kind: 'ui',
    sceneId: 'level',
    developerOnly: true,
    status: 'active'
  });
  expect(getAllGyms().map(gym => gym.id)).toContain('ui-navigation');
});
