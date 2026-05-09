export {
  drawBackdropLayer,
  drawDecorLayer,
  drawDungeonBackdrop,
  drawGoal,
  drawSpikeLayer,
  drawTilemap
} from './render/world-renderer.js';

import { syncGameplayHudPresentation } from './app/ui/gameplay-hud.js';
import { drawGameWorld } from './render/world-renderer.js';

export { syncGameplayHud, syncGameplayHudPresentation } from './app/ui/gameplay-hud.js';
export { drawGameWorld } from './render/world-renderer.js';

export function drawGame(runtime, game) {
  if (!game) {
    game = runtime;
    runtime = { now: () => performance.now(), random: Math.random };
  }

  const { subpixelOffsetX, subpixelOffsetY } = drawGameWorld(runtime, game);
  syncGameplayHudPresentation(game);
  game.presenter.present(subpixelOffsetX, subpixelOffsetY);
}
