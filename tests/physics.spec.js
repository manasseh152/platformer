import { expect, test } from '@playwright/test';
import { updateEnemy } from '../src/physics.js';

function makeGame(enemy, platforms) {
  return {
    level: { platforms },
    player: { x: -1000, y: -1000, w: 10, h: 10, inv: 0, dead: false },
    camera: { shake: 0 },
    particles: []
  };
}

test('enemy horizontal collision uses pre-bounds movement direction and does not phase through a wall', () => {
  const wall = { x: 100, y: 0, w: 64, h: 64 };
  const enemy = {
    x: 95,
    y: 10,
    w: 10,
    h: 10,
    vx: 200,
    vy: 0,
    min: 0,
    max: 110,
    hp: 1,
    hurt: 0
  };

  updateEnemy(makeGame(enemy, [wall]), enemy, 0.033);

  expect(enemy.x).toBe(90);
  expect(enemy.vx).toBe(-200);
  expect(enemy.x + enemy.w).toBeLessThanOrEqual(wall.x);
});

test('enemy patrol bounds clamp at the edge instead of leaving overlap unresolved', () => {
  const enemy = {
    x: 95,
    y: 10,
    w: 10,
    h: 10,
    vx: 200,
    vy: 0,
    min: 0,
    max: 110,
    hp: 1,
    hurt: 0
  };

  updateEnemy(makeGame(enemy, []), enemy, 0.033);

  expect(enemy.x).toBe(100);
  expect(enemy.vx).toBe(-200);
  expect(enemy.x + enemy.w).toBe(enemy.max);
});
