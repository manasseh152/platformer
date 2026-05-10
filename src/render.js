/**
 * @deprecated Temporary render facade for legacy imports. New code should import
 * `render/gameplay-render-pipeline.js` or packet extractors/backends directly.
 */
export {
  drawBackdropLayer,
  drawDecorLayer,
  drawDungeonBackdrop,
  drawGoal,
  drawSpikeLayer,
  drawTilemap
} from './render/world-renderer.js';

import { renderGameplayFrame } from './render/gameplay-render-pipeline.js';

export { syncGameplayHud, syncGameplayHudPresentation } from './app/ui/gameplay-hud.js';
/** @deprecated Use render/gameplay-render-pipeline.js. */
export { drawGameWorld } from './render/world-renderer.js';

/** @deprecated Use renderGameplayFrame from render/gameplay-render-pipeline.js. */
export function drawGame(runtime, game) {
  renderGameplayFrame(runtime, game);
}
