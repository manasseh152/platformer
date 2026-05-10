import { syncGameplayHudPresentation } from '../app/ui/gameplay-hud.js';
import { createCanvas2DNativeFrameBackend } from './backends/canvas2d-native-frame-backend.js';
import { createWebGlNativeFrameBackend } from './backends/webgl-native-frame-backend.js';
import { defaultAssetRegistry } from './browser-asset-registry.js';
import { extractGameplayRenderFrame } from './extractors/gameplay-render-extractor.js';

export function ensureNativeFrameBackend(game, { assetRegistry = defaultAssetRegistry, nativeBackendKind = game.renderPipeline?.nativeBackendKind ?? 'canvas2d' } = {}) {
  const width = game.view.bufferWidth;
  const height = game.view.bufferHeight;
  const kind = nativeBackendKind === 'webgl' ? 'webgl' : 'canvas2d';
  const expectedKind = kind === 'webgl' ? 'webgl-native-frame-backend' : 'canvas2d-native-frame-backend';
  const expectedCanvas = kind === 'canvas2d' ? game.renderCanvas : undefined;
  const backend = game.renderPipeline?.nativeBackend;
  if (backend?.kind === expectedKind && (kind === 'webgl' || backend.canvas === expectedCanvas)) return backend;

  game.renderPipeline = game.renderPipeline ?? {};
  backend?.destroy?.();
  if (kind === 'webgl') {
    const webglBackend = createWebGlNativeFrameBackend({ width, height, assetRegistry });
    if (webglBackend) {
      game.renderPipeline.nativeBackendKind = 'webgl';
      game.renderPipeline.nativeBackend = webglBackend;
      return webglBackend;
    }
  }

  game.renderPipeline.nativeBackendKind = 'canvas2d';
  game.renderPipeline.nativeBackend = createCanvas2DNativeFrameBackend({ width, height, canvas: game.renderCanvas, assetRegistry });
  return game.renderPipeline.nativeBackend;
}

export function ensureCanvas2DNativeFrameBackend(game, assetRegistry = defaultAssetRegistry) {
  return ensureNativeFrameBackend(game, { assetRegistry, nativeBackendKind: 'canvas2d' });
}

export function renderGameplayFrame(runtime, game, { assetRegistry = defaultAssetRegistry, nativeBackendKind } = {}) {
  if (!game) {
    game = runtime;
    runtime = { now: () => performance.now(), random: Math.random };
  }
  const nativeBackend = ensureNativeFrameBackend(game, { assetRegistry, nativeBackendKind });
  const { frame } = extractGameplayRenderFrame({ game, runtime, assetRegistry });
  nativeBackend.draw(frame);
  syncGameplayHudPresentation(game);
  game.presentation.present(nativeBackend.getSource());
}
