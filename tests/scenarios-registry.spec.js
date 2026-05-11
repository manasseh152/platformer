import { expect, test } from '@playwright/test';
import { getScenarioEntryById, getVisibleScenarioEntries, scenarioEntries } from '#/catalog/scenarios/registry.js';

test('scenario registry composes tilemap definitions and executable gyms', () => {
  expect(getScenarioEntryById('act-01-level-1')).toMatchObject({
    id: 'act-01-level-1',
    source: 'campaigns',
    composition: {
      type: 'tilemap-gameplay',
      stack: [expect.objectContaining({ scene: 'gameplay' })]
    },
    visibility: 'public'
  });
  expect(getScenarioEntryById('movement-gym')).toMatchObject({
    source: 'gyms',
    composition: { type: 'tilemap-gameplay' }
  });
  expect(getScenarioEntryById('enemy-zoo')).toMatchObject({
    source: 'zoos',
    composition: { type: 'tilemap-gameplay' },
    ci: false
  });
  expect(getScenarioEntryById('enemy-zoo')).toBeTruthy();
  expect(getScenarioEntryById('ui-navigation-gym')).toBeNull();
  expect(Object.keys(scenarioEntries)).toEqual(expect.arrayContaining(['movement-gym', 'rendering-gym', 'finish-gate-gym']));
});

test('scenario registry filters developer scenarios', () => {
  expect(getVisibleScenarioEntries({ developerMode: false }).map(entry => entry.id)).toEqual(['act-01-level-1', 'act-01-level-2', 'act-01-level-3']);
  expect(getVisibleScenarioEntries({ developerMode: true }).map(entry => entry.id)).toEqual([
    'act-01-level-1',
    'act-01-level-2',
    'act-01-level-3',
    'movement-gym',
    'rendering-gym',
    'finish-gate-gym',
    'enemy-zoo'
  ]);
});
