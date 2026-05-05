import { expect, test } from '@playwright/test';
import { createInputState } from '../src/input.js';
import { createGameplaySession } from '../src/gameplay-session.js';
import { parseTilemap } from '../src/tilemaps/tilemap.js';
import { updateEnemy, updateGameplay } from '../src/physics.js';

function makeLevel(terrainRows) {
  return parseTilemap({
    terrainRows,
    objectRows: [
      '................',
      '.G..............',
      '................',
      '................',
      '................',
      '.P..............',
      '................'
    ],
    decorRows: Array.from({ length: 7 }, () => '................')
  }, 10);
}

function makeGame(enemy, level) {
  return {
    level,
    player: { x: -1000, y: -1000, w: 10, h: 10, inv: 0, dead: false },
    camera: { shake: 0 },
    particles: []
  };
}

function makeGameplayLevel({ terrainRows, objectRows }) {
  return parseTilemap({
    terrainRows,
    objectRows,
    decorRows: Array.from({ length: terrainRows.length }, () => '.'.repeat(terrainRows[0].length))
  });
}

function makeRuntime() {
  return { random: () => 0.99 };
}

function press(input, action) {
  input.keys.add(input.binds[action][0]);
  input.pressed.add(input.binds[action][0]);
}

function hold(input, action) {
  input.keys.add(input.binds[action][0]);
}

function step(session, input = createInputState(), dt = 1 / 60) {
  updateGameplay(makeRuntime(), session, input, dt, { resetGame: () => { session.resetRequested = true; } });
  return input;
}

test('enemy horizontal collision uses pre-bounds movement direction and does not phase through a wall', () => {
  const level = makeLevel([
    '..........#.....',
    '..........#.....',
    '..........#.....',
    '..........#.....',
    '..........#.....',
    '..........#.....',
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

  expect(enemy.x).toBe(90);
  expect(enemy.vx).toBe(-200);
  expect(enemy.x + enemy.w).toBeLessThanOrEqual(100);
});

test('enemy patrol bounds clamp at the edge instead of leaving overlap unresolved', () => {
  const level = makeLevel([
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
  const level = makeGameplayLevel({
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

  const input = createInputState();
  press(input, 'jump');
  step(session, input, 1 / 60);

  expect(session.player.vy).toBeLessThan(-240);
  expect(session.player.coyote).toBeLessThan(0);
});

test('jump input buffers before landing and fires when the player touches ground', () => {
  const level = makeGameplayLevel({
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

  const input = createInputState();
  press(input, 'jump');
  step(session, input, 1 / 60);
  expect(session.player.jumpBuf).toBeGreaterThan(0);

  step(session, createInputState(), 1 / 60);

  expect(session.player.grounded).toBe(false);
  expect(session.player.vy).toBeLessThan(-240);
  expect(session.player.jumpBuf).toBeLessThanOrEqual(0);
});

test('spike hazards hurt once, apply invulnerability, and can kill after invulnerability expires', () => {
  const level = makeGameplayLevel({
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
  const level = makeGameplayLevel({
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
    x: session.player.x + 60,
    y: session.player.y + 8,
    w: 32,
    h: 32,
    vx: 0,
    vy: 0,
    hp: 2,
    hurt: 0,
    min: 0,
    max: level.worldWidth
  });

  const input = createInputState();
  press(input, 'attack');
  step(session, input);

  expect(session.enemies[0]).toMatchObject({ hp: 1, hurt: expect.any(Number), vx: 180 });
  expect(session.player.hp).toBe(5);
});

test('finish gate trigger completes the gameplay session and freezes later gameplay updates', () => {
  const level = makeGameplayLevel({
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
  session.player.x = 10 * level.tileSize;
  session.player.y = 1 * level.tileSize;

  step(session);
  expect(session.outcome).toBe('completed');

  const xAfterWin = session.player.x;
  const input = createInputState();
  hold(input, 'right');
  step(session, input, 0.5);
  expect(session.player.x).toBe(xAfterWin);
});
