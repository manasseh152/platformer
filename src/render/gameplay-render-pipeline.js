import { syncGameplayHudPresentation } from '../app/ui/gameplay-hud.js';
import { createCanvas2DNativeFrameBackend } from './backends/canvas2d-native-frame-backend.js';
import { WEBGL2_DEFERRED_BACKEND_UNAVAILABLE_REASON, createWebGl2DeferredNativeFrameBackend } from './backends/webgl2-deferred-native-frame-backend.js';
import { createWebGlNativeFrameBackend } from './backends/webgl-native-frame-backend.js';
import { defaultAssetRegistry } from './browser-asset-registry.js';
import { DEFERRED_LIGHTING_BACKEND_KIND, selectNativeFrameBackendKindForFrame } from './deferred-lighting-selection.js';
import { extractGameplayRenderFrame } from './extractors/gameplay-render-extractor.js';

export function ensureNativeFrameBackend(game, { assetRegistry = defaultAssetRegistry, nativeBackendKind = game.renderPipeline?.nativeBackendKind ?? 'canvas2d' } = {}) {
  const width = game.view.bufferWidth;
  const height = game.view.bufferHeight;
  const kind = nativeBackendKind === 'webgl' ? 'webgl' : (nativeBackendKind === 'webgl2-deferred' || nativeBackendKind === 'deferred' ? DEFERRED_LIGHTING_BACKEND_KIND : 'canvas2d');
  const expectedKind = kind === 'webgl' ? 'webgl-native-frame-backend' : (kind === DEFERRED_LIGHTING_BACKEND_KIND ? 'webgl2-deferred-native-frame-backend' : 'canvas2d-native-frame-backend');
  const expectedCanvas = kind === 'canvas2d' ? game.renderCanvas : undefined;
  const backend = game.renderPipeline?.nativeBackend;
  if (backend?.kind === expectedKind && (kind === 'webgl' || backend.canvas === expectedCanvas)) return backend;

  game.renderPipeline = game.renderPipeline ?? {};
  const installBackend = (nextBackend, nextKind) => {
    if (backend !== nextBackend) backend?.destroy?.();
    game.renderPipeline.nativeBackendKind = nextKind;
    game.renderPipeline.nativeBackend = nextBackend;
    return nextBackend;
  };

  if (kind === DEFERRED_LIGHTING_BACKEND_KIND) {
    const deferredBackend = createWebGl2DeferredNativeFrameBackend({ width, height, assetRegistry });
    if (deferredBackend) return installBackend(deferredBackend, DEFERRED_LIGHTING_BACKEND_KIND);
  } else if (kind === 'webgl') {
    const webglBackend = createWebGlNativeFrameBackend({ width, height, assetRegistry });
    if (webglBackend) return installBackend(webglBackend, 'webgl');
  }

  if (backend?.kind === 'canvas2d-native-frame-backend' && backend.canvas === game.renderCanvas) return backend;
  return installBackend(createCanvas2DNativeFrameBackend({ width, height, canvas: game.renderCanvas, assetRegistry }), 'canvas2d');
}

export function ensureCanvas2DNativeFrameBackend(game, assetRegistry = defaultAssetRegistry) {
  return ensureNativeFrameBackend(game, { assetRegistry, nativeBackendKind: 'canvas2d' });
}

export function renderGameplayFrame(runtime, game, { assetRegistry = defaultAssetRegistry, nativeBackendKind } = {}) {
  if (!game) {
    game = runtime;
    runtime = { now: () => performance.now(), random: Math.random };
  }
  const { frame } = extractGameplayRenderFrame({ game, runtime, assetRegistry });
  const selectedBackendKind = selectNativeFrameBackendKindForFrame(frame, { nativeBackendKind, devToolsFlags: game.devTools?.flags });
  let nativeBackend = ensureNativeFrameBackend(game, { assetRegistry, nativeBackendKind: selectedBackendKind });
  if (selectedBackendKind === DEFERRED_LIGHTING_BACKEND_KIND && nativeBackend.kind !== 'webgl2-deferred-native-frame-backend') {
    game.renderPipeline.deferredFallbackReason = [{ reason: WEBGL2_DEFERRED_BACKEND_UNAVAILABLE_REASON }];
  } else if (game.renderPipeline) {
    delete game.renderPipeline.deferredFallbackReason;
  }
  const support = nativeBackend.supportsFrame?.(frame);
  if (nativeBackend.kind === 'webgl-native-frame-backend' && support && !support.supported) {
    game.renderPipeline.webglFallbackReason = support.issues;
    nativeBackend = ensureNativeFrameBackend(game, { assetRegistry, nativeBackendKind: 'canvas2d' });
  } else if (game.renderPipeline) {
    delete game.renderPipeline.webglFallbackReason;
  }
  nativeBackend.draw(frame);
  syncGameplayHudPresentation(game);
  game.presentation.present(nativeBackend.getSource());
}
