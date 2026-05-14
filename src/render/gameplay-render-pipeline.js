import { syncGameplayHudPresentation } from '../app/ui/gameplay-hud.js';
import { getNativeFrameBackendMaturity } from './backends/native-frame-capabilities.js';
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

function normalizedIssue(reason, overrides = {}) {
  if (typeof reason === 'string') return { reason, severity: 'required', ...overrides };
  return { severity: 'required', ...reason, ...overrides };
}

function writeRenderPipelineDiagnostics(game, frame, { requestedBackendKind, candidateBackendKind, actualBackendKind, fallbackIssues = [], fallbackFrom, fallbackTo } = {}) {
  game.renderPipeline = game.renderPipeline ?? {};
  const issues = fallbackIssues.map(issue => normalizedIssue(issue));
  game.renderPipeline.diagnostics = {
    requestedBackendKind: requestedBackendKind ?? 'auto',
    candidateBackendKind,
    actualBackendKind,
    maturity: {
      candidate: getNativeFrameBackendMaturity(candidateBackendKind),
      actual: getNativeFrameBackendMaturity(actualBackendKind)
    },
    fallback: {
      occurred: issues.length > 0 || Boolean(fallbackFrom && fallbackTo && fallbackFrom !== fallbackTo),
      from: fallbackFrom ?? null,
      to: fallbackTo ?? null,
      issues
    },
    frame: summarizeRenderFrame(frame)
  };
}

export function renderNativeFrame(runtime, game, frame, { assetRegistry = defaultAssetRegistry, nativeBackendKind } = {}) {
  const requestedBackendKind = nativeBackendKindFromDevTools(game.devTools?.flags, nativeBackendKind);
  const candidateBackendKind = selectNativeFrameBackendKindForFrame(frame, { nativeBackendKind: requestedBackendKind, devToolsFlags: game.devTools?.flags });
  let nativeBackend = ensureNativeFrameBackend(game, { assetRegistry, nativeBackendKind: candidateBackendKind });
  let fallbackFrom = null;
  let fallbackTo = null;
  let fallbackIssues = [];

  if (candidateBackendKind === DEFERRED_LIGHTING_BACKEND_KIND && nativeBackend.kind !== 'webgl2-deferred-native-frame-backend') {
    fallbackFrom = DEFERRED_LIGHTING_BACKEND_KIND;
    fallbackTo = 'canvas2d';
    fallbackIssues = [normalizedIssue(WEBGL2_DEFERRED_BACKEND_UNAVAILABLE_REASON)];
  } else if (candidateBackendKind === 'webgl' && nativeBackend.kind !== 'webgl-native-frame-backend') {
    fallbackFrom = 'webgl';
    fallbackTo = 'canvas2d';
    fallbackIssues = [normalizedIssue('webgl native-frame backend unavailable')];
  } else {
    const support = nativeBackend.supportsFrame?.(frame);
    if (candidateBackendKind === DEFERRED_LIGHTING_BACKEND_KIND && (nativeBackend.lost || (support && !support.supported))) {
      fallbackFrom = DEFERRED_LIGHTING_BACKEND_KIND;
      fallbackTo = 'canvas2d';
      fallbackIssues = nativeBackend.lost ? [normalizedIssue('webgl2 deferred native-frame context lost')] : [...support.issues];
    } else if (candidateBackendKind === 'webgl' && (nativeBackend.lost || (support && !support.supported))) {
      fallbackFrom = 'webgl';
      fallbackTo = 'canvas2d';
      fallbackIssues = nativeBackend.lost ? [normalizedIssue('webgl native-frame context lost')] : [...support.issues];
    }
  }

  if (fallbackIssues.length) nativeBackend = ensureNativeFrameBackend(game, { assetRegistry, nativeBackendKind: 'canvas2d' });
  const actualBackendKind = game.renderPipeline.nativeBackendKind;
  writeRenderPipelineDiagnostics(game, frame, { requestedBackendKind, candidateBackendKind, actualBackendKind, fallbackIssues, fallbackFrom, fallbackTo });
  nativeBackend.draw(frame);
  return nativeBackend;
}

export function renderGameplayFrame(runtime, game, { assetRegistry = defaultAssetRegistry, nativeBackendKind } = {}) {
  if (!game) {
    game = runtime;
    runtime = { now: () => performance.now(), random: Math.random };
  }
  const { frame } = extractGameplayRenderFrame({ game, runtime, assetRegistry });
  const nativeBackend = renderNativeFrame(runtime, game, frame, { assetRegistry, nativeBackendKind });
  syncGameplayHudPresentation(game);
  game.presentation.present(nativeBackend.getSource());
}
