import { getUI } from './dom.js';
import { controlsText, hasPressed, pollGamepads, renderGameplayHints, setInputScheme } from './input.js';
import { handleMenuInput, handleListeningKey, activeMenuRoot, renderBinds, setupMenu, setPaused, startGame } from './menu.js';
import { syncSettingsFromInput } from './settings.js';
import { setupResize } from './resize.js';
import { resetGame } from './state.js';
import { createGameApp } from './app/game-app.js';
import { syncGymApi } from './gym.js';
import { createRuntime } from './runtime.js';
import { createSceneHost } from './scene-host.js';
import { createGameplayScene } from './scenes/gameplay-scene.js';
import { applyScenarioLaunchParams, readScenarioLaunchParams } from './catalog/scenarios/url.js';
import { isPaused, isStarted, isWon } from './app/app-state.js';
import { applyTilemapPreviewFromUrl } from './tilemap-preview.js';
import { handleDevToolsKeydown, setupDevTools, syncDevTools } from './devtools/toolbox-dom.js';
import { updateSpeedRun } from './speedrun.js';

const runtime = createRuntime();
const ui = getUI();
const game = createGameApp(ui, runtime);
const scenes = createSceneHost(runtime);
runtime.scenes = scenes;
game.controlsText = () => controlsText(game.input);
renderGameplayHints(game);
game.resetGame = () => resetGame(game, runtime);

setupMenu(game, runtime);
setupDevTools(game);
scenes.register(createGameplayScene(game));
scenes.switchScene('gameplay');
const launchParams = readScenarioLaunchParams();
const previewLaunch = applyTilemapPreviewFromUrl(game, runtime);
const urlLaunch = previewLaunch.handled ? previewLaunch : applyScenarioLaunchParams(game, launchParams, runtime);
if (urlLaunch.ok && launchParams.autorun) startGame(game, runtime);
syncGymApi(game, runtime);
setupResize(game);

addEventListener('keydown', e => {
  const { input, player } = game;

  if (input.listeningFor) {
    e.preventDefault();
    handleListeningKey(game, e.code, runtime);
    return;
  }

  if (handleDevToolsKeydown(game, e)) {
    e.preventDefault();
    return;
  }

  game.inputAdapter?.queueKeyboardEvent(e);

  const sceneInput = scenes.handleInput({ type: 'keydown', code: e.code, repeat: e.repeat, originalEvent: e });
  if (sceneInput?.handled) {
    e.preventDefault();
    return;
  }

  const root = activeMenuRoot(game);
  const active = document.activeElement;
  const menuFocused = root && active && root.contains(active);
  const activatable = active?.matches?.('button, input[type="checkbox"]');

  if (menuFocused && activatable && ['Enter', 'Space'].includes(e.code)) {
    e.preventDefault();
    return;
  }

  if (e.code === 'Escape' && ['level-select', 'settings', 'settings-category'].includes(game.menu.page)) {
    e.preventDefault();
    return;
  }

  if (e.code.startsWith('Arrow')) setInputScheme(game, 'arrows');
  else if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) setInputScheme(game, 'wasd');

  const pauseHit = input.binds.pause.includes(e.code);
  if (!isStarted(game) && ['Enter','Space'].includes(e.code)) startGame(game, runtime);
  else if (isStarted(game) && !player.dead && !isWon(game) && pauseHit) {
    e.preventDefault();
    if (!e.repeat) setPaused(game, !isPaused(game), runtime);
    input.keys.add(e.code);
    return;
  }
  if (!isPaused(game) && !input.keys.has(e.code)) input.pressed.add(e.code);
  input.keys.add(e.code);
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
});

addEventListener('keyup', e => {
  game.inputAdapter?.queueKeyboardEvent(e);
  game.input.keys.delete(e.code);
});

function frame(now = runtime.now()) {
  const dt = Math.min(.033, (now - game.clock.last) / 1000);
  game.clock.last = now;
  game.inputAdapter?.beginFrame({ controllerEnabled: game.input.useController });
  pollGamepads(runtime, game);
  if (game.input.bindRenderDirty) {
    game.input.bindRenderDirty = false;
    syncSettingsFromInput(game, runtime.storage);
    runtime.emit('settings.input-sync', { controllerEnabled: game.settings.input.slots.player1.devices.gamepad.enabled });
    renderBinds(game);
  }
  const menuUsedGamepad = handleMenuInput(game);
  const pausePressed = game.inputRuntime?.route(['gameplay']).wasPressed('system.pause') || hasPressed(game.input, 'pause');
  if (!menuUsedGamepad && isStarted(game) && !game.player.dead && !isWon(game) && pausePressed) {
    setPaused(game, !isPaused(game), runtime);
  }
  if (isStarted(game) && !isPaused(game)) {
    scenes.update(dt);
    game.inputRuntime?.endFrame?.();
    updateSpeedRun(game, dt, runtime);
  } else {
    game.input.pressed.clear();
    game.input.gamepadPressed.clear();
    game.inputRuntime?.endFrame?.();
  }
  game.gpu?.update?.(dt);
  syncDevTools(game);
  scenes.render();
  game.gpu?.render?.({ game, presenter: game.presenter });
}

function loop(now) {
  frame(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
