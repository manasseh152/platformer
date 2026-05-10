import { syncGameplayHudPresentation } from '../app/ui/gameplay-hud.js';
import { createCanvas2DNativeFrameBackend } from './backends/canvas2d-native-frame-backend.js';
import { defaultAssetRegistry } from './browser-asset-registry.js';
import { extractGameplayRenderFrame } from './extractors/gameplay-render-extractor.js';

export function ensureCanvas2DNativeFrameBackend(game, assetRegistry = defaultAssetRegistry) {
  const width = game.view.bufferWidth;
  const height = game.view.bufferHeight;
  const backend = game.renderPipeline?.nativeBackend;
  if (backend?.kind === 'canvas2d-native-frame-backend' && backend.canvas === game.renderCanvas) return backend;
  game.renderPipeline = game.renderPipeline ?? {};
  game.renderPipeline.nativeBackend = createCanvas2DNativeFrameBackend({ width, height, canvas: game.renderCanvas, assetRegistry });
  return game.renderPipeline.nativeBackend;
}

export function renderGameplayFrame(runtime, game, { assetRegistry = defaultAssetRegistry } = {}) {
  if (!game) {
    game = runtime;
    runtime = { now: () => performance.now(), random: Math.random };
  }
  const nativeBackend = ensureCanvas2DNativeFrameBackend(game, assetRegistry);
  const { frame } = extractGameplayRenderFrame({ game, runtime, assetRegistry });
  nativeBackend.draw(frame);
  syncGameplayHudPresentation(game);
  game.presenter.presentNativeFrame(nativeBackend.getSource());
}
