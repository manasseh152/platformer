import { expect, test } from '@playwright/test';
import {
  act01Level1Tilemap as level,
  getDefaultTilemap as getDefaultTilemap
} from '../src/content/tilemaps/registry.js';
import {
  createEnemies,
  createEnemySpawns,
  defineTilemap,
  forEachLayerTile,
  getDecorType,
  getGoalRect,
  getGoalTriggerRect,
  getTile,
  getSpawnPoint,
  gridLayer,
  isSolidTileAt,
  parseTilemap,
  solidTileRectsOverlapping,
  spikeHazardRectsOverlapping,
  tileRect,
  tileToWorld,
  worldToTile
} from '../src/core/tilemaps/tilemap.js';
import { CELL_SIZE } from '../src/core/constants.js';
import { solidTerrain } from '../src/content/tilemaps/objects.js';
import { resolveInitialTilemap } from '../src/tilemap-manager.js';

test('tilemap exposes world dimensions derived from tile dimensions', () => {
  expect(level.worldWidth).toBe(level.cols * level.tileSize);
  expect(level.worldHeight).toBe(level.rows * level.tileSize);
});

test('tile helpers convert between tile and world coordinates', () => {
  expect(tileToWorld(3, 2)).toEqual({ x: 96, y: 64 });
  expect(worldToTile(117, 73)).toEqual({ col: 3, row: 2 });
  expect(tileRect(2, 4, 3, 1)).toMatchObject({ x: 64, y: 128, w: 96, h: 32 });
});

test('defineTilemap requires explicit dimensions and validates layer cell size', () => {
  expect(CELL_SIZE).toEqual({ GRID: 32, BUILD: 16, TERRAIN_PRIMITIVE: 8 });
  const parsed = defineTilemap({
    id: 'build-grid-validation',
    cols: 2,
    rows: 1,
    layers: [gridLayer({ id: 'buildTerrain', cellSize: CELL_SIZE.BUILD, symbols: { '#': solidTerrain }, rows: ['#...', '####'] })]
  });

  expect(parsed.worldWidth).toBe(64);
  expect(parsed.worldHeight).toBe(32);
  expect(parsed.layers[0].cellSize).toBe(CELL_SIZE.BUILD);
  expect(parsed.objects[0].transform).toMatchObject({ col: 0, row: 0, cellSize: CELL_SIZE.BUILD, x: 0, y: 0, w: 16, h: 16 });
  expect(() => gridLayer({ id: 'bad-resolution', resolution: 2, symbols: { '#': solidTerrain }, rows: ['#'] })).toThrow(/cellSize/);
  expect(() => gridLayer({ id: 'bad-cell-size', cellSize: 10, symbols: { '#': solidTerrain }, rows: ['#'] })).toThrow(/unsupported cellSize/);
  expect(() => defineTilemap({ id: 'missing-dimensions', layers: [gridLayer({ id: 'terrain', symbols: { '#': solidTerrain }, rows: ['#'] })] })).toThrow(/cols/);
  expect(() => defineTilemap({ id: 'bad-cell-size-rows', cols: 2, rows: 1, layers: [gridLayer({ id: 'buildTerrain', cellSize: CELL_SIZE.BUILD, symbols: { '#': solidTerrain }, rows: ['##'] })] })).toThrow(/buildTerrain layer must contain 2 rows/);
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
  expect(getSpawnPoint(parsed)).toEqual({ x: 48, y: 52 });
  expect(getGoalRect(parsed)).toMatchObject({ x: 96, y: 32, w: 32, h: 32, kind: 'gate' });
  expect(parsed.artTileSize).toBe(16);
  expect(parsed.artTilesPerTile).toBe(2);
  expect(parsed.theme).toBe('kenney-pixel-platformer:grass');
  expect(parsed.renderLayers.terrainVisuals.filter(visual => visual.col === 1 && visual.row === 3)).toHaveLength(4);
  expect(parsed.renderLayers.terrainPrimitives).toEqual(expect.arrayContaining([
    expect.objectContaining({ col: 1, row: 0, x: 16, y: -16, mask: 12, offsetGrid: true }),
    expect.objectContaining({ col: 2, row: 3, x: 48, y: 80, mask: 12, offsetGrid: true })
  ]));
  expect(spikeHazardRectsOverlapping(parsed, { x: 108, y: 108, w: 36, h: 36 })).toHaveLength(1);
  expect(decor).toEqual([
    { type: 'bannerRed', col: 1, row: 1 },
    { type: 'torch', col: 3, row: 1 }
  ]);
  expect(createEnemySpawns(parsed)).toHaveLength(1);
  expect(solidTileRectsOverlapping(parsed, { x: 32, y: 96, w: 64, h: 32 })).toEqual([
    expect.objectContaining({ x: 32, y: 96, w: 64, h: 64, cols: 2, rows: 2, kind: 'terrain-solid' })
  ]);
});

test('contained autotile terrain derives 8px collision primitives from 16px build terrain', () => {
  const parsed = defineTilemap({
    id: 'contained-terrain',
    cols: 2,
    rows: 1,
    terrainRenderMode: 'contained-autotile',
    layers: [
      gridLayer({ id: 'buildTerrain', cellSize: CELL_SIZE.BUILD, symbols: { '#': solidTerrain }, rows: ['#...', '....'] })
    ]
  });

  expect(parsed.collisionLayers.terrainPrimitives).toEqual([
    expect.objectContaining({ x: 0, y: 0, w: 8, h: 8, col: 0, row: 0, kind: 'terrain-primitive' }),
    expect.objectContaining({ x: 8, y: 0, w: 8, h: 8, col: 1, row: 0, kind: 'terrain-primitive' }),
    expect.objectContaining({ x: 0, y: 8, w: 8, h: 8, col: 0, row: 1, kind: 'terrain-primitive' }),
    expect.objectContaining({ x: 8, y: 8, w: 8, h: 8, col: 1, row: 1, kind: 'terrain-primitive' })
  ]);
  expect(parsed.collisionLayers.terrainRects).toEqual([
    expect.objectContaining({ x: 0, y: 0, w: 16, h: 16, kind: 'terrain-solid' })
  ]);
  expect(parsed.renderLayers.containedTerrainTiles).toEqual([
    expect.objectContaining({ x: 0, y: 0, w: 16, h: 16, col: 0, row: 0, mask: expect.any(Number) })
  ]);
  expect(solidTileRectsOverlapping(parsed, { x: 7, y: 7, w: 2, h: 2 })).toEqual([
    expect.objectContaining({ x: 0, y: 0, w: 16, h: 16, kind: 'terrain-solid' })
  ]);
});

test('initial tilemap resolution ignores URL selection and uses the default level', () => {
  expect(resolveInitialTilemap()).toBe(getDefaultTilemap());
  expect(resolveInitialTilemap({ developerMode: true }, '?level=movement-gym')).toBe(getDefaultTilemap());
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

test('tilemap collision rects are greedy-merged from authored terrain cells, not visual primitives', () => {
  const parsed = parseTilemap({
    collisionMode: 'dual-grid',
    terrainRows: ['###', '#.#', '###'],
    objectRows: ['...', '.P.', '.G.'],
    decorRows: ['...', '...', '...']
  });

  expect(parsed.collisionMode).toBe('dual-grid');
  expect(parsed.renderLayers.terrainCollisionCells).toHaveLength(8);
  expect(parsed.renderLayers.terrainCollisionRects).toEqual(expect.arrayContaining([
    expect.objectContaining({ x: 0, y: 0, w: 96, h: 32, kind: 'terrain-solid' }),
    expect.objectContaining({ x: 0, y: 32, w: 32, h: 64, kind: 'terrain-solid' }),
    expect.objectContaining({ x: 64, y: 32, w: 32, h: 64, kind: 'terrain-solid' }),
    expect.objectContaining({ x: 32, y: 64, w: 32, h: 32, kind: 'terrain-solid' })
  ]));
  expect(solidTileRectsOverlapping(parsed, { x: 16, y: 0, w: 4, h: 4 })).toEqual([
    expect.objectContaining({ x: 0, y: 0, w: 96, h: 32, kind: 'terrain-solid' })
  ]);
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

  expect(getGoalRect(parsed)).toMatchObject({ x: 32, y: 32, w: 96, h: 32, cols: 3 });
  expect(solidTileRectsOverlapping(parsed, { x: 64, y: 64, w: 32, h: 32 })).toEqual([
    expect.objectContaining({ x: 32, y: 64, w: 96, h: 32, cols: 3, rows: 1, kind: 'terrain-solid' })
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
  const customTilemap = parseTilemap({
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

  const enemies = createEnemies(customTilemap);
  enemies[0].hp = 0;

  expect(createEnemies(customTilemap)[0].hp).toBe(2);
});
