import { expect, test } from '@playwright/test';
import { createGameplaySession, resetGameplaySession, syncGameplaySessionToGame } from '../src/core/gameplay-session.js';
import { getTilemapLevelDefinitionById } from '../src/core/tilemaps/registry.js';

test('gameplay session owns tilemap runtime state', () => {
  const level = getTilemapLevelDefinitionById('act-01-level-1');
  const session = createGameplaySession(level, { scenarioId: 'act-01-level-1', goal: { type: 'finish-gate' } });

  expect(session).toMatchObject({
    scenarioId: 'act-01-level-1',
    tilemapLevelDefinition: level,
    levelDefinition: level,
    level,
    goal: { type: 'finish-gate' },
    outcome: 'active',
    player: expect.any(Object),
    camera: expect.any(Object)
  });
  expect(session.enemies.length).toBeGreaterThan(0);
});

test('gameplay session reset replaces mutable runtime collections in place', () => {
  const level = getTilemapLevelDefinitionById('act-01-level-1');
  const gym = getTilemapLevelDefinitionById('movement-gym-map');
  const session = createGameplaySession(level, { scenarioId: 'act-01-level-1' });
  const enemies = session.enemies;
  const particles = session.particles;

  session.particles.push({ id: 'old' });
  resetGameplaySession(session, gym, { scenarioId: 'movement-gym' });

  expect(session.tilemapLevelDefinition).toBe(gym);
  expect(session.scenarioId).toBe('movement-gym');
  expect(session.enemies).toBe(enemies);
  expect(session.particles).toBe(particles);
  expect(session.particles).toEqual([]);
});

test('gameplay session can sync compatibility fields onto game', () => {
  const level = getTilemapLevelDefinitionById('enemy-zoo-map');
  const session = createGameplaySession(level, { scenarioId: 'enemy-zoo' });
  const game = {};

  syncGameplaySessionToGame(game, session);

  expect(game.gameplaySession).toBe(session);
  expect(game.level).toBe(level);
  expect(game.player).toBe(session.player);
  expect(game.enemies).toBe(session.enemies);
});
