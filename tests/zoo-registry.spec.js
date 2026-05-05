import { expect, test } from '@playwright/test';
import { getAllZooScenarios, getZooScenarioById } from '../src/zoos/registry.js';

test('zoo scenarios document composed examples and default out of CI', () => {
  expect(getZooScenarioById('enemy-zoo')).toMatchObject({
    id: 'enemy-zoo',
    source: 'zoos',
    visibility: 'developer',
    composition: { type: 'tilemap-gameplay' },
    covers: ['enemy.composition-showcase', 'enemy.patrol-variety'],
    ci: false
  });
  expect(getAllZooScenarios().map(zoo => zoo.id)).toEqual(['enemy-zoo']);
});
