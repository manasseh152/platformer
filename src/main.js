import { getUI } from './dom.js';
import { controlsText, hasPressed, pollGamepads, setInputScheme } from './input.js';
import { handleGamepadMenuInput, handleListeningKey, activeMenuRoot, closeStartSettings, renderBinds, setupMenu, setPaused, startGame } from './menu.js';
import { updateGame } from './physics.js';
import { drawGame } from './render.js';
import { setupResize } from './resize.js';
import { createGame, resetGame } from './state.js';

const ui = getUI();
const game = createGame(ui);
game.controlsText = () => controlsText(game.input);
game.resetGame = () => resetGame(game);

setupMenu(game);
setupResize(game);

addEventListener('keydown', e => {
  const { input, player } = game;
  if (input.listeningFor) {
    e.preventDefault();
    handleListeningKey(game, e.code);
    return;
  }

  const root = activeMenuRoot(game);
  const active = document.activeElement;
  const menuFocused = root && active && root.contains(active);
  const activatable = active?.matches?.('button, input[type="checkbox"]');

  if (menuFocused && activatable && ['Enter', 'Space'].includes(e.code)) {
    e.preventDefault();
    active.click();
    return;
  }

  if (e.code === 'Escape') {
    if (document.body.classList.contains('start-settings')) { e.preventDefault(); closeStartSettings(game); return; }
    if (game.flags.started && game.flags.paused && ui.pauseScreen.classList.contains('settings-open')) { e.preventDefault(); ui.backButton.click(); return; }
  }

  if (e.code.startsWith('Arrow')) setInputScheme(game, 'arrows');
  else if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) setInputScheme(game, 'wasd');

  const pauseHit = input.binds.pause.includes(e.code);
  if (!game.flags.started && ['Enter','Space'].includes(e.code)) startGame(game);
  else if (game.flags.started && !player.dead && !game.flags.won && pauseHit) setPaused(game, !game.flags.paused);
  if (!game.flags.paused && !input.keys.has(e.code)) input.pressed.add(e.code);
  input.keys.add(e.code);
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
});

addEventListener('keyup', e => game.input.keys.delete(e.code));

function frame(now = performance.now()) {
  const dt = Math.min(.033, (now - game.clock.last) / 1000);
  game.clock.last = now;
  pollGamepads(game);
  if (game.input.bindRenderDirty) {
    game.input.bindRenderDirty = false;
    renderBinds(game);
  }
  const menuUsedGamepad = game.input.useController && handleGamepadMenuInput(game);
  if (!menuUsedGamepad && game.flags.started && !game.player.dead && !game.flags.won && hasPressed(game.input, 'pause')) {
    setPaused(game, !game.flags.paused);
  }
  if (game.flags.started && !game.flags.paused) updateGame(game, dt);
  else {
    game.input.pressed.clear();
    game.input.gamepadPressed.clear();
  }
  drawGame(game);
}

function loop(now) {
  frame(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
