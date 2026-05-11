import { expect, test } from '@playwright/test';
import { getAllGyms, getGymById } from '#/content/gyms/registry.js';

test('registered gyms are in-engine machine-based tilemap scenarios', () => {
  expect(getAllGyms().map(gym => gym.id)).toEqual(['movement-gym', 'rendering-gym']);
  expect(getGymById('movement-gym')).toMatchObject({
    id: 'movement-gym',
    source: 'gyms',
    visibility: 'developer',
    composition: { type: 'tilemap-gameplay' },
    machinePolicy: { autoStart: true },
    ci: true
  });
  expect(getGymById('movement-gym').machines).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: 'movement.run-max-speed',
      authority: 'input',
      validates: expect.arrayContaining(['movement.input', 'movement.physics'])
    })
  ]));
  expect(getGymById('rendering-gym')).toMatchObject({
    id: 'rendering-gym',
    source: 'gyms',
    visibility: 'developer',
    composition: { type: 'tilemap-gameplay' },
    machinePolicy: { autoStart: true },
    ci: true
  });
  expect(getGymById('rendering-gym').machines).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: 'rendering.actor-state-fixture',
      authority: 'state-fixture',
      validates: expect.arrayContaining(['rendering.actor-states'])
    }),
    expect.objectContaining({
      id: 'rendering.read-model-actors',
      authority: 'observer',
      validates: expect.arrayContaining(['rendering.read-model'])
    })
  ]));
  expect(getGymById('ui-navigation-gym')).toBeNull();
});
