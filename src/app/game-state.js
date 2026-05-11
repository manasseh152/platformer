/**
 * Application composition root for the mutable compatibility game object.
 * Intentionally outside `src/core`: wires UI canvas, presentation, browser runtime, DOM mirrors,
 * app adapters, and core gameplay state together.
 */
import { CAMERA_HEIGHT, CAMERA_WIDTH, CAMERA_WORLD_HEIGHT, CAMERA_WORLD_WIDTH } from '#/core/constants.js';
import { createGameplaySession, resetGameplaySession, syncGameplaySessionToGame } from '#/core/gameplay-session.js';
import { createTilemapManager, resolveInitialTilemap } from './tilemaps/tilemap-manager.js';
import { createInputState } from './input/input-ui-state.js';
import { createBrowserInputAdapter, createGameInputRuntime } from './input/browser-input-adapter.js';
import { createPresentation } from './presentation/presentation.js';
import { applySettingsToGame, loadSettings } from './settings/settings.js';
import { browserRuntime } from './runtime/browser-runtime.js';
import { createScenarioService } from '#/catalog/scenarios/service.js';
import { createDefaultSceneLibrary } from '#/scenes/default-library.js';
import { createAppState, setPausedState } from './app-state.js';
import { createGpuSystem } from '#/gpu/gpu-system.js';
import { createDevToolsState, registerBuiltInDevTools } from '#/devtools/toolbox.js';
import { registerDebugRenderDevTools } from '#/devtools/debug-render.js';
import { registerGymDevTools } from '#/devtools/gym.js';
import { createSpeedRunState, prepareSpeedRunAttempt } from './speedrun/speedrun.js';

/**
 * Creates the mutable game context shared by systems.
 */
export function createGame(ui, runtime = browserRuntime) {
  const presentation = createPresentation(ui.canvas, CAMERA_WIDTH, CAMERA_HEIGHT);
  const settings = loadSettings(runtime.storage);
  const activeTilemap = resolveInitialTilemap(settings);
  const gpu = createGpuSystem({ settings });
  const gameplaySession = createGameplaySession(activeTilemap, { view: null, scenarioId: activeTilemap.id });
  const game = {
    runtime,
    canvas: ui.canvas,
    renderCanvas: presentation.renderCanvas,
    ctx: presentation.renderCtx,
    presentation,
    gpu,
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
    appState: createAppState(),
    gameplaySession,
    tilemap: gameplaySession.tilemap,
    tilemaps: null,
    player: gameplaySession.player,
    enemies: gameplaySession.enemies,
    dust: gameplaySession.dust,
    particles: gameplaySession.particles,
    camera: gameplaySession.camera,
    input: createInputState(),
    inputRuntime: createGameInputRuntime(settings),
    inputAdapter: null,
    settings,
    speedRun: createSpeedRunState(runtime.storage),
    devTools: createDevToolsState(),
    gym: null,
    session: { developerModeOverride: false },
    scenarios: null,
    sceneLibrary: null,
    menu: { page: 'main', origin: 'pause', direction: 'forward', settingsSubpage: null },
    clock: { last: runtime.now() }
  };
  resetGameplaySession(gameplaySession, activeTilemap, { view: game.view, scenarioId: activeTilemap.id });
  syncGameplaySessionToGame(game, gameplaySession);
  game.inputAdapter = createBrowserInputAdapter(game.inputRuntime, { now: runtime.now });
  game.tilemaps = createTilemapManager(game, runtime);
  game.sceneLibrary = createDefaultSceneLibrary();
  game.scenarios = createScenarioService(game, runtime);
  game.scenarios.select(activeTilemap.id);
  registerBuiltInDevTools(game);
  registerGymDevTools(game);
  registerDebugRenderDevTools(game);
  applySettingsToGame(game);
  if (game.settings.gpuExtras === 'auto') {
    game.presentation.tryEnableWebGpu?.(game.gpu).then(enabled => {
      if (enabled) runtime.emit('gpu.presentation-enabled', { mode: game.presentation.mode });
    });
  }
  const tilemapId = game.tilemap?.id || 'act-01-level-1';
  document.body.dataset.tilemapId = tilemapId;
  return game;
}

export function resetGame(game, runtime = browserRuntime) {
  if (!game.appState?.paused) setPausedFlag(game, false, runtime);
  game.tilemaps.restartTilemap();
  prepareSpeedRunAttempt(game);
  runtime.emit('game.reset', { tilemapId: game.tilemap?.id || 'act-01-level-1' });
}

export function setPausedFlag(game, value, runtime = browserRuntime) {
  setPausedState(game, value);
  game.input.keys.clear();
  game.input.pressed.clear();
  document.body.classList.toggle('paused', value);
  game.clock.last = runtime.now();
}
