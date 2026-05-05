import { expect, test } from '@playwright/test';
import { getSceneEntryById, getVisibleSceneEntries, sceneEntries } from '../src/scenes/registry.js';

test('scene registry composes campaign levels and executable developer gyms', () => {
  expect(getSceneEntryById('act-01-level-1')).toMatchObject({
    source: 'campaign',
    targetId: 'act-01-level-1',
    kind: 'tilemap-level',
    visibility: 'public'
  });
  expect(getSceneEntryById('ui-navigation-gym')).toMatchObject({
    source: 'gyms',
    targetId: 'level',
    kind: 'executable-gym',
    categories: ['gyms'],
    visibility: 'developer'
  });
  expect(Object.keys(sceneEntries)).toEqual(expect.arrayContaining(['gate-lab', 'ui-navigation-gym']));
});

test('scene registry filters developer-only gyms and zoos with campaign scenes', () => {
  expect(getVisibleSceneEntries({ developerMode: false }).map(entry => entry.id)).toEqual(['act-01-level-1']);
  expect(getVisibleSceneEntries({ developerMode: true }).map(entry => entry.id)).toEqual([
    'act-01-level-1',
    'legacy-movement-lab',
    'legacy-hazard-lab',
    'legacy-enemy-zoo',
    'gate-lab',
    'ui-navigation-gym'
  ]);
});
