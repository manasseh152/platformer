import { WORLD_HEIGHT, WORLD_WIDTH } from './constants.js';

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function approachExp(current, target, sharpness, dt) {
  return current + (target - current) * (1 - Math.exp(-sharpness * dt));
}

export function clampCameraToWorld(camera, view, worldWidth = WORLD_WIDTH, worldHeight = WORLD_HEIGHT) {
  const maxX = Math.max(0, worldWidth - view.width);
  const maxY = Math.max(0, worldHeight - view.height);
  camera.x = clamp(camera.x, 0, maxX);
  camera.y = clamp(camera.y, 0, maxY);
  camera.targetX = clamp(camera.targetX ?? camera.x, 0, maxX);
  camera.targetY = clamp(camera.targetY ?? camera.y, 0, maxY);
  return camera;
}

export function createCamera(overrides = {}) {
  return {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    shake: 0,
    mode: 'follow',
    lookAheadX: 83,
    smoothingX: 8,
    smoothingY: 4,
    deadzone: {
      left: 258,
      right: 422,
      top: 138,
      bottom: 266
    },
    ...overrides
  };
}

export function centerCameraOnPlayer(camera, player, view, worldWidth = WORLD_WIDTH, worldHeight = WORLD_HEIGHT) {
  camera.x = player.x + player.w / 2 - view.width / 2;
  camera.y = player.y + player.h / 2 - view.height / 2;
  camera.targetX = camera.x;
  camera.targetY = camera.y;
  return clampCameraToWorld(camera, view, worldWidth, worldHeight);
}

export function updateFollowCamera(game, dt) {
  const { camera, player, view } = game;
  const worldWidth = game.level?.worldWidth ?? WORLD_WIDTH;
  const worldHeight = game.level?.worldHeight ?? WORLD_HEIGHT;
  const deadzone = camera.deadzone;
  const playerX = player.x + player.w / 2 + player.dir * camera.lookAheadX;
  const playerY = player.y + player.h / 2;

  let targetX = camera.targetX;
  let targetY = camera.targetY;

  if (playerX < camera.x + deadzone.left) targetX = playerX - deadzone.left;
  else if (playerX > camera.x + deadzone.right) targetX = playerX - deadzone.right;

  if (playerY < camera.y + deadzone.top) targetY = playerY - deadzone.top;
  else if (playerY > camera.y + deadzone.bottom) targetY = playerY - deadzone.bottom;

  const maxX = Math.max(0, worldWidth - view.width);
  const maxY = Math.max(0, worldHeight - view.height);
  camera.targetX = clamp(targetX, 0, maxX);
  camera.targetY = clamp(targetY, 0, maxY);

  camera.x = approachExp(camera.x, camera.targetX, camera.smoothingX, dt);
  camera.y = approachExp(camera.y, camera.targetY, camera.smoothingY, dt);
  clampCameraToWorld(camera, view, worldWidth, worldHeight);
}

export function updateCamera(game, dt) {
  if (game.camera.mode === 'follow') updateFollowCamera(game, dt);
  game.camera.shake = Math.max(0, game.camera.shake - dt);
}
