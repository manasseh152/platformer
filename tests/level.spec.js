import { expect, test } from '@playwright/test';
import {
  enemyZooLevel,
  gateLabLevel,
  getDefaultLevel,
  getLevelById,
  gymLevel,
  hazardGymLevel,
  level
} from '../src/campaign/registry.js';
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
  expect(getTile(parsed, 'backdrop', 2, 2)).toBe('.');
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

test('initial level resolution ignores URL selection and uses the default level', () => {
  expect(resolveInitialLevel()).toBe(getDefaultLevel());
  expect(resolveInitialLevel({ developerMode: true }, '?level=legacy-movement-lab')).toBe(getDefaultLevel());
});

test('developer showcase levels are legacy tilemap labs while gyms move to executable scenarios', () => {
  expect(getLevelById('legacy-movement-lab')).toBe(gymLevel);
  expect(getLevelById('legacy-hazard-lab')).toBe(hazardGymLevel);
  expect(getLevelById('legacy-enemy-zoo')).toBe(enemyZooLevel);
  expect(getLevelById('gate-lab')).toBe(gateLabLevel);

  expect(gymLevel).toMatchObject({ id: 'legacy-movement-lab', name: 'Legacy Movement Lab', kind: 'tilemap-level', categories: ['gyms', 'legacy'], visibility: 'developer' });
  expect(hazardGymLevel).toMatchObject({ id: 'legacy-hazard-lab', name: 'Legacy Hazard Lab', kind: 'tilemap-level', categories: ['gyms', 'legacy'], visibility: 'developer' });
  expect(enemyZooLevel).toMatchObject({ id: 'legacy-enemy-zoo', name: 'Legacy Enemy Zoo', kind: 'tilemap-level', categories: ['zoos', 'legacy'], visibility: 'developer' });
  expect(gateLabLevel).toMatchObject({ id: 'gate-lab', kind: 'tilemap-level', categories: ['labs'], visibility: 'developer' });
  expect(createEnemies(gymLevel)).toHaveLength(0);
  expect(createEnemies(enemyZooLevel)).toHaveLength(6);

  for (const devLevel of [gymLevel, hazardGymLevel, enemyZooLevel, gateLabLevel]) {
    expect(getSpawnPoint(devLevel)).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
    const goal = getGoalRect(devLevel);
    for (let col = goal.col; col < goal.col + goal.cols; col++) {
      expect(isSolidTileAt(devLevel, col, goal.row + 1)).toBe(true);
    }
  }
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
