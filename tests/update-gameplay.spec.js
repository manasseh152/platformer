import { expect, test } from '@playwright/test';
import { updateGameplay } from '#/core/physics.js';
import { createGameplaySession } from '#/core/gameplay-session.js';
import { getTilemapById } from '#/content/tilemaps/registry.js';
import { getGoalTriggerRect } from '#/core/tilemaps/tilemap.js';
import { createInputRuntime } from '#/core/input/index.js';
import { gameInputProfile } from '#/app/input/game-input-profile.js';
import { createBrowserInputAdapter, createGameInputRuntime } from '#/app/input/browser-input-adapter.js';

test('updateGameplay completes session outcome through finish gate goal', () => {
  const level = getTilemapById('finish-gate-gym-map');
  const session = createGameplaySession(level, { scenarioId: 'finish-gate-gym' });
  const input = createInputRuntime(gameInputProfile);
  const trigger = getGoalTriggerRect(level);
  session.player.x = trigger.x + 1;
  session.player.y = trigger.y + 1;
  session.player.vx = 0;
  session.player.vy = 0;

  updateGameplay({ random: () => 1 }, session, input, 0.016);

  expect(session.outcome).toBe('completed');
});

test('updateGameplay accepts semantic core input runtime controls', () => {
  const level = getTilemapById('movement-gym-map');
  const session = createGameplaySession(level, { scenarioId: 'movement-gym' });
  const input = createInputRuntime(gameInputProfile);
  const startX = session.player.x;

  input.beginFrame();
  input.handleEvent({ type: 'keydown', code: 'KeyD' });
  input.handleEvent({ type: 'keydown', code: 'Space' });
  updateGameplay({ random: () => 1 }, session, input, 0.016);

  expect(session.player.vx).toBeGreaterThan(0);
  expect(session.player.jumpBuf).toBeGreaterThan(0);
  expect(session.player.x).toBeGreaterThanOrEqual(startX);
});

test('browser input adapter feeds semantic gameplay controls', () => {
  const level = getTilemapById('movement-gym-map');
  const session = createGameplaySession(level, { scenarioId: 'movement-gym' });
  const input = createGameInputRuntime();
  const adapter = createBrowserInputAdapter(input, { gamepads: () => [] });

  adapter.queueKeyboardEvent({ type: 'keydown', code: 'KeyD', timeStamp: 1 });
  adapter.queueKeyboardEvent({ type: 'keydown', code: 'Space', timeStamp: 1 });
  adapter.beginFrame();
  updateGameplay({ random: () => 1 }, session, input, 0.016);

  expect(session.player.vx).toBeGreaterThan(0);
  expect(session.player.jumpBuf).toBeGreaterThan(0);
});

test('browser input adapter clears disconnected gamepad controls', () => {
  let pads = [{
    id: 'Mock Controller',
    index: 0,
    mapping: 'standard',
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: index === 0 })),
    axes: [0, 0]
  }];
  const input = createGameInputRuntime();
  const adapter = createBrowserInputAdapter(input, { gamepads: () => pads });

  adapter.beginFrame();
  expect(input.isDown('player.jump')).toBe(true);

  pads = [];
  adapter.beginFrame();
  expect(input.isDown('player.jump')).toBe(false);
});

test('updateGameplay uses injected restart control without needing full game object', () => {
  const level = getTilemapById('movement-gym-map');
  const session = createGameplaySession(level, { scenarioId: 'movement-gym' });
  const input = createInputRuntime(gameInputProfile);
  let restarted = 0;
  input.beginFrame();
  input.handleEvent({ type: 'keydown', code: 'KeyR' });

  updateGameplay({ random: () => 1 }, session, input, 0.016, { resetGame: () => restarted++ });

  expect(restarted).toBe(1);
});
