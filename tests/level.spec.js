import { expect, test } from '@playwright/test';
import { createEnemies, level, parseTilemap, tileRect, tileToWorld, worldToTile } from '../src/level.js';

test('level exposes world dimensions derived from tile dimensions', () => {
  expect(level.worldWidth).toBe(level.cols * level.tileSize);
  expect(level.worldHeight).toBe(level.rows * level.tileSize);
});

test('tile helpers convert between tile and world coordinates', () => {
  expect(tileToWorld(3, 2)).toEqual({ x: 210, y: 140 });
  expect(worldToTile(219, 141)).toEqual({ col: 3, row: 2 });
  expect(tileRect(2, 4, 3, 1)).toMatchObject({ x: 140, y: 280, w: 210, h: 70 });
});

test('tilemap parser derives gameplay structures from layered ASCII rows', () => {
  const parsed = parseTilemap({
    terrainRows: [
      '#####',
      '#...#',
      '#...#',
      '#==^#',
      '#####'
    ],
    objectRows: [
      '.....',
      '...G.',
      '.PE..',
      '.....',
      '.....'
    ],
    decorRows: [
      '.....',
      '.r.t.',
      '.....',
      '.....',
      '.....'
    ]
  });

  expect(parsed.cols).toBe(5);
  expect(parsed.rows).toBe(5);
  expect(parsed.spawn).toEqual({ x: 88, y: 160 });
  expect(parsed.goal).toMatchObject({ x: 210, y: 70, w: 70, h: 70, kind: 'gate' });
  expect(parsed.spikes).toHaveLength(1);
  expect(parsed.decor).toEqual([
    { type: 'bannerRed', col: 1, row: 1 },
    { type: 'torch', col: 3, row: 1 }
  ]);
  expect(parsed.enemySpawns).toHaveLength(1);
  expect(parsed.platforms.some(p => p.x === 70 && p.y === 210 && p.w === 140 && p.kind === 'stone-ledge')).toBe(true);
});

test('tilemap parser rejects invalid layers and missing required markers', () => {
  const valid = {
    terrainRows: ['###', '#.#', '###'],
    objectRows: ['...', '.P.', '.G.'],
    decorRows: ['...', '...', '...']
  };

  expect(() => parseTilemap({ ...valid, objectRows: ['...', '.P.'] })).toThrow(/objectRows must contain 3 rows/);
  expect(() => parseTilemap({ ...valid, terrainRows: ['###', '#x#', '###'] })).toThrow(/unknown tile/);
  expect(() => parseTilemap({ ...valid, objectRows: ['...', '...', '.G.'] })).toThrow(/player spawn/);
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
