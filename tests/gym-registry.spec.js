import { expect, test } from '@playwright/test';
import { getAllGyms, getGymById } from '#/content/gyms/registry.js';

test('registered gyms are in-engine machine-based tilemap scenarios', () => {
  expect(getAllGyms().map(gym => gym.id)).toEqual(['movement-gym']);
  expect(getGymById('movement-gym')).toMatchObject({
    id: 'movement-gym',
    source: 'gyms',
    visibility: 'developer',
    composition: { type: 'tilemap-gameplay' },
    machinePolicy: { autoStart: true },
    ci: true
  });
  expect(getGymById('movement-gym').machines).toEqual([
    expect.objectContaining({
      id: 'movement.run-max-speed',
      authority: 'input',
      validates: expect.arrayContaining(['movement.input', 'movement.physics'])
    })
  ]);
  expect(getGymById('ui-navigation-gym')).toBeNull();
});
