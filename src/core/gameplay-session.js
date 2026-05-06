import { centerCameraOnPlayer } from './camera.js';
import { createCamera } from './camera.js';
import { createEnemiesFromScene, createPlayerFromScene } from './gameplay-scene-queries.js';

export function createGameplaySession(tilemap, { view, scenarioId = null, goal = { type: 'finish-gate' } } = {}) {
  if (!tilemap) throw new Error('createGameplaySession requires a tilemap');
  const player = createPlayerFromScene(tilemap);
  const session = {
    scenarioId,
    tilemap,
    goal,
    outcome: 'active',
    player,
    enemies: createEnemiesFromScene(tilemap),
    dust: [],
    particles: [],
    camera: createCamera()
  };
  if (view) centerCameraOnPlayer(session.camera, session.player, view);
  return session;
}

export function resetGameplaySession(session, tilemap = session.tilemap, { view, scenarioId = session.scenarioId, goal = session.goal } = {}) {
  const next = createGameplaySession(tilemap, { view, scenarioId, goal });
  session.scenarioId = next.scenarioId;
  session.tilemap = next.tilemap;
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
  game.tilemap = session.tilemap;
  game.player = session.player;
  game.enemies = session.enemies;
  game.dust = session.dust;
  game.particles = session.particles;
  game.camera = session.camera;
  return game;
}
