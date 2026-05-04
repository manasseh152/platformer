import { CAMERA_HEIGHT, CAMERA_WIDTH, CAMERA_WORLD_HEIGHT, CAMERA_WORLD_WIDTH } from './constants.js';
import { centerCameraOnPlayer, createCamera } from './camera.js';
import { createEnemies, createPlayer, getLevelById, getSpawnPoint, level as mainLevel } from './level.js';
import { createInputState } from './input.js';
import { createPresenter } from './presenter.js';
import { applySettingsToGame, loadSettings } from './settings.js';

function syncActiveLevelDataset(game) {
  document.body.dataset.levelId = game.level?.id || 'main';
}

function requestedDeveloperLevel(settings) {
  const requested = new URLSearchParams(location.search).get('level');
  const candidate = requested ? getLevelById(requested) : null;
  return settings.developerMode && candidate ? candidate : mainLevel;
}

/**
 * Creates the mutable game context shared by systems.
 */
export function createGame(ui) {
  const presenter = createPresenter(ui.canvas, CAMERA_WIDTH, CAMERA_HEIGHT);
  const settings = loadSettings();
  const activeLevel = requestedDeveloperLevel(settings);
  const game = {
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
    player: createPlayer(getSpawnPoint(activeLevel)),
    enemies: createEnemies(activeLevel),
    dust: [],
    particles: [],
    camera: createCamera(),
    input: createInputState(),
    settings,
    menu: { page: 'main', origin: 'pause', direction: 'forward' },
    clock: { last: performance.now() }
  };
  centerCameraOnPlayer(game.camera, game.player, game.view);
  applySettingsToGame(game);
  syncActiveLevelDataset(game);
  return game;
}

function resetWorld(game) {
  Object.assign(game.player, createPlayer(getSpawnPoint(game.level)));
  game.enemies.length = 0;
  game.enemies.push(...createEnemies(game.level));
  game.particles.length = 0;
  game.dust.length = 0;
  game.flags.won = false;
  centerCameraOnPlayer(game.camera, game.player, game.view);
  game.camera.shake = 0;
}

export function setActiveLevel(game, levelId) {
  const nextLevel = getLevelById(levelId);
  if (!nextLevel) return false;
  game.level = nextLevel;
  syncActiveLevelDataset(game);
  resetWorld(game);
  return true;
}

export function resetGame(game) {
  setPausedFlag(game, false);
  resetWorld(game);
}

export function setPausedFlag(game, value) {
  game.flags.paused = value;
  game.input.keys.clear();
  game.input.pressed.clear();
  document.body.classList.toggle('paused', value);
  game.clock.last = performance.now();
}
