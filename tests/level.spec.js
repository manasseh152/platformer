import { expect, test } from '@playwright/test';
import { createEnemies, level, tileRect, tileToWorld, worldToTile } from '../src/level.js';

test('level exposes world dimensions derived from tile dimensions', () => {
  expect(level.worldWidth).toBe(level.cols * level.tileSize);
  expect(level.worldHeight).toBe(level.rows * level.tileSize);
});

test('tile helpers convert between tile and world coordinates', () => {
  expect(tileToWorld(3, 2)).toEqual({ x: 210, y: 140 });
  expect(worldToTile(219, 141)).toEqual({ col: 3, row: 2 });
  expect(tileRect(2, 4, 3, 1)).toMatchObject({ x: 140, y: 280, w: 210, h: 70 });
});

test('enemy runtime state is cloned from level-owned enemy definitions', () => {
  const customLevel = {
    enemySpawns: [
      { x: 10, y: 20, w: 30, h: 40, vx: 50, hp: 2, hurt: 0, min: 0, max: 100 }
    ]
  };

  const enemies = createEnemies(customLevel);
  enemies[0].hp = 0;

  expect(customLevel.enemySpawns[0].hp).toBe(2);
  expect(createEnemies(customLevel)[0]).toEqual(customLevel.enemySpawns[0]);
});
