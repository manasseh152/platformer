import { expect, test } from '@playwright/test';
import {
  act01Level1TilemapScene,
  getAllTilemapScenes,
  getDefaultTilemapScene,
  getTilemapSceneById,
  movementGymMapTilemapScene
} from '../src/content/tilemaps/registry.js';

test('tilemap registry owns parsed tilemap level definitions', () => {
  expect(getDefaultTilemapScene()).toBe(act01Level1TilemapScene);
  expect(getTilemapSceneById('act-01-level-1')).toBe(act01Level1TilemapScene);
  expect(getTilemapSceneById('movement-gym-map')).toBe(movementGymMapTilemapScene);
  expect(getAllTilemapScenes().map(definition => definition.id)).toEqual([
    'act-01-level-1',
    'movement-gym-map',
    'finish-gate-gym-map',
    'enemy-zoo-map'
  ]);
});

test('tilemap definitions are explicit assets rather than launch scenarios', () => {
  for (const definition of getAllTilemapScenes()) {
    expect(definition).toMatchObject({
      tileSize: expect.any(Number),
      cols: expect.any(Number),
      rows: expect.any(Number),
      tiles: expect.any(Object)
    });
    expect(definition.kind).toBe('tilemap-scene');
  }
});
