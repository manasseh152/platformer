/**
 * @deprecated Temporary render facade for legacy imports. New code should import
 * `render/gameplay-render-pipeline.js` or packet extractors/backends directly.
 */
import { renderGameplayFrame } from './render/gameplay-render-pipeline.js';

export { renderGameplayFrame } from './render/gameplay-render-pipeline.js';
export { syncGameplayHud, syncGameplayHudPresentation } from './app/ui/gameplay-hud.js';

/** @deprecated Use renderGameplayFrame from render/gameplay-render-pipeline.js. */
export function drawGame(runtime, game) {
  return renderGameplayFrame(runtime, game);
}
