import { expect, test } from '@playwright/test';
import {
  act01Level1TilemapLevelDefinition,
  getAllTilemapLevelDefinitions,
  getDefaultTilemapLevelDefinition,
  getTilemapLevelDefinitionById,
  legacyMovementLabTilemapLevelDefinition
} from '../src/tilemaps/registry.js';

test('tilemap registry owns parsed tilemap level definitions', () => {
  expect(getDefaultTilemapLevelDefinition()).toBe(act01Level1TilemapLevelDefinition);
  expect(getTilemapLevelDefinitionById('act-01-level-1')).toBe(act01Level1TilemapLevelDefinition);
  expect(getTilemapLevelDefinitionById('legacy-movement-lab')).toBe(legacyMovementLabTilemapLevelDefinition);
  expect(getAllTilemapLevelDefinitions().map(definition => definition.id)).toEqual([
    'act-01-level-1',
    'legacy-movement-lab',
    'legacy-hazard-lab',
    'legacy-enemy-zoo',
    'gate-lab'
  ]);
});

test('tilemap definitions are explicit assets rather than launch scenarios', () => {
  for (const definition of getAllTilemapLevelDefinitions()) {
    expect(definition).toMatchObject({
      kind: 'tilemap-level',
      tileSize: expect.any(Number),
      cols: expect.any(Number),
      rows: expect.any(Number),
      tiles: expect.any(Object)
    });
  }
});
