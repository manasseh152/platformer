import { getUI } from '#/app/dom.js';
import { pollGamepads } from '#/app/input/controller-diagnostics.js';
import { controlsText, setInputScheme } from '#/app/input/input-presentation.js';
import { syncHintLayer } from '#/app/ui/hint-layer.js';
import { activateSemanticMenuAction, handleMenuInput } from '#/app/ui/menu/menu-input.js';
import { setupMenu } from '#/app/ui/menu/menu-setup.js';
import { activeMenuRoot, setPaused, startGame } from '#/app/ui/menu/menu-shell.js';
import { leaveSettingsLayer } from '#/app/ui/menu/settings-layer-navigation.js';
import { createNativeBackAdapter } from '#/app/navigation/native-back.js';
import { handleListeningKey, handleListeningPointer } from '#/app/ui/settings/settings-actions.js';
import { setupPresentationResize } from '#/app/presentation/resize.js';
import { resetGame } from '#/app/game-state.js';
import { createGameApp } from '#/app/game-app.js';
import { syncGymApi } from '#/app/testing/gym.js';
import { createRuntime } from '#/app/runtime/browser-runtime.js';
import { createSceneHost } from '#/app/scenes/scene-host.js';
import { createGameplayScene } from '#/scenes/gameplay-scene.js';
import { applyScenarioLaunchParams, readScenarioLaunchParams } from '#/catalog/scenarios/url.js';
import { isPaused, isStarted, isWon } from '#/app/app-state.js';
import { applyTilemapPreviewFromUrl } from '#/app/tilemaps/tilemap-preview.js';
import { handleDevToolsInput, handleDevToolsKeydown, setupDevTools, syncDevTools } from '#/devtools/toolbox-dom.js';
import { updateSpeedRun } from '#/app/speedrun/speedrun.js';

const runtime = createRuntime();
const ui = getUI();
const game = createGameApp(ui, runtime);
const scenes = createSceneHost(runtime);
runtime.scenes = scenes;
game.controlsText = () => controlsText(game.input);
syncHintLayer(game);
game.resetGame = () => resetGame(game, runtime);

setupMenu(game, runtime);
game.nativeBack = createNativeBackAdapter({
  canGoBack: () => ['level-select', 'settings', 'settings-category'].includes(game.menu.page) || (isStarted(game) && isPaused(game)),
  onBack: () => {
    if (game.menu.page === 'settings-category') leaveSettingsLayer(game);
    else activateSemanticMenuAction(game, 'menu.back');
  }
});
game.nativeBack.sync();
setupDevTools(game);
scenes.register(createGameplayScene(game));
scenes.switchScene('gameplay');
const launchParams = readScenarioLaunchParams();
const previewLaunch = applyTilemapPreviewFromUrl(game, runtime);
const urlLaunch = previewLaunch.handled ? previewLaunch : applyScenarioLaunchParams(game, launchParams, runtime);
if (urlLaunch.ok && launchParams.autorun) startGame(game, runtime);
syncGymApi(game, runtime);
setupPresentationResize(game);

addEventListener('keydown', e => {
  const { input } = game;

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

  if (game.settings.input.profileSwitching === 'auto') {
    if (e.code.startsWith('Arrow')) setInputScheme(game, 'arrows');
    else if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) setInputScheme(game, 'wasd');
  }

  if (!isStarted(game) && ['Enter','Space'].includes(e.code)) startGame(game, runtime);
  if (!isPaused(game) && !input.keys.has(e.code)) input.pressed.add(e.code);
  input.keys.add(e.code);
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
});

addEventListener('keyup', e => {
  game.inputAdapter?.queueKeyboardEvent(e);
  game.input.keys.delete(e.code);
});

addEventListener('pointerdown', e => {
  if (game.input.listeningFor && handleListeningPointer(game, e, runtime)) return;
  if (e.target !== ui.canvas) return;
  game.inputAdapter?.queuePointerButtonEvent(e);
  if (game.settings.input.profileSwitching === 'auto') setInputScheme(game, 'keyboard-mouse');
});

addEventListener('pointerup', e => {
  if (e.target === ui.canvas) game.inputAdapter?.queuePointerButtonEvent(e);
});

addEventListener('wheel', e => {
  if (game.input.listeningFor && handleListeningPointer(game, e, runtime)) return;
  if (e.target !== ui.canvas) return;
  game.inputAdapter?.queueWheelEvent(e);
  if (game.settings.input.profileSwitching === 'auto') setInputScheme(game, 'keyboard-mouse');
}, { passive: false });

ui.canvas?.addEventListener('contextmenu', event => event.preventDefault());

function frame(now = runtime.now()) {
  const dt = Math.min(.033, (now - game.clock.last) / 1000);
  game.clock.last = now;
  game.inputAdapter?.beginFrame({ controllerEnabled: game.settings.input.slots.player1.devices.gamepad.enabled });
  pollGamepads(runtime, game);
  const menuUsedGamepad = handleMenuInput(game);
  const globalInput = game.inputRuntime?.route(['global']);
  const devToolsHandled = handleDevToolsInput(game, globalInput, { setPaused: (game, value) => setPaused(game, value, runtime) });
  const pausePressed = !devToolsHandled && game.inputRuntime?.route(['gameplay']).wasPressed('system.pause');
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
  game.gpu?.render?.({ game });
}

function loop(now) {
  frame(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
