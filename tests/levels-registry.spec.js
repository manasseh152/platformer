import { expect, test } from '@playwright/test';
import {
  getAllScenarioEntries,
  getScenarioEntryById,
  getVisibleScenarioEntries,
  scenarioEntries
} from '../src/scenarios/registry.js';

test('scenario registry is a curated selectable catalog over multiple sources', () => {
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
  expect(getAllScenarioEntries().every(entry => entry.composition?.stack?.length)).toBe(true);
  expect(getAllScenarioEntries().every(entry => entry.launch === undefined)).toBe(true);
});

test('scenario registry filters visibility independent of source catalog', () => {
  expect(getVisibleScenarioEntries({ developerMode: false }).map(entry => entry.id)).toEqual(['act-01-level-1']);
  expect(getVisibleScenarioEntries({ developerMode: true }).map(entry => entry.id)).toEqual([
    'act-01-level-1',
    'movement-gym',
    'hazard-gym',
    'finish-gate-gym',
    'ui-navigation-gym',
    'enemy-zoo'
  ]);
});
