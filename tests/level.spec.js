import { expect, test } from '@playwright/test';
import {
  act01Level1TilemapLevelDefinition as level,
  getDefaultTilemapLevelDefinition as getDefaultLevel
} from '../src/tilemaps/registry.js';
import {
  createEnemies,
  createEnemySpawns,
  forEachLayerTile,
  getDecorType,
  getGoalRect,
  getGoalTriggerRect,
  getTile,
  getSpawnPoint,
  isSolidTileAt,
  parseTilemap,
  solidTileRectsOverlapping,
  spikeHazardRectsOverlapping,
  tileRect,
  tileToWorld,
  worldToTile
} from '../src/tilemaps/tilemap.js';
import { resolveInitialLevel } from '../src/level-manager.js';

test('level exposes world dimensions derived from tile dimensions', () => {
  expect(level.worldWidth).toBe(level.cols * level.tileSize);
  expect(level.worldHeight).toBe(level.rows * level.tileSize);
});

test('tile helpers convert between tile and world coordinates', () => {
  expect(tileToWorld(3, 2)).toEqual({ x: 108, y: 72 });
  expect(worldToTile(117, 73)).toEqual({ col: 3, row: 2 });
  expect(tileRect(2, 4, 3, 1)).toMatchObject({ x: 72, y: 144, w: 108, h: 36 });
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
  expect(getTile(parsed, 'backdrop', 2, 2)).toBe('.');
  expect(getSpawnPoint(parsed)).toEqual({ x: 54, y: 58 });
  expect(getGoalRect(parsed)).toMatchObject({ x: 108, y: 36, w: 36, h: 36, kind: 'gate' });
  expect(parsed.artTileSize).toBe(18);
  expect(parsed.artTilesPerTile).toBe(2);
  expect(parsed.theme).toBe('kenney-pixel-platformer:grass');
  expect(parsed.renderLayers.terrainVisuals.filter(visual => visual.col === 1 && visual.row === 3)).toHaveLength(4);
  expect(parsed.renderLayers.terrainPrimitives).toEqual(expect.arrayContaining([
    expect.objectContaining({ col: 1, row: 0, x: 18, y: -18, mask: 12, offsetGrid: true }),
    expect.objectContaining({ col: 2, row: 3, x: 54, y: 90, mask: 12, offsetGrid: true })
  ]));
  expect(spikeHazardRectsOverlapping(parsed, { x: 108, y: 108, w: 36, h: 36 })).toHaveLength(1);
  expect(decor).toEqual([
    { type: 'bannerRed', col: 1, row: 1 },
    { type: 'torch', col: 3, row: 1 }
  ]);
  expect(createEnemySpawns(parsed)).toHaveLength(1);
  expect(solidTileRectsOverlapping(parsed, { x: 36, y: 108, w: 72, h: 36 })).toEqual(expect.arrayContaining([
    expect.objectContaining({ x: 36, y: 108, w: 36, h: 36 }),
    expect.objectContaining({ x: 72, y: 108, w: 36, h: 36 })
  ]));
});

test('initial level resolution ignores URL selection and uses the default level', () => {
  expect(resolveInitialLevel()).toBe(getDefaultLevel());
  expect(resolveInitialLevel({ developerMode: true }, '?level=movement-gym')).toBe(getDefaultLevel());
});

test('default gate is completable from solid support blocks', () => {
  const goal = getGoalRect(level);
  const trigger = getGoalTriggerRect(level);
  for (let col = goal.col; col < goal.col + goal.cols; col++) {
    expect(isSolidTileAt(level, col, goal.row + 1)).toBe(true);
  }
  expect(trigger).toMatchObject({
    x: goal.x - level.tileSize / 2,
    y: goal.y,
    w: goal.w + level.tileSize,
    h: goal.h + level.tileSize,
    kind: 'gate-trigger'
  });
});

test('tilemap can opt into dual-grid collision rects that match offset primitives', () => {
  const parsed = parseTilemap({
    collisionMode: 'dual-grid',
    terrainRows: ['###', '#.#', '###'],
    objectRows: ['...', '.P.', '.G.'],
    decorRows: ['...', '...', '...']
  });

  expect(parsed.collisionMode).toBe('dual-grid');
  expect(solidTileRectsOverlapping(parsed, { x: 16, y: 0, w: 4, h: 4 })).toEqual(expect.arrayContaining([
    expect.objectContaining({ x: 18, y: 0, w: 36, h: 18, kind: 'dual-grid-solid' })
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

  expect(getGoalRect(parsed)).toMatchObject({ x: 36, y: 36, w: 108, h: 36, cols: 3 });
  expect(solidTileRectsOverlapping(parsed, { x: 72, y: 72, w: 36, h: 36 })).toEqual([
    expect.objectContaining({ x: 72, y: 72, w: 36, h: 36 })
  ]);
});

test('tilemap parser supports optional backdrop rows with validation and iteration', () => {
  const parsed = parseTilemap({
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
      '.P...',
      '.....',
      '.....'
    ],
    decorRows: [
      '.....',
      '.....',
      '.....',
      '.....',
      '.....'
    ],
    backdropRows: [
      '.....',
      '.ak..',
      '..c..',
      '..d..',
      '.....'
    ]
  });

  const backdrop = [];
  forEachLayerTile(parsed, 'backdrop', (tile, col, row) => {
    if (tile !== '.') backdrop.push({ tile, col, row });
  });

  expect(backdrop).toEqual([
    { tile: 'a', col: 1, row: 1 },
    { tile: 'k', col: 2, row: 1 },
    { tile: 'c', col: 2, row: 2 },
    { tile: 'd', col: 2, row: 3 }
  ]);

  const valid = {
    terrainRows: ['###', '#.#', '###'],
    objectRows: ['...', '.P.', '.G.'],
    decorRows: ['...', '...', '...']
  };

  expect(() => parseTilemap({ ...valid, backdropRows: ['...', '.x.', '...'] })).toThrow(/backdropRows contains unknown tile/);
  expect(() => parseTilemap({ ...valid, backdropRows: ['...', '...'] })).toThrow(/backdropRows must contain 3 rows/);
  expect(() => parseTilemap({ ...valid, backdropRows: ['...', '..', '...'] })).toThrow(/backdropRows row 1 must be 3 chars wide/);
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
