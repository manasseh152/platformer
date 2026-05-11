import { expect, test } from '@playwright/test';
import {
  act01Level1Tilemap,
  act01Level2Tilemap,
  act01Level3Tilemap,
  getAllTilemaps,
  getDefaultTilemap,
  getTilemapById,
  movementGymMapTilemap,
  renderingGymMapTilemap
} from '#/content/tilemaps/registry.js';

test('tilemap registry owns parsed tilemap level definitions', () => {
  expect(getDefaultTilemap()).toBe(act01Level1Tilemap);
  expect(getTilemapById('act-01-level-1')).toBe(act01Level1Tilemap);
  expect(getTilemapById('act-01-level-2')).toBe(act01Level2Tilemap);
  expect(getTilemapById('act-01-level-3')).toBe(act01Level3Tilemap);
  expect(getTilemapById('movement-gym-map')).toBe(movementGymMapTilemap);
  expect(getTilemapById('rendering-gym-map')).toBe(renderingGymMapTilemap);
  expect(getAllTilemaps().map(definition => definition.id)).toEqual([
    'act-01-level-1',
    'act-01-level-2',
    'act-01-level-3',
    'movement-gym-map',
    'rendering-gym-map',
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
