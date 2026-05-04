import { expect, test } from '@playwright/test';
import {
  createEnemies,
  createEnemySpawns,
  forEachLayerTile,
  getDecorType,
  getGoalRect,
  getSpawnPoint,
  level,
  parseTilemap,
  solidTileRectsOverlapping,
  spikeHazardRectsOverlapping,
  tileRect,
  tileToWorld,
  worldToTile
} from '../src/level.js';

test('level exposes world dimensions derived from tile dimensions', () => {
  expect(level.worldWidth).toBe(level.cols * level.tileSize);
  expect(level.worldHeight).toBe(level.rows * level.tileSize);
});

test('tile helpers convert between tile and world coordinates', () => {
  expect(tileToWorld(3, 2)).toEqual({ x: 210, y: 140 });
  expect(worldToTile(219, 141)).toEqual({ col: 3, row: 2 });
  expect(tileRect(2, 4, 3, 1)).toMatchObject({ x: 140, y: 280, w: 210, h: 70 });
});

test('tilemap parser exposes layered tiles and direct query helpers derive gameplay data', () => {
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

  const decor = [];
  forEachLayerTile(parsed, 'decor', (tile, col, row) => {
    const type = getDecorType(tile);
    if (type) decor.push({ type, col, row });
  });

  expect(parsed.cols).toBe(5);
  expect(parsed.rows).toBe(5);
  expect(getSpawnPoint(parsed)).toEqual({ x: 88, y: 160 });
  expect(getGoalRect(parsed)).toMatchObject({ x: 210, y: 70, w: 70, h: 70, kind: 'gate' });
  expect(spikeHazardRectsOverlapping(parsed, { x: 210, y: 210, w: 70, h: 70 })).toHaveLength(1);
  expect(decor).toEqual([
    { type: 'bannerRed', col: 1, row: 1 },
    { type: 'torch', col: 3, row: 1 }
  ]);
  expect(createEnemySpawns(parsed)).toHaveLength(1);
  expect(solidTileRectsOverlapping(parsed, { x: 70, y: 210, w: 140, h: 70 })).toEqual(expect.arrayContaining([
    expect.objectContaining({ x: 70, y: 210, w: 70, h: 70 }),
    expect.objectContaining({ x: 140, y: 210, w: 70, h: 70 })
  ]));
});

test('tilemap supports block tiles and three-tile gates', () => {
  const parsed = parseTilemap({
    terrainRows: [
      '#####',
      '#...#',
      '#BBB#',
      '#...#',
      '#####'
    ],
    objectRows: [
      '.....',
      '.<G>.',
      '.....',
      '.P...',
      '.....'
    ],
    decorRows: [
      '.....',
      '.....',
      '.....',
      '.....',
      '.....'
    ]
  });

  expect(getGoalRect(parsed)).toMatchObject({ x: 70, y: 70, w: 210, h: 70, cols: 3 });
  expect(solidTileRectsOverlapping(parsed, { x: 140, y: 140, w: 70, h: 70 })).toEqual([
    expect.objectContaining({ x: 140, y: 140, w: 70, h: 70 })
  ]);
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

test('enemy runtime state is cloned from tilemap-owned enemy definitions', () => {
  const customLevel = parseTilemap({
    terrainRows: [
      '#####',
      '#...#',
      '#...#',
      '#==.#',
      '#####'
    ],
    objectRows: [
      '.....',
      '.G...',
      '.PE..',
      '.....',
      '.....'
    ],
    decorRows: [
      '.....',
      '.....',
      '.....',
      '.....',
      '.....'
    ]
  });

  const enemies = createEnemies(customLevel);
  enemies[0].hp = 0;

  expect(createEnemies(customLevel)[0].hp).toBe(2);
});
