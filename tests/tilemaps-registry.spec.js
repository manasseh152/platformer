import { expect, test } from '@playwright/test';
import {
  act01Level1Tilemap,
  getAllTilemaps,
  getDefaultTilemap,
  getTilemapById,
  movementGymMapTilemap
} from '../src/content/tilemaps/registry.js';

test('tilemap registry owns parsed tilemap level definitions', () => {
  expect(getDefaultTilemap()).toBe(act01Level1Tilemap);
  expect(getTilemapById('act-01-level-1')).toBe(act01Level1Tilemap);
  expect(getTilemapById('movement-gym-map')).toBe(movementGymMapTilemap);
  expect(getAllTilemaps().map(definition => definition.id)).toEqual([
    'act-01-level-1',
    'movement-gym-map',
    'finish-gate-gym-map',
    'enemy-zoo-map'
  ]);
});

test('tilemap definitions are explicit assets rather than launch scenarios', () => {
  for (const definition of getAllTilemaps()) {
    expect(definition).toMatchObject({
      tileSize: expect.any(Number),
      cols: expect.any(Number),
      rows: expect.any(Number),
      tiles: expect.any(Object)
    });
    expect(definition.kind).toBe('tilemap');
  }
});
