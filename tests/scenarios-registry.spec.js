import { expect, test } from '@playwright/test';
import { getScenarioEntryById, getVisibleScenarioEntries, scenarioEntries } from '../src/scenarios/registry.js';

test('scenario registry composes tilemap definitions and executable gyms', () => {
  expect(getScenarioEntryById('act-01-level-1')).toMatchObject({
    id: 'act-01-level-1',
    source: 'campaign',
    targetId: 'act-01-level-1',
    composition: {
      type: 'tilemap-gameplay',
      stack: [expect.objectContaining({ scene: 'gameplay' })]
    },
    visibility: 'public'
  });
  expect(getScenarioEntryById('legacy-movement-lab')).toMatchObject({
    source: 'gyms',
    targetId: 'legacy-movement-lab',
    composition: { type: 'tilemap-gameplay' }
  });
  expect(getScenarioEntryById('enemy-zoo')).toMatchObject({
    source: 'zoos',
    targetId: 'enemy-zoo-map',
    composition: { type: 'tilemap-gameplay' },
    ci: false
  });
  expect(getScenarioEntryById('legacy-enemy-zoo')).toMatchObject({
    source: 'zoos',
    targetId: 'legacy-enemy-zoo',
    composition: { type: 'tilemap-gameplay' }
  });
  expect(getScenarioEntryById('ui-navigation-gym')).toMatchObject({
    source: 'gyms',
    targetId: 'level',
    composition: { type: 'executable-gym' },
    ci: true
  });
  expect(Object.keys(scenarioEntries)).toEqual(expect.arrayContaining(['gate-lab', 'ui-navigation-gym']));
});

test('scenario registry filters developer scenarios', () => {
  expect(getVisibleScenarioEntries({ developerMode: false }).map(entry => entry.id)).toEqual(['act-01-level-1']);
  expect(getVisibleScenarioEntries({ developerMode: true }).map(entry => entry.id)).toEqual([
    'act-01-level-1',
    'legacy-movement-lab',
    'legacy-hazard-lab',
    'legacy-enemy-zoo',
    'gate-lab',
    'movement-gym',
    'hazard-gym',
    'finish-gate-gym',
    'ui-navigation-gym',
    'enemy-zoo'
  ]);
});
