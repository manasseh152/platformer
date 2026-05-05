import { centerCameraOnPlayer } from './camera.js';
import { createEnemies, createPlayer, getSpawnPoint } from './tilemaps/tilemap.js';
import { createCamera } from './camera.js';

export function createGameplaySession(tilemapLevelDefinition, { view, scenarioId = null, goal = { type: 'finish-gate' } } = {}) {
  if (!tilemapLevelDefinition) throw new Error('createGameplaySession requires a tilemap level definition');
  const player = createPlayer(getSpawnPoint(tilemapLevelDefinition));
  const session = {
    scenarioId,
    tilemapLevelDefinition,
    levelDefinition: tilemapLevelDefinition,
    level: tilemapLevelDefinition,
    goal,
    outcome: 'active',
    player,
    enemies: createEnemies(tilemapLevelDefinition),
    dust: [],
    particles: [],
    camera: createCamera()
  };
  if (view) centerCameraOnPlayer(session.camera, session.player, view);
  return session;
}

export function resetGameplaySession(session, tilemapLevelDefinition = session.tilemapLevelDefinition, { view, scenarioId = session.scenarioId, goal = session.goal } = {}) {
  const next = createGameplaySession(tilemapLevelDefinition, { view, scenarioId, goal });
  session.scenarioId = next.scenarioId;
  session.tilemapLevelDefinition = next.tilemapLevelDefinition;
  session.levelDefinition = next.levelDefinition;
  session.level = next.level;
  session.goal = next.goal;
  session.outcome = next.outcome;
  Object.assign(session.player, next.player);
  session.enemies.length = 0;
  session.enemies.push(...next.enemies);
  session.dust.length = 0;
  session.particles.length = 0;
  Object.assign(session.camera, next.camera);
  return session;
}

export function syncGameplaySessionToGame(game, session) {
  game.gameplaySession = session;
  game.level = session.tilemapLevelDefinition;
  game.player = session.player;
  game.enemies = session.enemies;
  game.dust = session.dust;
  game.particles = session.particles;
  game.camera = session.camera;
  return game;
}
