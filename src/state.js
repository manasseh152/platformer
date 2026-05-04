import { WORLD_HEIGHT, WORLD_WIDTH } from './constants.js';
import { createEnemies, createPlayer, level } from './level.js';
import { createInputState } from './input.js';

/**
 * Creates the mutable game context shared by systems.
 */
export function createGame(ui) {
  const ctx = ui.canvas.getContext('2d');
  return {
    canvas: ui.canvas,
    ctx,
    ui,
    view: {
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
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
    enemies: createEnemies(),
    dust: [],
    particles: [],
    camera: { x: 0, shake: 0 },
    input: createInputState(),
    clock: { last: performance.now() }
  };
}

export function resetGame(game) {
  setPausedFlag(game, false);
  Object.assign(game.player, createPlayer(game.level.spawn));
  game.enemies.length = 0;
  game.enemies.push(...createEnemies());
  game.particles.length = 0;
  game.dust.length = 0;
  game.flags.won = false;
  game.camera.shake = 0;
}

export function setPausedFlag(game, value) {
  game.flags.paused = value;
  game.input.keys.clear();
  game.input.pressed.clear();
  document.body.classList.toggle('paused', value);
  game.clock.last = performance.now();
}
