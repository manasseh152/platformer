import { expect, test } from '@playwright/test';
import { ACTOR_SIZE, CELL_SIZE } from '../src/core/constants.js';
import { createEnemiesFromScene } from '../src/core/gameplay-scene-queries.js';
import { defineTilemap, gridLayer } from '../src/core/tilemaps/tilemap.js';
import { TERRAIN_KIND, terrainLayer } from '../src/core/tilemaps/terrain-layer.js';
import { finishGateObject, playerSpawner, slimeSpawner } from '../src/content/tilemaps/objects.js';
import { enemyZooMap } from '../src/content/tilemaps/definitions/enemy-zoo-map.js';
import { defineContainedTestTilemap } from './helpers/contained-tilemap.js';

function containedEnemyMap() {
  return defineTilemap({
    id: 'contained-enemy-patrol-test',
    cols: 8,
    rows: 5,
    artTileSize: CELL_SIZE.BUILD,
    terrainRenderMode: 'contained-autotile',
    layers: [
      terrainLayer({
        cellSize: CELL_SIZE.BUILD,
        rows: [
          [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
          [null, null, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, null, null, null, null],
          [null, null, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS, null, null, null, null],
          [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]
        ]
      }),
      gridLayer({
        id: 'entities',
        cellSize: CELL_SIZE.GRID,
        symbols: { P: playerSpawner, E: slimeSpawner, G: finishGateObject },
        rows: [
          '........',
          '........',
          '...E.G..',
          '.P......',
          '........'
        ]
      })
    ]
  });
}

test('contained terrain enemy patrols use AABB collision support instead of matching terrain grid cells', () => {
  const [enemy] = createEnemiesFromScene(containedEnemyMap());

  expect(enemy.y + enemy.h).toBe(96);
  expect(enemy.max - enemy.min).toBeGreaterThanOrEqual(ACTOR_SIZE.SLIME.w);
  expect(enemy.min).toBeLessThan(enemy.x);
  expect(enemy.max).toBeGreaterThan(enemy.x + enemy.w);
});

test('enemy zoo enemies all spawn on terrain collision tops with usable patrol ranges', () => {
  for (const enemy of createEnemiesFromScene(enemyZooMap)) {
    expect(enemy.max - enemy.min).toBeGreaterThanOrEqual(enemy.w);
    expect(enemy.y + enemy.h).toBeGreaterThan(0);
    expect(enemy.y + enemy.h).toBeLessThanOrEqual(enemyZooMap.worldHeight);
  }
});

test('enemy patrols derive from contained collision AABBs on full-grid authored platforms', () => {
  const tilemap = defineContainedTestTilemap({
    terrainRows: [
      '########',
      '#......#',
      '#......#',
      '#.====.#',
      '########'
    ],
    objectRows: [
      '........',
      '.....G..',
      '...E....',
      '.P......',
      '........'
    ]
  });

  const [enemy] = createEnemiesFromScene(tilemap);

  expect(enemy.y + enemy.h).toBe(96);
  expect(enemy.max - enemy.min).toBeGreaterThanOrEqual(enemy.w);
});
