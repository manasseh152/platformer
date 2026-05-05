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
    source: 'campaign',
    targetId: 'act-01-level-1',
    kind: 'tilemap-level',
    visibility: 'public'
  });
  expect(getLevelEntryById('legacy-movement-lab')).toMatchObject({
    source: 'gyms',
    targetId: 'legacy-movement-lab',
    categories: ['gyms', 'legacy'],
    visibility: 'developer'
  });
  expect(Object.keys(levelEntries)).toContain('gate-lab');
  expect(getAllLevelEntries().every(entry => typeof entry.launch === 'function')).toBe(true);
});

test('levels registry filters visibility independent of source catalog', () => {
  expect(getVisibleLevelEntries({ developerMode: false }).map(entry => entry.id)).toEqual(['act-01-level-1']);
  expect(getVisibleLevelEntries({ developerMode: true }).map(entry => entry.id)).toEqual([
    'act-01-level-1',
    'legacy-movement-lab',
    'legacy-hazard-lab',
    'legacy-enemy-zoo',
    'gate-lab',
    'ui-navigation-gym'
  ]);
});
