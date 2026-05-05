import { expect, test } from '@playwright/test';
import { getAllGyms, getGymById } from '../src/core/gyms/registry.js';

test('gym scenarios use shared scenario metadata conventions', () => {
  expect(getGymById('ui-navigation-gym')).toMatchObject({
    id: 'ui-navigation-gym',
    name: 'UI Navigation Gym',
    source: 'gyms',
    categories: ['ui'],
    visibility: 'developer',
    composition: { type: 'executable-gym' },
    tests: ['tests/gyms/ui-navigation.gym.spec.js'],
    ci: true
  });
  expect(getGymById('ui-navigation')).toBeNull();
  expect(getAllGyms().map(gym => gym.id)).toContain('ui-navigation-gym');
});
