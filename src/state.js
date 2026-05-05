import { CAMERA_HEIGHT, CAMERA_WIDTH, CAMERA_WORLD_HEIGHT, CAMERA_WORLD_WIDTH } from './constants.js';
import { centerCameraOnPlayer, createCamera } from './camera.js';
import { createEnemies, createPlayer, getSpawnPoint } from './levels/tilemap.js';
import { createLevelManager, resolveInitialLevel } from './level-manager.js';
import { createInputState } from './input.js';
import { createPresenter } from './presenter.js';
import { applySettingsToGame, loadSettings } from './settings.js';
import { browserRuntime } from './runtime.js';

/**
 * Creates the mutable game context shared by systems.
 */
export function createGame(ui, runtime = browserRuntime) {
  const presenter = createPresenter(ui.canvas, CAMERA_WIDTH, CAMERA_HEIGHT);
  const settings = loadSettings(runtime.storage);
  const activeLevel = resolveInitialLevel(settings);
  const game = {
    runtime,
    canvas: ui.canvas,
    renderCanvas: presenter.renderCanvas,
    ctx: presenter.renderCtx,
    presenter,
    ui,
    view: {
      width: CAMERA_WORLD_WIDTH,
      height: CAMERA_WORLD_HEIGHT,
      bufferWidth: CAMERA_WIDTH,
      bufferHeight: CAMERA_HEIGHT,
      dpr: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      displayScale: 1,
      displayOffsetX: 0,
      displayOffsetY: 0,
      resizeDebounce: 0,
      firstResizeDone: false
    },
    flags: {
      started: false,
      paused: false,
      won: false
    },
    level: activeLevel,
    levels: null,
    player: createPlayer(getSpawnPoint(activeLevel)),
    enemies: createEnemies(activeLevel),
    dust: [],
    particles: [],
    camera: createCamera(),
    input: createInputState(),
    settings,
    menu: { page: 'main', origin: 'pause', direction: 'forward' },
    clock: { last: runtime.now() }
  };
  centerCameraOnPlayer(game.camera, game.player, game.view);
  game.levels = createLevelManager(game, runtime);
  applySettingsToGame(game);
  document.body.dataset.levelId = game.level?.id || 'act-01-level-1';
  return game;
}

export function resetGame(game, runtime = browserRuntime) {
  setPausedFlag(game, false, runtime);
  game.levels.restartLevel();
  runtime.emit('game.reset', { levelId: game.level?.id || 'act-01-level-1' });
}

export function setPausedFlag(game, value, runtime = browserRuntime) {
  game.flags.paused = value;
  game.input.keys.clear();
  game.input.pressed.clear();
  document.body.classList.toggle('paused', value);
  game.clock.last = runtime.now();
}
