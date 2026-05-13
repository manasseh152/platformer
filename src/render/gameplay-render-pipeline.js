import { syncGameplayHudPresentation } from '../app/ui/gameplay-hud.js';
import { createCanvas2DNativeFrameBackend } from './backends/canvas2d-native-frame-backend.js';
import { WEBGL2_DEFERRED_BACKEND_UNAVAILABLE_REASON, createWebGl2DeferredNativeFrameBackend } from './backends/webgl2-deferred-native-frame-backend.js';
import { createWebGlNativeFrameBackend } from './backends/webgl-native-frame-backend.js';
import { defaultAssetRegistry } from './browser-asset-registry.js';
import { DEFERRED_LIGHTING_BACKEND_KIND, selectNativeFrameBackendKindForFrame } from './deferred-lighting-selection.js';
import { extractGameplayRenderFrame } from './extractors/gameplay-render-extractor.js';
import { summarizeRenderFrame } from './render-frame-diagnostics.js';

export function ensureNativeFrameBackend(game, { assetRegistry = defaultAssetRegistry, nativeBackendKind = game.renderPipeline?.nativeBackendKind ?? 'canvas2d' } = {}) {
  const width = game.view.bufferWidth;
  const height = game.view.bufferHeight;
  const kind = nativeBackendKind === 'webgl' ? 'webgl' : (nativeBackendKind === 'webgl2-deferred' || nativeBackendKind === 'deferred' ? DEFERRED_LIGHTING_BACKEND_KIND : 'canvas2d');
  const expectedKind = kind === 'webgl' ? 'webgl-native-frame-backend' : (kind === DEFERRED_LIGHTING_BACKEND_KIND ? 'webgl2-deferred-native-frame-backend' : 'canvas2d-native-frame-backend');
  const expectedCanvas = kind === 'canvas2d' ? game.renderCanvas : undefined;
  const backend = game.renderPipeline?.nativeBackend;
  if (backend?.kind === expectedKind && !backend.lost && (kind === 'webgl' || backend.canvas === expectedCanvas)) return backend;

  game.renderPipeline = game.renderPipeline ?? {};
  const installBackend = (nextBackend, nextKind) => {
    if (backend !== nextBackend) backend?.destroy?.();
    game.renderPipeline.nativeBackendKind = nextKind;
    game.renderPipeline.nativeBackend = nextBackend;
    return nextBackend;
  };

  if (backend?.kind === expectedKind && backend.lost && kind !== 'canvas2d') {
    return installBackend(createCanvas2DNativeFrameBackend({ width, height, canvas: game.renderCanvas, assetRegistry }), 'canvas2d');
  }

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

function nativeBackendKindFromDevTools(flags = {}, nativeBackendKind) {
  if (nativeBackendKind) return nativeBackendKind;
  if (flags.forceCanvas2DNativeFrame) return 'canvas2d';
  if (flags.forceWebGlNativeFrame) return 'webgl';
  return undefined;
}

function writeRenderPipelineDiagnostics(game, frame, { requestedBackendKind, selectedBackendKind } = {}) {
  game.renderPipeline = game.renderPipeline ?? {};
  game.renderPipeline.diagnostics = {
    requestedBackendKind: requestedBackendKind ?? 'auto',
    selectedBackendKind,
    frame: summarizeRenderFrame(frame)
  };
}

export function renderGameplayFrame(runtime, game, { assetRegistry = defaultAssetRegistry, nativeBackendKind } = {}) {
  if (!game) {
    game = runtime;
    runtime = { now: () => performance.now(), random: Math.random };
  }
  const { frame } = extractGameplayRenderFrame({ game, runtime, assetRegistry });
  const requestedBackendKind = nativeBackendKindFromDevTools(game.devTools?.flags, nativeBackendKind);
  const selectedBackendKind = selectNativeFrameBackendKindForFrame(frame, { nativeBackendKind: requestedBackendKind, devToolsFlags: game.devTools?.flags });
  writeRenderPipelineDiagnostics(game, frame, { requestedBackendKind, selectedBackendKind });
  let nativeBackend = ensureNativeFrameBackend(game, { assetRegistry, nativeBackendKind: selectedBackendKind });
  if (selectedBackendKind === DEFERRED_LIGHTING_BACKEND_KIND && (nativeBackend.kind !== 'webgl2-deferred-native-frame-backend' || nativeBackend.lost)) {
    game.renderPipeline.deferredFallbackReason = [{ reason: nativeBackend.lost ? 'webgl2 deferred native-frame context lost' : WEBGL2_DEFERRED_BACKEND_UNAVAILABLE_REASON }];
    nativeBackend = ensureNativeFrameBackend(game, { assetRegistry, nativeBackendKind: 'canvas2d' });
  } else if (game.renderPipeline) {
    delete game.renderPipeline.deferredFallbackReason;
  }
  const support = nativeBackend.supportsFrame?.(frame);
  if (nativeBackend.kind === 'webgl-native-frame-backend' && (nativeBackend.lost || (support && !support.supported))) {
    game.renderPipeline.webglFallbackReason = nativeBackend.lost ? [{ reason: 'webgl native-frame context lost' }] : support.issues;
    nativeBackend = ensureNativeFrameBackend(game, { assetRegistry, nativeBackendKind: 'canvas2d' });
  } else if (game.renderPipeline) {
    delete game.renderPipeline.webglFallbackReason;
  }
  nativeBackend.draw(frame);
  syncGameplayHudPresentation(game);
  game.presentation.present(nativeBackend.getSource());
}
