import { expect, test } from '@playwright/test';
import { getSceneEntryById, getVisibleSceneEntries, sceneEntries } from '../src/scenes/registry.js';

test('deprecated scene registry adapter exposes scenario entries', () => {
  expect(getSceneEntryById('act-01-level-1')).toMatchObject({
    source: 'campaigns',
    targetId: 'act-01-level-1',
    kind: 'tilemap-level',
    visibility: 'public'
  });
  expect(getSceneEntryById('ui-navigation-gym')).toMatchObject({
    source: 'gyms',
    targetId: 'level',
    kind: 'gym-scenario',
    categories: ['ui'],
    visibility: 'developer',
    composition: { type: 'executable-gym' }
  });
  expect(Object.keys(sceneEntries)).toEqual(expect.arrayContaining(['movement-gym', 'ui-navigation-gym']));
});

test('deprecated scene registry adapter filters developer-only scenarios', () => {
  expect(getVisibleSceneEntries({ developerMode: false }).map(entry => entry.id)).toEqual(['act-01-level-1']);
  expect(getVisibleSceneEntries({ developerMode: true }).map(entry => entry.id)).toEqual([
    'act-01-level-1',
    'movement-gym',
    'hazard-gym',
    'finish-gate-gym',
    'ui-navigation-gym',
    'enemy-zoo'
  ]);
});
