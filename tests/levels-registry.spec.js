import { expect, test } from '@playwright/test';
import {
  getAllLevelEntries,
  getLevelEntryById,
  getVisibleLevelEntries,
  levelEntries
} from '../src/levels/registry.js';

test('levels registry is a curated selectable catalog over multiple sources', () => {
  expect(getLevelEntryById('act-01-level-1')).toMatchObject({
    id: 'act-01-level-1',
    source: 'campaigns',
    targetId: 'act-01-level-1',
    kind: 'tilemap-level',
    visibility: 'public'
  });
  expect(getLevelEntryById('movement-gym')).toMatchObject({
    source: 'gyms',
    targetId: 'movement-gym-map',
    kind: 'gym-scenario',
    categories: ['movement'],
    visibility: 'developer'
  });
  expect(Object.keys(levelEntries)).toContain('movement-gym');
  expect(getAllLevelEntries().every(entry => typeof entry.launch === 'function')).toBe(true);
});

test('levels registry filters visibility independent of source catalog', () => {
  expect(getVisibleLevelEntries({ developerMode: false }).map(entry => entry.id)).toEqual(['act-01-level-1']);
  expect(getVisibleLevelEntries({ developerMode: true }).map(entry => entry.id)).toEqual([
    'act-01-level-1',
    'movement-gym',
    'hazard-gym',
    'finish-gate-gym',
    'ui-navigation-gym',
    'enemy-zoo'
  ]);
});
