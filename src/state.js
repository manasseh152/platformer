import { CAMERA_HEIGHT, CAMERA_WIDTH } from './constants.js';
import { centerCameraOnPlayer, createCamera } from './camera.js';
import { createEnemies, createPlayer, level } from './level.js';
import { createInputState } from './input.js';
import { applySettingsToGame, loadSettings } from './settings.js';

/**
 * Creates the mutable game context shared by systems.
 */
export function createGame(ui) {
  const ctx = ui.canvas.getContext('2d');
  const game = {
    canvas: ui.canvas,
    ctx,
    ui,
    view: {
      width: CAMERA_WIDTH,
      height: CAMERA_HEIGHT,
      dpr: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      resizeDebounce: 0,
      firstResizeDone: false
    },
    flags: {
      started: false,
      paused: false,
      won: false
    },
    level,
    player: createPlayer(level.spawn),
    enemies: createEnemies(level),
    dust: [],
    particles: [],
    camera: createCamera(),
    input: createInputState(),
    settings: loadSettings(),
    menu: { page: 'main', origin: 'pause', direction: 'forward' },
    clock: { last: performance.now() }
  };
  centerCameraOnPlayer(game.camera, game.player, game.view);
  applySettingsToGame(game);
  return game;
}

export function resetGame(game) {
  setPausedFlag(game, false);
  Object.assign(game.player, createPlayer(game.level.spawn));
  game.enemies.length = 0;
  game.enemies.push(...createEnemies(game.level));
  game.particles.length = 0;
  game.dust.length = 0;
  game.flags.won = false;
  centerCameraOnPlayer(game.camera, game.player, game.view);
  game.camera.shake = 0;
}

export function setPausedFlag(game, value) {
  game.flags.paused = value;
  game.input.keys.clear();
  game.input.pressed.clear();
  document.body.classList.toggle('paused', value);
  game.clock.last = performance.now();
}
