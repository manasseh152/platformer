import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTOR_SIZE, ATTACK_HITBOX } from '../src/core/constants.js';
import { getSlashHitbox } from '../src/core/combat.js';
import { createEnemiesFromScene } from '../src/core/gameplay-scene-queries.js';
import { createPlayer, defineTilemap, getSpawnPoint, gridLayer } from '../src/core/tilemaps/tilemap.js';
import { finishGateObject, playerSpawner, slimeSpawner, solidTerrain } from '../src/content/tilemaps/objects.js';
import { CELL_SIZE } from '../src/core/constants.js';
import { getComponent } from '../src/engine/scene/queries.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function contentJsFiles(dir = join(repoRoot, 'src', 'content')) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return contentJsFiles(path);
    return path.endsWith('.js') ? [path] : [];
  });
}

function actorFixtureTilemap() {
  return defineTilemap({
    id: 'actor-scale-fixture',
    cols: 4,
    rows: 3,
    layers: [
      gridLayer({
        id: 'buildTerrain',
        cellSize: CELL_SIZE.BUILD,
        symbols: { '#': solidTerrain },
        rows: [
          '........',
          '........',
          '........',
          '........',
          '########',
          '########'
        ]
      }),
      gridLayer({
        id: 'entities',
        cellSize: CELL_SIZE.GRID,
        symbols: { P: playerSpawner, E: slimeSpawner, G: finishGateObject },
        rows: [
          '....',
          'PE.G',
          '....'
        ]
      })
    ]
  });
}

test('actor runtime bodies come from actor scale constants', () => {
  const tilemap = actorFixtureTilemap();
  expect(createPlayer(getSpawnPoint(tilemap))).toMatchObject(ACTOR_SIZE.PLAYER);
  expect(createEnemiesFromScene(tilemap)[0]).toMatchObject(ACTOR_SIZE.SLIME);
});

test('slash hitbox is named and mirrors around the player body', () => {
  expect(ATTACK_HITBOX.SLASH).toEqual({ w: 42, h: 24, offsetX: 22, offsetY: 8 });
  const player = { x: 100, y: 50, ...ACTOR_SIZE.PLAYER, dir: 1 };
  const right = getSlashHitbox(player);
  const left = getSlashHitbox({ ...player, dir: -1 });

  expect(right).toEqual({ x: 122, y: 58, w: 42, h: 24 });
  expect(left).toEqual({ x: 64, y: 58, w: 42, h: 24 });
  expect(right.x + right.w / 2 - (player.x + player.w / 2)).toBe((player.x + player.w / 2) - (left.x + left.w / 2));
});

test('content terrain render component is marker-only', () => {
  for (const file of contentJsFiles()) {
    expect(readFileSync(file, 'utf8'), file).not.toContain('renderTerrain({');
  }
  expect(getComponent({ components: solidTerrain.components }, 'render:terrain')).toEqual({ type: 'render:terrain' });
});
