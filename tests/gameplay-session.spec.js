import { expect, test } from '@playwright/test';
import { createGameplaySession, resetGameplaySession, syncGameplaySessionToGame } from '../src/core/gameplay-session.js';
import { getTilemapSceneById } from '../src/content/tilemaps/registry.js';

test('gameplay session owns tilemap runtime state', () => {
  const tilemapScene = getTilemapSceneById('act-01-level-1');
  const session = createGameplaySession(tilemapScene, { scenarioId: 'act-01-level-1', goal: { type: 'finish-gate' } });

  expect(session).toMatchObject({
    scenarioId: 'act-01-level-1',
    tilemapScene,
    goal: { type: 'finish-gate' },
    outcome: 'active',
    player: expect.any(Object),
    camera: expect.any(Object)
  });
  expect(session.enemies.length).toBeGreaterThan(0);
});

test('gameplay session reset replaces mutable runtime collections in place', () => {
  const tilemapScene = getTilemapSceneById('act-01-level-1');
  const gym = getTilemapSceneById('movement-gym-map');
  const session = createGameplaySession(tilemapScene, { scenarioId: 'act-01-level-1' });
  const enemies = session.enemies;
  const particles = session.particles;

  session.particles.push({ id: 'old' });
  resetGameplaySession(session, gym, { scenarioId: 'movement-gym' });

  expect(session.tilemapScene).toBe(gym);
  expect(session.scenarioId).toBe('movement-gym');
  expect(session.enemies).toBe(enemies);
  expect(session.particles).toBe(particles);
  expect(session.particles).toEqual([]);
});

test('gameplay session can sync runtime fields onto game', () => {
  const tilemapScene = getTilemapSceneById('enemy-zoo-map');
  const session = createGameplaySession(tilemapScene, { scenarioId: 'enemy-zoo' });
  const game = {};

  syncGameplaySessionToGame(game, session);

  expect(game.gameplaySession).toBe(session);
  expect(game.tilemapScene).toBe(tilemapScene);
  expect(game.player).toBe(session.player);
  expect(game.enemies).toBe(session.enemies);
});
