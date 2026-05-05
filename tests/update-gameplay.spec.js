import { expect, test } from '@playwright/test';
import { updateGameplay } from '../src/core/physics.js';
import { createGameplaySession } from '../src/core/gameplay-session.js';
import { getTilemapLevelDefinitionById } from '../src/core/tilemaps/registry.js';
import { createInputState } from '../src/input.js';
import { getGoalTriggerRect } from '../src/core/tilemaps/tilemap.js';

test('updateGameplay completes session outcome through finish gate goal', () => {
  const level = getTilemapLevelDefinitionById('finish-gate-gym-map');
  const session = createGameplaySession(level, { scenarioId: 'finish-gate-gym' });
  const input = createInputState();
  const trigger = getGoalTriggerRect(level);
  session.player.x = trigger.x + 1;
  session.player.y = trigger.y + 1;
  session.player.vx = 0;
  session.player.vy = 0;

  updateGameplay({ random: () => 1 }, session, input, 0.016);

  expect(session.outcome).toBe('completed');
});

test('updateGameplay uses injected restart control without needing full game object', () => {
  const level = getTilemapLevelDefinitionById('movement-gym-map');
  const session = createGameplaySession(level, { scenarioId: 'movement-gym' });
  const input = createInputState();
  let restarted = 0;
  input.pressed.add('KeyR');

  updateGameplay({ random: () => 1 }, session, input, 0.016, { resetGame: () => restarted++ });

  expect(restarted).toBe(1);
});
