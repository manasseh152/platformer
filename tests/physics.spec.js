import { expect, test } from '@playwright/test';
import { createGameplaySession } from '#/core/gameplay-session.js';
import { createInputRuntime } from '#/core/input/index.js';
import { updateEnemy, updateGameplay } from '#/core/physics.js';
import { getTransitionRect } from '#/core/gameplay-scene-queries.js';
import { gameInputProfile } from '#/app/input/game-input-profile.js';
import { defineContainedTestTilemap } from './helpers/contained-tilemap.js';

function makeTilemap(terrainRows) {
  return defineContainedTestTilemap({
    terrainRows,
    objectRows: [
      '................',
      '.G..............',
      '................',
      '................',
      '................',
      '.P..............',
      '................'
    ]
  });
}

function makeGame(enemy, tilemap) {
  return {
    tilemap,
    player: { x: -1000, y: -1000, w: 10, h: 10, inv: 0, dead: false },
    camera: { shake: 0 },
    particles: []
  };
}

function makeGameplayTilemap({ terrainRows, objectRows }) {
  return defineContainedTestTilemap({ terrainRows, objectRows });
}

function makeRuntime() {
  return { random: () => 0.99 };
}

const actionCodes = {
  jump: 'Space',
  attack: 'KeyJ',
  left: 'KeyA',
  right: 'KeyD'
};

function createTestInput() {
  const input = createInputRuntime(gameInputProfile);
  input.settings.input.activeProfileId = 'wasd';
  input.settings.input.profileSwitching = 'locked';
  input.beginFrame();
  return input;
}

function press(input, action) {
  input.handleEvent({ type: 'keydown', code: actionCodes[action] });
}

function hold(input, action) {
  press(input, action);
}

function step(session, input = createTestInput(), dt = 1 / 60) {
  updateGameplay(makeRuntime(), session, input, dt, { resetGame: () => { session.resetRequested = true; } });
  return input;
}

test('enemy horizontal collision uses pre-bounds movement direction and does not phase through a wall', () => {
  const level = makeTilemap([
    '...#............',
    '...#............',
    '...#............',
    '...#............',
    '...#............',
    '...#............',
    '################'
  ]);
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

  updateEnemy(makeGame(enemy, level), enemy, 0.033);

  expect(enemy.x).toBe(86);
  expect(enemy.vx).toBe(-200);
  expect(enemy.x + enemy.w).toBeLessThanOrEqual(96);
});

test('enemy patrol bounds clamp at the edge instead of leaving overlap unresolved', () => {
  const level = makeTilemap([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '################'
  ]);
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

  updateEnemy(makeGame(enemy, level), enemy, 0.033);

  expect(enemy.x).toBe(100);
  expect(enemy.vx).toBe(-200);
  expect(enemy.x + enemy.w).toBe(enemy.max);
});

test('player can use coyote time to jump shortly after walking off a ledge', () => {
  const level = makeGameplayTilemap({
    terrainRows: [
      '............',
      '............',
      '............',
      '............',
      '............',
      '###....#####'
    ],
    objectRows: [
      '............',
      '..........G.',
      '............',
      '............',
      '.P..........',
      '............'
    ]
  });
  const session = createGameplaySession(level);
  session.player.x = 3 * level.tileSize + 4;
  session.player.y = 4 * level.tileSize - session.player.h;
  session.player.grounded = false;
  session.player.coyote = 0.06;
  session.player.vy = 20;

  const input = createTestInput();
  press(input, 'jump');
  step(session, input, 1 / 60);

  expect(session.player.vy).toBeLessThan(-220);
  expect(session.player.coyote).toBeLessThan(0);
});

test('jump input buffers before landing and fires when the player touches ground', () => {
  const level = makeGameplayTilemap({
    terrainRows: [
      '............',
      '............',
      '............',
      '............',
      '............',
      '############'
    ],
    objectRows: [
      '............',
      '..........G.',
      '............',
      '............',
      '.P..........',
      '............'
    ]
  });
  const session = createGameplaySession(level);
  session.player.x = 2 * level.tileSize;
  session.player.y = 5 * level.tileSize - session.player.h - 10;
  session.player.vy = 600;

  const input = createTestInput();
  press(input, 'jump');
  step(session, input, 1 / 60);
  expect(session.player.jumpBuf).toBeGreaterThan(0);

  step(session, createTestInput(), 1 / 60);

  expect(session.player.grounded).toBe(false);
  expect(session.player.vy).toBeLessThan(-220);
  expect(session.player.jumpBuf).toBeLessThanOrEqual(0);
});

test('spike hazards hurt once, apply invulnerability, and can kill after invulnerability expires', () => {
  const level = makeGameplayTilemap({
    terrainRows: [
      '............',
      '............',
      '............',
      '............',
      '..^.........',
      '############'
    ],
    objectRows: [
      '............',
      '..........G.',
      '............',
      '............',
      '.P..........',
      '............'
    ]
  });
  const session = createGameplaySession(level);
  session.player.x = 2 * level.tileSize + 10;
  session.player.y = 4 * level.tileSize + 42;
  session.player.hp = 2;

  step(session);
  expect(session.player.hp).toBe(1);
  expect(session.player.inv).toBeGreaterThan(1);

  step(session);
  expect(session.player.hp).toBe(1);
  expect(session.player.dead).toBe(false);

  session.player.inv = 0;
  step(session);
  expect(session.player.hp).toBe(0);
  expect(session.player.dead).toBe(true);
});

test('player slash damages enemies in front without requiring body contact', () => {
  const level = makeGameplayTilemap({
    terrainRows: [
      '............',
      '............',
      '............',
      '............',
      '............',
      '############'
    ],
    objectRows: [
      '............',
      '..........G.',
      '............',
      '............',
      '.P..........',
      '............'
    ]
  });
  const session = createGameplaySession(level);
  session.player.x = 2 * level.tileSize;
  session.player.y = 4 * level.tileSize - session.player.h;
  session.player.dir = 1;
  session.enemies.push({
    x: session.player.x + 56,
    y: session.player.y + 8,
    w: 32,
    h: 24,
    vx: 0,
    vy: 0,
    hp: 2,
    hurt: 0,
    min: 0,
    max: level.worldWidth
  });

  const input = createTestInput();
  press(input, 'attack');
  step(session, input);

  expect(session.enemies[0]).toMatchObject({ hp: 1, hurt: expect.any(Number), vx: 180 });
  expect(session.player.hp).toBe(5);
});

test('finish gate requires enough of the player collider inside the goal before completing', () => {
  const level = makeGameplayTilemap({
    terrainRows: [
      '............',
      '............',
      '............',
      '............',
      '............',
      '############'
    ],
    objectRows: [
      '............',
      '..........G.',
      '............',
      '............',
      '.P..........',
      '............'
    ]
  });
  const session = createGameplaySession(level);
  const gate = getTransitionRect(level, 'finish');
  session.player.x = gate.x - session.player.w + 1;
  session.player.y = gate.y;

  step(session);
  expect(session.outcome).toBe('active');

  session.player.x = gate.x;
  session.player.y = gate.y;
  step(session);
  expect(session.outcome).toBe('completed');

  const xAfterWin = session.player.x;
  const input = createTestInput();
  hold(input, 'right');
  step(session, input, 0.5);
  expect(session.player.x).toBe(xAfterWin);
});
