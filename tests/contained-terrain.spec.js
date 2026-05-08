import { expect, test } from '@playwright/test';
import { CELL_SIZE } from '../src/core/constants.js';
import { TERRAIN_MASK, normalizeTerrainMask } from '../src/core/tilemaps/terrain-mask.js';
import { defineTilemap } from '../src/core/tilemaps/tilemap.js';
import { TERRAIN_KIND, terrainLayer } from '../src/core/tilemaps/terrain-layer.js';
import {
  CONTAINED_TERRAIN_DRAW_ORDER,
  planContainedTerrainTileVisuals,
  selectTerrainVisualVariant
} from '../src/render/contained-terrain.js';

const M = TERRAIN_MASK;
const baseTile = { layer: 'terrain', kind: TERRAIN_KIND.GRASS, x: 32, y: 48, w: CELL_SIZE.BUILD, h: CELL_SIZE.BUILD, col: 2, row: 3, mask: 0, rawMask: 0 };

function kinds(primitives) { return primitives.map(primitive => primitive.kind); }
function primitive(primitives, kind, key, value) { return primitives.find(item => item.kind === kind && item[key] === value); }

function expectAllInsideTile(tile, primitives) {
  for (const item of primitives) {
    expect(item.x, item.kind).toBeGreaterThanOrEqual(tile.x);
    expect(item.y, item.kind).toBeGreaterThanOrEqual(tile.y);
    expect(item.x + item.w, item.kind).toBeLessThanOrEqual(tile.x + tile.w);
    expect(item.y + item.h, item.kind).toBeLessThanOrEqual(tile.y + tile.h);
  }
}

test('normalizeTerrainMask preserves cardinal bits and removes orphan diagonals', () => {
  expect(normalizeTerrainMask(M.N | M.E | M.S | M.W)).toBe(M.N | M.E | M.S | M.W);
  expect(normalizeTerrainMask(M.NE)).toBe(0);
  expect(normalizeTerrainMask(M.N | M.NE)).toBe(M.N);
  expect(normalizeTerrainMask(M.E | M.NE)).toBe(M.E);
  expect(normalizeTerrainMask(M.N | M.E | M.NE)).toBe(M.N | M.E | M.NE);
  expect(normalizeTerrainMask(M.S | M.W | M.SW | M.NW)).toBe(M.S | M.W | M.SW);
});

test('contained terrain tiles expose raw authored mask and cleaned visual mask', () => {
  const parsed = defineTilemap({
    id: 'orphan-diagonal-mask',
    cols: 2,
    rows: 2,
    layers: [
      terrainLayer({ rows: [
        [null, TERRAIN_KIND.GRASS, null, null],
        [TERRAIN_KIND.GRASS, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
      ] })
    ]
  });

  const tile = parsed.renderLayers.containedTerrainTiles.find(item => item.col === 0 && item.row === 1);
  expect(tile.rawMask & M.NE).toBe(M.NE);
  expect(tile.mask & M.NE).toBe(0);
  expect(tile.mask).toBe(normalizeTerrainMask(tile.rawMask));
});

test('deterministic selector returns stable terrain visual parameters', () => {
  expect(selectTerrainVisualVariant(baseTile)).toEqual(selectTerrainVisualVariant(baseTile));
  expect(selectTerrainVisualVariant({ ...baseTile, col: 99, row: 1, mask: M.N | M.E })).toEqual({
    baseColor: '#a7643b',
    edgeColor: '#4f9f3a',
    innerCornerColor: '#3f7f36',
    edgeThickness: 4
  });
});

test('terrain visual plan composes base, continuous edges, and outer corners inside the authored cell', () => {
  const tile = { ...baseTile, mask: 0 };
  const primitives = planContainedTerrainTileVisuals(tile);

  expect(CONTAINED_TERRAIN_DRAW_ORDER).toEqual(['base', 'edge', 'outer-corner', 'inner-corner', 'detail']);
  expect(kinds(primitives)).toEqual([
    'base',
    'edge', 'edge', 'edge', 'edge',
    'outer-corner', 'outer-corner', 'outer-corner', 'outer-corner'
  ]);
  expect(primitive(primitives, 'edge', 'side', 'top')).toMatchObject({ x: 32, y: 48, w: 16, h: 4 });
  expect(primitive(primitives, 'edge', 'side', 'right')).toMatchObject({ x: 44, y: 48, w: 4, h: 16 });
  expect(primitive(primitives, 'edge', 'side', 'bottom')).toMatchObject({ x: 32, y: 60, w: 16, h: 4 });
  expect(primitive(primitives, 'edge', 'side', 'left')).toMatchObject({ x: 32, y: 48, w: 4, h: 16 });
  expect(primitive(primitives, 'outer-corner', 'corner', 'top-left')).toMatchObject({ x: 32, y: 48, w: 4, h: 4, color: '#4f9f3a' });
  expectAllInsideTile(tile, primitives);
});

test('terrain visual plan emits darker inner-corner notches for supported missing diagonals', () => {
  const tile = { ...baseTile, mask: M.N | M.E | M.S | M.SE };
  const primitives = planContainedTerrainTileVisuals(tile);

  expect(primitive(primitives, 'inner-corner', 'corner', 'top-right')).toMatchObject({ x: 44, y: 48, w: 4, h: 4, color: '#3f7f36' });
  expect(primitive(primitives, 'inner-corner', 'corner', 'bottom-right')).toBeUndefined();
  expect(primitive(primitives, 'edge', 'side', 'left')).toBeDefined();
  expectAllInsideTile(tile, primitives);
});

test('terrain visual planner rejects non-16x16 contained terrain tiles', () => {
  expect(() => planContainedTerrainTileVisuals({ ...baseTile, w: 32 })).toThrow(/16×16/);
  expect(() => planContainedTerrainTileVisuals({ ...baseTile, h: 8 })).toThrow(/16×16/);
});
