import { expect, test } from '@playwright/test';
import { getScenarioEntryById, getVisibleScenarioEntries, scenarioEntries } from '../src/catalog/scenarios/registry.js';

test('runtime scene registry adapter has been removed; scenarios are canonical', () => {
  expect(getScenarioEntryById('act-01-level-1')).toMatchObject({
    id: 'act-01-level-1',
    source: 'campaigns',
    visibility: 'public'
  });
  expect(getScenarioEntryById('movement-gym')).toMatchObject({
    source: 'gyms',
    categories: ['movement'],
    visibility: 'developer'
  });
  expect(Object.keys(scenarioEntries)).toContain('movement-gym');
});

test('scenario registry filters developer-only scenarios', () => {
  expect(getVisibleScenarioEntries({ developerMode: false }).map(entry => entry.id)).toEqual(['act-01-level-1', 'act-01-level-2']);
  expect(getVisibleScenarioEntries({ developerMode: true }).map(entry => entry.id)).toContain('movement-gym');
});
