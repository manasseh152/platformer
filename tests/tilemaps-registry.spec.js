import { expect, test } from '@playwright/test';
import {
  act01Level1TilemapLevelDefinition,
  getAllTilemapLevelDefinitions,
  getDefaultTilemapLevelDefinition,
  getTilemapLevelDefinitionById,
  movementGymMapTilemapLevelDefinition
} from '../src/core/tilemaps/registry.js';

test('tilemap registry owns parsed tilemap level definitions', () => {
  expect(getDefaultTilemapLevelDefinition()).toBe(act01Level1TilemapLevelDefinition);
  expect(getTilemapLevelDefinitionById('act-01-level-1')).toBe(act01Level1TilemapLevelDefinition);
  expect(getTilemapLevelDefinitionById('movement-gym-map')).toBe(movementGymMapTilemapLevelDefinition);
  expect(getAllTilemapLevelDefinitions().map(definition => definition.id)).toEqual([
    'act-01-level-1',
    'movement-gym-map',
    'hazard-gym-map',
    'finish-gate-gym-map',
    'enemy-zoo-map'
  ]);
});

test('tilemap definitions are explicit assets rather than launch scenarios', () => {
  for (const definition of getAllTilemapLevelDefinitions()) {
    expect(definition).toMatchObject({
      tileSize: expect.any(Number),
      cols: expect.any(Number),
      rows: expect.any(Number),
      tiles: expect.any(Object)
    });
    expect(definition.kind).toBeUndefined();
  }
});
