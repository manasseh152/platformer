import { centerCameraOnPlayer } from './camera.js';
import { createCamera } from './camera.js';
import { createEnemiesFromScene, createPlayerFromScene } from './gameplay-scene-queries.js';

export function createGameplaySession(tilemapScene, { view, scenarioId = null, goal = { type: 'finish-gate' } } = {}) {
  if (!tilemapScene) throw new Error('createGameplaySession requires a tilemap scene');
  const player = createPlayerFromScene(tilemapScene);
  const session = {
    scenarioId,
    tilemapScene,
    goal,
    outcome: 'active',
    player,
    enemies: createEnemiesFromScene(tilemapScene),
    dust: [],
    particles: [],
    camera: createCamera()
  };
  if (view) centerCameraOnPlayer(session.camera, session.player, view);
  return session;
}

export function resetGameplaySession(session, tilemapScene = session.tilemapScene, { view, scenarioId = session.scenarioId, goal = session.goal } = {}) {
  const next = createGameplaySession(tilemapScene, { view, scenarioId, goal });
  session.scenarioId = next.scenarioId;
  session.tilemapScene = next.tilemapScene;
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
  game.tilemapScene = session.tilemapScene;
  game.player = session.player;
  game.enemies = session.enemies;
  game.dust = session.dust;
  game.particles = session.particles;
  game.camera = session.camera;
  return game;
}
