import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import {
  act01Level1Tilemap as level,
  getDefaultTilemap as getDefaultTilemap
} from '#/content/tilemaps/registry.js';
import {
  createEnemies,
  createEnemySpawns,
  defineTilemap,
  forEachLayerTile,
  getDecorType,
  getGoalRect,
  getGoalTriggerRect,
  getSpawnPoint,
  getTile,
  gridLayer,
  isSolidTileAt,
  solidTileRectsOverlapping,
  spikeHazardRectsOverlapping,
  tileRect,
  tileToWorld,
  worldToTile
} from '#/core/tilemaps/tilemap.js';
import { CELL_SIZE } from '#/core/constants.js';
import { finishGateObject, playerSpawner, renderTerrain, slimeSpawner, solidTerrain } from '#/content/tilemaps/objects.js';
import { TERRAIN_KIND, terrainLayer } from '#/core/tilemaps/terrain-layer.js';
import { resolveInitialTilemap } from '#/app/tilemaps/tilemap-manager.js';
import { defineContainedTestTilemap } from './helpers/contained-tilemap.js';

function visibleTerrainSet(tilemap) {
  return new Set((tilemap.terrain?.cells ?? [])
    .filter(cell => cell.kind !== TERRAIN_KIND.INVISIBLE)
    .map(cell => `${cell.col},${cell.row}`));
}

function allObjects(tilemap) {
  return [...tilemap.objects, ...Object.values(tilemap.layers ?? {}).flatMap(layer => Object.values(layer.symbols ?? {}))];
}

test('tilemap exposes world dimensions derived from tile dimensions', () => {
  expect(level.worldWidth).toBe(level.cols * level.tileSize);
  expect(level.worldHeight).toBe(level.rows * level.tileSize);
});

test('tile helpers convert between tile and world coordinates', () => {
  expect(tileToWorld(3, 2)).toEqual({ x: 96, y: 64 });
  expect(worldToTile(117, 73)).toEqual({ col: 3, row: 2 });
  expect(tileRect(2, 4, 3, 1)).toMatchObject({ x: 64, y: 128, w: 96, h: 32 });
});

test('defineTilemap requires explicit dimensions and validates terrain layers', () => {
  expect(CELL_SIZE).toEqual({ GRID: 32, BUILD: 16, TERRAIN_PRIMITIVE: 8 });
  const parsed = defineTilemap({
    id: 'terrain-layer-validation',
    cols: 2,
    rows: 1,
    layers: [terrainLayer({ rows: [[TERRAIN_KIND.GRASS, null, null, null], [TERRAIN_KIND.STONE, TERRAIN_KIND.INVISIBLE, null, null]] })]
  });

  expect(parsed.worldWidth).toBe(64);
  expect(parsed.worldHeight).toBe(32);
  expect(parsed.terrainRenderMode).toBe('contained-autotile');
  expect(parsed.layers[0].cellSize).toBe(CELL_SIZE.BUILD);
  expect(parsed.terrain.cells[0]).toMatchObject({ col: 0, row: 0, kind: TERRAIN_KIND.GRASS, x: 0, y: 0, w: 16, h: 16 });
  expect(parsed.objects).toHaveLength(0);
  expect(() => gridLayer({ id: 'bad-resolution', resolution: 2, symbols: { '#': solidTerrain }, rows: ['#'] })).toThrow(/cellSize/);
  expect(() => gridLayer({ id: 'bad-cell-size', cellSize: 10, symbols: { '#': solidTerrain }, rows: ['#'] })).toThrow(/unsupported cellSize/);
  expect(() => terrainLayer({ rows: [[TERRAIN_KIND.GRASS, 'unknown-terrain']] })).toThrow(/unknown terrain kind/);
  expect(() => defineTilemap({ id: 'missing-dimensions', layers: [terrainLayer({ rows: [[TERRAIN_KIND.GRASS]] })] })).toThrow(/cols/);
  expect(() => defineTilemap({ id: 'old-build-terrain-layer', cols: 1, rows: 1, layers: [gridLayer({ id: 'buildTerrain', cellSize: CELL_SIZE.BUILD, symbols: { '#': solidTerrain }, rows: ['##', '##'] })] })).toThrow(/buildTerrain layer is archived/);
  expect(() => defineTilemap({ id: 'bad-terrain-layer', cols: 1, rows: 1, layers: [gridLayer({ id: 'terrain', symbols: { '#': solidTerrain }, rows: ['#'] })] })).toThrow(/terrain layer must be created with terrainLayer/);
  expect(() => defineTilemap({ id: 'wrong-mode', cols: 1, rows: 1, terrainRenderMode: 'other', layers: [terrainLayer({ rows: [[null, null], [null, null]] })] })).toThrow(/contained-autotile/);
  expect(() => defineTilemap({ id: 'bad-cell-size-rows', cols: 2, rows: 1, layers: [terrainLayer({ rows: [[TERRAIN_KIND.GRASS, null], [null, null]] })] })).toThrow(/terrain layer row 0 must be 4 cells wide/);
});

test('contained tilemap exposes layered tiles and query helpers derive gameplay data', () => {
  const parsed = defineContainedTestTilemap({
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
  expect(getSpawnPoint(parsed)).toEqual({ x: 48, y: 56 });
  expect(getGoalRect(parsed)).toMatchObject({ x: 96, y: 32, w: 32, h: 32, kind: 'gate' });
  expect(parsed.artTileSize).toBe(16);
  expect(parsed.artTilesPerTile).toBe(2);
  expect(parsed.renderLayers.containedTerrainTiles.length).toBe(visibleTerrainSet(parsed).size);
  expect(parsed.renderLayers.terrainPrimitives).toBeUndefined();
  expect(spikeHazardRectsOverlapping(parsed, { x: 108, y: 108, w: 36, h: 36 })).toHaveLength(1);
  expect(decor).toEqual([
    { type: 'bannerRed', col: 1, row: 1 },
    { type: 'torch', col: 3, row: 1 }
  ]);
  expect(createEnemySpawns(parsed)).toHaveLength(1);
  expect(solidTileRectsOverlapping(parsed, { x: 32, y: 96, w: 64, h: 32 })).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'terrain-solid' })
  ]));
});

test('terrain kinds drive visibility and visual connectivity without changing solid collision', () => {
  const parsed = defineTilemap({
    id: 'terrain-kinds',
    cols: 2,
    rows: 1,
    layers: [terrainLayer({ rows: [
      [TERRAIN_KIND.GRASS, TERRAIN_KIND.STONE, TERRAIN_KIND.SAND, TERRAIN_KIND.INVISIBLE],
      [TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.LOG, TERRAIN_KIND.LEAVES]
    ] })]
  });

  expect(parsed.terrain.cells.map(cell => cell.kind)).toEqual([
    TERRAIN_KIND.GRASS,
    TERRAIN_KIND.STONE,
    TERRAIN_KIND.SAND,
    TERRAIN_KIND.INVISIBLE,
    TERRAIN_KIND.GRASS,
    TERRAIN_KIND.GRASS,
    TERRAIN_KIND.LOG,
    TERRAIN_KIND.LEAVES
  ]);
  expect(parsed.collisionLayers.terrainPrimitives.filter(cell => cell.terrainKind === TERRAIN_KIND.INVISIBLE)).toHaveLength(4);
  expect(parsed.renderLayers.containedTerrainTiles.map(tile => tile.kind)).not.toContain(TERRAIN_KIND.INVISIBLE);
  const grass = parsed.renderLayers.containedTerrainTiles.find(tile => tile.col === 0 && tile.row === 0);
  expect(grass.rawMask & 4).toBe(0); // east stone does not visually connect to grass
  expect(grass.rawMask & 16).toBe(16); // south grass does connect
});

test('contained autotile terrain derives 8px collision primitives from 16px terrain cells', () => {
  const parsed = defineTilemap({
    id: 'contained-terrain',
    cols: 2,
    rows: 1,
    terrainRenderMode: 'contained-autotile',
    layers: [
      terrainLayer({ rows: [[TERRAIN_KIND.GRASS, null, null, null], [null, null, null, null]] })
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
    expect.objectContaining({ x: 0, y: 0, w: 16, h: 16, col: 0, row: 0, rawMask: expect.any(Number), mask: expect.any(Number) })
  ]);
  expect(solidTileRectsOverlapping(parsed, { x: 7, y: 7, w: 2, h: 2 })).toEqual([
    expect.objectContaining({ x: 0, y: 0, w: 16, h: 16, kind: 'terrain-solid' })
  ]);
});

test('every contained terrain visual tile is inside a visible terrain cell', () => {
  for (const tilemap of [level, getDefaultTilemap()]) {
    const solids = visibleTerrainSet(tilemap);
    for (const tile of tilemap.renderLayers.containedTerrainTiles) {
      expect(solids.has(`${tile.col},${tile.row}`), tilemap.id).toBe(true);
      expect(tile.layer).toBe('terrain');
      expect(tile.x).toBe(tile.col * CELL_SIZE.BUILD);
      expect(tile.y).toBe(tile.row * CELL_SIZE.BUILD);
      expect(tile.w).toBe(CELL_SIZE.BUILD);
      expect(tile.h).toBe(CELL_SIZE.BUILD);
      expect(tile.rawMask).toEqual(expect.any(Number));
      expect(tile.mask).toEqual(expect.any(Number));
    }
  }
});

test('contained terrain emits no offset render primitives', () => {
  for (const tilemap of [level, getDefaultTilemap()]) {
    expect(tilemap.renderLayers.terrainPrimitives).toBeUndefined();
    expect(tilemap.renderLayers.terrainVisuals).toBeUndefined();
    expect(JSON.stringify(tilemap.renderLayers)).not.toContain('offsetGrid');
  }
});

test('terrain render components are marker-only', () => {
  expect(renderTerrain()).toEqual({ type: 'render:terrain' });
  for (const tilemap of [level, getDefaultTilemap()]) {
    for (const object of allObjects(tilemap)) {
      for (const component of object.components ?? []) {
        if (component.type === 'render:terrain') expect(component).toEqual({ type: 'render:terrain' });
      }
    }
  }
});

test('content definitions use terrainLayer and no active buildTerrain', () => {
  const files = globSync('src/content/tilemaps/definitions/**/*.js');
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    expect(text, file).not.toContain('parseTilemap');
    expect(text, file).not.toContain('buildTerrain');
    expect(text, file).not.toContain('offsetGrid');
    if (text.includes('defineTilemap(')) expect(text, file).toContain('terrainLayer');
  }
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

test('tilemap collision rects are greedy-merged from authored terrain cells', () => {
  const parsed = defineContainedTestTilemap({
    terrainRows: ['###', '#.#', '###'],
    objectRows: ['...', '.P.', '.G.']
  });

  expect(parsed.collisionLayers.terrainPrimitives).toHaveLength(128);
  expect(parsed.collisionLayers.terrainRects).toEqual(expect.arrayContaining([
    expect.objectContaining({ x: 0, y: 0, w: 96, h: 32, kind: 'terrain-solid' }),
    expect.objectContaining({ x: 0, y: 32, w: 32, h: 64, kind: 'terrain-solid' }),
    expect.objectContaining({ x: 64, y: 32, w: 32, h: 64, kind: 'terrain-solid' }),
    expect.objectContaining({ x: 32, y: 64, w: 32, h: 32, kind: 'terrain-solid' })
  ]));
  expect(solidTileRectsOverlapping(parsed, { x: 16, y: 0, w: 4, h: 4 })).toEqual([
    expect.objectContaining({ x: 0, y: 0, w: 96, h: 32, kind: 'terrain-solid' })
  ]);
});

test('tilemap supports block terrain and three-tile gates', () => {
  const parsed = defineContainedTestTilemap({
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
    ]
  });

  expect(getGoalRect(parsed)).toMatchObject({ x: 32, y: 32, w: 96, h: 32, cols: 3 });
  expect(isSolidTileAt(parsed, 2, 2)).toBe(true);
});

test('tilemap supports backdrop rows with iteration', () => {
  const parsed = defineContainedTestTilemap({
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
});

test('tilemap helper rejects invalid layers and missing required markers', () => {
  const valid = {
    terrainRows: ['###', '#.#', '###'],
    objectRows: ['...', '.P.', '.G.']
  };

  expect(() => defineContainedTestTilemap({ ...valid, objectRows: ['...', '.P.'] })).toThrow(/objectRows must contain 3 rows/);
  expect(() => gridLayer({ id: 'entities', symbols: { P: playerSpawner }, rows: ['.x.'] })).toThrow(/unknown symbol/);
});

test('enemy runtime state is cloned from tilemap-owned enemy definitions', () => {
  const customTilemap = defineContainedTestTilemap({
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
    ]
  });

  const enemies = createEnemies(customTilemap);
  enemies[0].hp = 0;

  expect(createEnemies(customTilemap)[0].hp).toBe(2);
});
