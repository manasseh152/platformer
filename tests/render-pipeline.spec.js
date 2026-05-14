import { expect, test } from '@playwright/test';
import { createRenderFrameBuilder, resetRenderPacketSequenceForTests } from '#/engine/render/frame-builder.js';
import { computePresentationViewport, prepareRenderView, worldToNativeRect } from '#/engine/render/viewport.js';
import { createAssetRegistry, ASSET_IDS, createAtlasSpriteMetadata } from '#/render/asset-registry.js';
import { analyzeWebGlNativeFrameSupport } from '#/render/backends/webgl-native-frame-capabilities.js';
import { hasAuthoredLightPackets, hasOnlyDefaultAmbientLight, selectNativeFrameBackendKindForFrame } from '#/render/deferred-lighting-selection.js';
import { extractGameplayRenderFrame } from '#/render/extractors/gameplay-render-extractor.js';
import { createGameplayRenderReadModel } from '#/render/extractors/gameplay-renderables.js';
import { createGameplaySession, syncGameplaySessionToGame } from '#/core/gameplay-session.js';
import { Color } from '#/core/color.js';
import { Vec } from '#/core/vector.js';
import { renderLight2d } from '#/engine/scene/components.js';
import { defineScene } from '#/engine/scene/scene.js';
import { getTilemapById } from '#/content/tilemaps/registry.js';
import { addLightPackets, lightWorldPosition, pointLightIntersectsView } from '#/render/extractors/light-packets.js';
import { createRenderParityScenarios } from '#/render/parity-render-scenarios.js';

test('presentation viewport integer-scales and centers native frame', () => {
  expect(computePresentationViewport(800, 600, 320, 180)).toEqual({ scale: 2, width: 640, height: 360, offsetX: 80, offsetY: 120 });
  expect(computePresentationViewport(1920, 1080, 320, 180)).toEqual({ scale: 6, width: 1920, height: 1080, offsetX: 0, offsetY: 0 });
});

test('presentation viewport soft-fits below native size', () => {
  expect(computePresentationViewport(160, 90, 320, 180)).toEqual({ scale: 0.5, width: 160, height: 90, offsetX: 0, offsetY: 0 });
});

test('render frame builder sorts by layer order then insertion sequence', () => {
  resetRenderPacketSequenceForTests();
  const frame = createRenderFrameBuilder({ width: 10, height: 10 })
    .add({ kind: 'rect', layer: 2, order: 0, id: 'c' })
    .add({ kind: 'rect', layer: 1, order: 2, id: 'b' })
    .add({ kind: 'rect', layer: 1, order: 1, id: 'a' })
    .add({ kind: 'rect', layer: 1, order: 1, id: 'a2' })
    .finalize();

  expect(frame.packets.map(packet => packet.id)).toEqual(['a', 'a2', 'b', 'c']);
});

test('render view snaps camera and converts world rects to native coordinates', () => {
  const randomValues = [0.5, 0.5];
  const view = prepareRenderView({ camera: { x: 10.6, y: 20.2 }, viewWidth: 640, viewHeight: 360, bufferWidth: 320, bufferHeight: 180, random: () => randomValues.shift() ?? 0.5 });

  expect(view.worldToNativeX).toBe(0.5);
  expect(view.cameraX).toBe(10);
  expect(view.cameraY).toBe(20);
  expect(worldToNativeRect(view, { x: 20, y: 30, w: 32, h: 32 })).toEqual({ x: 5, y: 5, w: 16, h: 16 });
});

test('asset registry maps namespaced IDs to current image handles', () => {
  const image = { complete: true, naturalWidth: 16 };
  const registry = createAssetRegistry({ spikes: image });

  expect(registry.getImage(ASSET_IDS.HAZARD_SPIKES)).toBe(image);
  expect(registry.isLoaded(ASSET_IDS.HAZARD_SPIKES)).toBe(true);
});

test('asset registry exposes atlas sprite metadata without changing asset IDs', () => {
  const atlas = { complete: true, naturalWidth: 64, naturalHeight: 32 };
  const registry = createAssetRegistry(
    { medievalAtlas: atlas },
    {
      metadata: {
        [ASSET_IDS.HAZARD_SPIKES]: createAtlasSpriteMetadata({
          atlasId: 'atlas.medieval',
          imageKey: 'medievalAtlas',
          x: 18,
          y: 4,
          w: 12,
          h: 10
        })
      }
    }
  );

  expect(registry.getImage(ASSET_IDS.HAZARD_SPIKES)).toBe(atlas);
  expect(registry.getSprite(ASSET_IDS.HAZARD_SPIKES)).toMatchObject({
    kind: 'atlas-sprite',
    atlasId: 'atlas.medieval',
    rect: { x: 18, y: 4, w: 12, h: 10 },
    padding: 2,
    extrude: 1
  });
  expect(registry.isLoaded(ASSET_IDS.HAZARD_SPIKES)).toBe(true);
});

test('render parity scenarios cover ADR 0009 representative packet families', () => {
  const scenarios = createRenderParityScenarios();
  expect(scenarios.map(scenario => scenario.id)).toEqual([
    'clear-rect-vector-primitives',
    'standalone-image-packets',
    'atlas-sprite-packets',
    'tilemap-contained-terrain-chunks',
    'actors-and-flipped-rotated-sprites',
    'lighting-primitives-lit-unlit-surfaces',
    'debug-overlays'
  ]);

  const packetsByScenario = Object.fromEntries(scenarios.map(scenario => [scenario.id, scenario.frame.packets]));
  expect(packetsByScenario['clear-rect-vector-primitives'].map(packet => packet.kind)).toEqual(expect.arrayContaining(['clear', 'rect', 'path', 'ellipse']));
  expect(packetsByScenario['standalone-image-packets']).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'image' })]));
  expect(packetsByScenario['atlas-sprite-packets']).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'sprite' })]));
  expect(packetsByScenario['tilemap-contained-terrain-chunks'].filter(packet => packet.kind === 'rect' && packet.lighting === 'lit').length).toBeGreaterThan(1);
  expect(packetsByScenario['actors-and-flipped-rotated-sprites']).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'sprite', flipX: true }),
    expect.objectContaining({ kind: 'sprite', rotation: expect.any(Number) })
  ]));
  expect(packetsByScenario['lighting-primitives-lit-unlit-surfaces']).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'rect', lighting: 'lit' }),
    expect.objectContaining({ kind: 'rect', lighting: 'unlit' }),
    expect.objectContaining({ kind: 'light2d', lightKind: 'ambient' }),
    expect.objectContaining({ kind: 'light2d', lightKind: 'point' })
  ]));
  expect(packetsByScenario['debug-overlays']).toEqual(expect.arrayContaining([
    expect.objectContaining({ layer: expect.any(Number), stroke: expect.any(String) })
  ]));
});

test('canvas2d and webgl native backends match on ADR 0009 parity render scenarios', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ createRenderParityScenarios, PARITY_ASSET_IDS }, { createAssetRegistry, createAtlasSpriteMetadata }, { createCanvas2DNativeFrameBackend }, { createWebGlNativeFrameBackend }] = await Promise.all([
      import('/src/render/parity-render-scenarios.js'),
      import('/src/render/asset-registry.js'),
      import('/src/render/backends/canvas2d-native-frame-backend.js'),
      import('/src/render/backends/webgl-native-frame-backend.js')
    ]);

    const source = document.createElement('canvas');
    source.width = 12;
    source.height = 4;
    const sourceCtx = source.getContext('2d');
    sourceCtx.fillStyle = '#ff0000';
    sourceCtx.fillRect(0, 0, 4, 4);
    sourceCtx.fillStyle = '#00ff00';
    sourceCtx.fillRect(4, 0, 4, 4);
    sourceCtx.fillStyle = '#0000ff';
    sourceCtx.fillRect(8, 0, 4, 4);
    const atlas = new Image();
    await new Promise(resolve => {
      atlas.onload = resolve;
      atlas.src = source.toDataURL();
    });

    const assetRegistry = createAssetRegistry(
      { atlas },
      { metadata: {
        [PARITY_ASSET_IDS.standalone]: { kind: 'standalone-image', imageKey: 'atlas', rect: { x: 0, y: 0, w: 4, h: 4 } },
        [PARITY_ASSET_IDS.atlasSprite]: createAtlasSpriteMetadata({ atlasId: 'atlas.parity', imageKey: 'atlas', x: 4, y: 0, w: 4, h: 4 }),
        [PARITY_ASSET_IDS.actorSprite]: createAtlasSpriteMetadata({ atlasId: 'atlas.parity', imageKey: 'atlas', x: 0, y: 0, w: 4, h: 4 }),
        [PARITY_ASSET_IDS.rotatedSprite]: createAtlasSpriteMetadata({ atlasId: 'atlas.parity', imageKey: 'atlas', x: 8, y: 0, w: 2, h: 4 })
      } }
    );
    const probe = createWebGlNativeFrameBackend({ width: 1, height: 1, assetRegistry });
    if (!probe) return { supported: false };
    probe.destroy?.();

    function canvasPixels(backend, points) {
      return points.map(({ x, y }) => Array.from(backend.ctx.getImageData(x, y, 1, 1).data));
    }

    function webglPixels(backend, frame, points) {
      const raw = new Uint8Array(frame.width * frame.height * 4);
      backend.gl.readPixels(0, 0, frame.width, frame.height, backend.gl.RGBA, backend.gl.UNSIGNED_BYTE, raw);
      return points.map(({ x, y }) => {
        const offset = ((frame.height - 1 - y) * frame.width + x) * 4;
        return Array.from(raw.slice(offset, offset + 4));
      });
    }

    return {
      supported: true,
      scenarios: createRenderParityScenarios().map(scenario => {
        const canvas = createCanvas2DNativeFrameBackend({ width: scenario.frame.width, height: scenario.frame.height, assetRegistry });
        const webgl = createWebGlNativeFrameBackend({ width: scenario.frame.width, height: scenario.frame.height, assetRegistry });
        canvas.draw(scenario.frame);
        webgl.draw(scenario.frame);
        return {
          id: scenario.id,
          tolerance: scenario.tolerance ?? 2,
          support: webgl.supportsFrame(scenario.frame),
          canvas: canvasPixels(canvas, scenario.samplePoints),
          webgl: webglPixels(webgl, scenario.frame, scenario.samplePoints)
        };
      })
    };
  });

  test.skip(!result.supported, 'WebGL unavailable in this browser');
  for (const scenario of result.scenarios) {
    expect(scenario.support).toMatchObject({ supported: true, issues: [] });
    for (let point = 0; point < scenario.canvas.length; point++) {
      for (let channel = 0; channel < 4; channel++) {
        expect(Math.abs(scenario.webgl[point][channel] - scenario.canvas[point][channel]), `${scenario.id} point ${point} channel ${channel}: canvas=${scenario.canvas[point][channel]} webgl=${scenario.webgl[point][channel]}`).toBeLessThanOrEqual(scenario.tolerance);
      }
    }
  }
});

test('canvas2d and webgl native backends match on tiny reference frames', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ createRenderFrameBuilder }, { createAssetRegistry, ASSET_IDS, createAtlasSpriteMetadata }, { createCanvas2DNativeFrameBackend }, { createWebGlNativeFrameBackend }] = await Promise.all([
      import('/src/engine/render/frame-builder.js'),
      import('/src/render/asset-registry.js'),
      import('/src/render/backends/canvas2d-native-frame-backend.js'),
      import('/src/render/backends/webgl-native-frame-backend.js')
    ]);

    const source = document.createElement('canvas');
    source.width = 4;
    source.height = 2;
    const sourceCtx = source.getContext('2d');
    sourceCtx.fillStyle = '#ff0000';
    sourceCtx.fillRect(0, 0, 2, 2);
    sourceCtx.fillStyle = '#00ff00';
    sourceCtx.fillRect(2, 0, 2, 2);
    const atlas = new Image();
    await new Promise(resolve => {
      atlas.onload = resolve;
      atlas.src = source.toDataURL();
    });

    const registry = createAssetRegistry(
      { atlas },
      { metadata: { [ASSET_IDS.HAZARD_SPIKES]: createAtlasSpriteMetadata({ atlasId: 'atlas.test', imageKey: 'atlas', x: 2, y: 0, w: 2, h: 2 }) } }
    );
    const canvas = createCanvas2DNativeFrameBackend({ width: 4, height: 4, assetRegistry: registry });
    const webgl = createWebGlNativeFrameBackend({ width: 4, height: 4, assetRegistry: registry });
    if (!webgl) return { supported: false };

    const cases = [
      createRenderFrameBuilder({ width: 4, height: 4 })
        .add({ kind: 'clear', fill: '#123456' })
        .finalize(),
      createRenderFrameBuilder({ width: 4, height: 4 })
        .add({ kind: 'clear', fill: '#000000' })
        .add({ kind: 'rect', x: 1, y: 0, w: 1, h: 4, fill: '#ffffff' })
        .finalize(),
      createRenderFrameBuilder({ width: 4, height: 4 })
        .add({ kind: 'clear', fill: '#000000' })
        .add({ kind: 'rect', x: 0, y: 2, w: 4, h: 1, fill: '#00ff00' })
        .finalize(),
      createRenderFrameBuilder({ width: 4, height: 4 })
        .add({ kind: 'clear', fill: '#000000' })
        .add({ kind: 'sprite', assetId: ASSET_IDS.HAZARD_SPIKES, x: 1, y: 1, w: 2, h: 2 })
        .finalize()
    ];

    function canvasPixels() {
      return Array.from(canvas.ctx.getImageData(0, 0, 4, 4).data);
    }

    function webglPixelsTopLeft() {
      const raw = new Uint8Array(4 * 4 * 4);
      webgl.gl.readPixels(0, 0, 4, 4, webgl.gl.RGBA, webgl.gl.UNSIGNED_BYTE, raw);
      const topLeft = new Uint8Array(raw.length);
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const src = ((3 - y) * 4 + x) * 4;
          const dst = (y * 4 + x) * 4;
          topLeft.set(raw.slice(src, src + 4), dst);
        }
      }
      return Array.from(topLeft);
    }

    return {
      supported: true,
      pairs: cases.map(frame => {
        canvas.draw(frame);
        webgl.draw(frame);
        return { canvas: canvasPixels(), webgl: webglPixelsTopLeft() };
      })
    };
  });

  test.skip(!result.supported, 'WebGL unavailable in this browser');
  for (const { canvas, webgl } of result.pairs) {
    expect(webgl).toHaveLength(canvas.length);
    for (let i = 0; i < canvas.length; i++) {
      expect(Math.abs(webgl[i] - canvas[i]), `channel ${i}: canvas=${canvas[i]} webgl=${webgl[i]}`).toBeLessThanOrEqual(1);
    }
  }
});

test('canvas native backend draws image packets from atlas metadata', async ({ page }) => {
  await page.goto('/');
  const pixel = await page.evaluate(async () => {
    const [{ createRenderFrameBuilder }, { createAssetRegistry, ASSET_IDS, createAtlasSpriteMetadata }, { createCanvas2DNativeFrameBackend }] = await Promise.all([
      import('/src/engine/render/frame-builder.js'),
      import('/src/render/asset-registry.js'),
      import('/src/render/backends/canvas2d-native-frame-backend.js')
    ]);

    const source = document.createElement('canvas');
    source.width = 4;
    source.height = 2;
    const sourceCtx = source.getContext('2d');
    sourceCtx.fillStyle = '#ff0000';
    sourceCtx.fillRect(0, 0, 2, 2);
    sourceCtx.fillStyle = '#00ff00';
    sourceCtx.fillRect(2, 0, 2, 2);

    const atlas = new Image();
    await new Promise(resolve => {
      atlas.onload = resolve;
      atlas.src = source.toDataURL();
    });

    const registry = createAssetRegistry(
      { atlas },
      { metadata: { [ASSET_IDS.HAZARD_SPIKES]: createAtlasSpriteMetadata({ atlasId: 'atlas.test', imageKey: 'atlas', x: 2, y: 0, w: 2, h: 2 }) } }
    );
    const backend = createCanvas2DNativeFrameBackend({ width: 2, height: 2, assetRegistry: registry });
    const frame = createRenderFrameBuilder({ width: 2, height: 2 })
      .add({ kind: 'clear', fill: '#000' })
      .add({ kind: 'image', assetId: ASSET_IDS.HAZARD_SPIKES, x: 0, y: 0, w: 2, h: 2 })
      .finalize();

    backend.draw(frame);
    return Array.from(backend.ctx.getImageData(0, 0, 1, 1).data);
  });

  expect(pixel).toEqual([0, 255, 0, 255]);
});

test('webgl native backend capability check accepts real gameplay vector and light packets', () => {
  const view = { width: 640, height: 360, bufferWidth: 320, bufferHeight: 180 };
  const session = createGameplaySession(getTilemapById('act-01-level-1'), { view, scenarioId: 'act-01-level-1' });
  const game = { view, devTools: { flags: {} } };
  syncGameplaySessionToGame(game, session);

  const { frame } = extractGameplayRenderFrame({ game, runtime: { now: () => 0, random: () => 0.5 }, assetRegistry: createAssetRegistry({}) });
  const support = analyzeWebGlNativeFrameSupport(frame);

  expect(support).toMatchObject({ backendKind: 'webgl', supported: true });
  expect(support.issues).toEqual([]);
});

test('webgl native backend capability check reports unloaded image assets', () => {
  const frame = createRenderFrameBuilder({ width: 4, height: 4 })
    .add({ kind: 'clear', fill: '#000' })
    .add({ kind: 'image', assetId: 'missing.image', x: 0, y: 0, w: 4, h: 4 })
    .finalize();
  const support = analyzeWebGlNativeFrameSupport(frame, { assetRegistry: createAssetRegistry({}) });

  expect(support).toMatchObject({ backendKind: 'webgl', supported: false });
  expect(support.issues).toEqual([
    expect.objectContaining({ packetKind: 'image', feature: 'asset', reason: 'asset not loaded: missing.image', severity: 'required' })
  ]);
});

test('renderGameplayFrame keeps requested webgl for extracted gameplay packets', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ renderGameplayFrame }, { createAssetRegistry }, { createGameplaySession, syncGameplaySessionToGame }, { getTilemapById }] = await Promise.all([
      import('/src/render/gameplay-render-pipeline.js'),
      import('/src/render/asset-registry.js'),
      import('/src/core/gameplay-session.js'),
      import('/src/content/tilemaps/registry.js')
    ]);
    const view = { width: 640, height: 360, bufferWidth: 320, bufferHeight: 180 };
    const session = createGameplaySession(getTilemapById('act-01-level-1'), { view, scenarioId: 'act-01-level-1' });
    const heartsEl = document.createElement('div');
    for (let i = 0; i < 5; i++) heartsEl.append(document.createElement('span'));
    const game = {
      view,
      renderCanvas: document.createElement('canvas'),
      renderPipeline: {},
      presentation: { present(source) { this.lastSource = source; } },
      devTools: { flags: {} },
      settings: {},
      appState: { started: true, paused: false },
      input: { inputScheme: 'wasd' },
      ui: {
        hudLevelName: document.createElement('div'),
        heartsEl,
        dashStatusEl: document.createElement('div'),
        messageEl: document.createElement('div'),
        messageTitleEl: document.createElement('div'),
        messageNextLevelButton: document.createElement('button'),
        hintLayerEl: null
      }
    };
    syncGameplaySessionToGame(game, session);
    game.tilemaps = { getNextTilemap: () => null };

    renderGameplayFrame({ now: () => 0, random: () => 0.5 }, game, { assetRegistry: createAssetRegistry({}), nativeBackendKind: 'webgl' });
    return {
      backendKind: game.renderPipeline.nativeBackendKind,
      backend: game.renderPipeline.nativeBackend.kind,
      fallbackReasons: game.renderPipeline.diagnostics?.fallback?.issues?.map(issue => issue.reason) ?? [],
      presentedWidth: game.presentation.lastSource?.width
    };
  });

  expect(result.backendKind).toBe('webgl');
  expect(result.backend).toBe('webgl-native-frame-backend');
  expect(result.fallbackReasons).toEqual([]);
  expect(result.presentedWidth).toBe(320);
});

test('renderNativeFrame falls back from webgl on unsupported packet features', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    if (!document.createElement('canvas').getContext('webgl')) return { supported: false };
    const [{ createRenderFrameBuilder }, { renderNativeFrame }, { createAssetRegistry }] = await Promise.all([
      import('/src/engine/render/frame-builder.js'),
      import('/src/render/gameplay-render-pipeline.js'),
      import('/src/render/asset-registry.js')
    ]);
    const frame = createRenderFrameBuilder({ width: 4, height: 4 })
      .add({ kind: 'clear', fill: '#000' })
      .add({ kind: 'rect', x: 0, y: 0, w: 4, h: 4, fill: { kind: 'conicGradient' } })
      .finalize();
    const game = {
      view: { bufferWidth: 4, bufferHeight: 4 },
      renderCanvas: document.createElement('canvas'),
      renderPipeline: {},
      devTools: { flags: {} }
    };
    renderNativeFrame({ now: () => 0, random: () => 0.5 }, game, frame, { assetRegistry: createAssetRegistry({}), nativeBackendKind: 'webgl' });
    return {
      supported: true,
      backendKind: game.renderPipeline.nativeBackendKind,
      backend: game.renderPipeline.nativeBackend.kind,
      diagnostics: game.renderPipeline.diagnostics,
      fallbackReasons: game.renderPipeline.diagnostics?.fallback?.issues?.map(issue => issue.reason) ?? []
    };
  });

  test.skip(!result.supported, 'WebGL unavailable in this browser');
  expect(result.backendKind).toBe('canvas2d');
  expect(result.backend).toBe('canvas2d-native-frame-backend');
  expect(result.diagnostics).toMatchObject({
    requestedBackendKind: 'webgl',
    candidateBackendKind: 'webgl',
    actualBackendKind: 'canvas2d',
    maturity: {
      candidate: { tier: 'experimental', defaultEligible: false },
      actual: { tier: 'reference', defaultEligible: true }
    },
    fallback: { occurred: true, from: 'webgl', to: 'canvas2d' }
  });
  expect(result.diagnostics.fallback.issues).toEqual([
    expect.objectContaining({ packetKind: 'rect', feature: 'fill', reason: 'unsupported fill kind for rect: conicGradient', severity: 'required' })
  ]);
  expect(result.fallbackReasons).toEqual(['unsupported fill kind for rect: conicGradient']);
});

test('renderNativeFrame falls back from webgl when image assets are not loaded', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    if (!document.createElement('canvas').getContext('webgl')) return { supported: false };
    const [{ createRenderFrameBuilder }, { renderNativeFrame }, { createAssetRegistry }] = await Promise.all([
      import('/src/engine/render/frame-builder.js'),
      import('/src/render/gameplay-render-pipeline.js'),
      import('/src/render/asset-registry.js')
    ]);
    const frame = createRenderFrameBuilder({ width: 4, height: 4 })
      .add({ kind: 'clear', fill: '#000' })
      .add({ kind: 'sprite', assetId: 'missing.sprite', x: 0, y: 0, w: 4, h: 4 })
      .finalize();
    const game = {
      view: { bufferWidth: 4, bufferHeight: 4 },
      renderCanvas: document.createElement('canvas'),
      renderPipeline: {},
      devTools: { flags: {} }
    };
    renderNativeFrame({ now: () => 0, random: () => 0.5 }, game, frame, { assetRegistry: createAssetRegistry({}), nativeBackendKind: 'webgl' });
    return {
      supported: true,
      backendKind: game.renderPipeline.nativeBackendKind,
      backend: game.renderPipeline.nativeBackend.kind,
      diagnostics: game.renderPipeline.diagnostics
    };
  });

  test.skip(!result.supported, 'WebGL unavailable in this browser');
  expect(result.backendKind).toBe('canvas2d');
  expect(result.backend).toBe('canvas2d-native-frame-backend');
  expect(result.diagnostics).toMatchObject({
    requestedBackendKind: 'webgl',
    candidateBackendKind: 'webgl',
    actualBackendKind: 'canvas2d',
    fallback: { occurred: true, from: 'webgl', to: 'canvas2d' }
  });
  expect(result.diagnostics.fallback.issues).toEqual([
    expect.objectContaining({ packetKind: 'sprite', feature: 'asset', reason: 'asset not loaded: missing.sprite', severity: 'required' })
  ]);
});

test('renderNativeFrame reports context-loss fallback from an existing webgl backend', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    if (!document.createElement('canvas').getContext('webgl')) return { supported: false };
    const [{ createRenderFrameBuilder }, { renderNativeFrame }, { createAssetRegistry }] = await Promise.all([
      import('/src/engine/render/frame-builder.js'),
      import('/src/render/gameplay-render-pipeline.js'),
      import('/src/render/asset-registry.js')
    ]);
    const frame = createRenderFrameBuilder({ width: 4, height: 4 })
      .add({ kind: 'clear', fill: '#000' })
      .finalize();
    const game = {
      view: { bufferWidth: 4, bufferHeight: 4 },
      renderCanvas: document.createElement('canvas'),
      renderPipeline: {},
      devTools: { flags: {} }
    };
    const assetRegistry = createAssetRegistry({});
    renderNativeFrame({ now: () => 0, random: () => 0.5 }, game, frame, { assetRegistry, nativeBackendKind: 'webgl' });
    const initialBackend = game.renderPipeline.nativeBackend;
    const loseContext = initialBackend.gl.getExtension('WEBGL_lose_context');
    if (!loseContext) return { supported: false };
    loseContext.loseContext();
    await new Promise(resolve => setTimeout(resolve, 0));
    renderNativeFrame({ now: () => 0, random: () => 0.5 }, game, frame, { assetRegistry, nativeBackendKind: 'webgl' });
    return {
      supported: true,
      backendKind: game.renderPipeline.nativeBackendKind,
      backend: game.renderPipeline.nativeBackend.kind,
      sameBackend: game.renderPipeline.nativeBackend === initialBackend,
      diagnostics: game.renderPipeline.diagnostics
    };
  });

  test.skip(!result.supported, 'WebGL or WEBGL_lose_context unavailable in this browser');
  expect(result.backendKind).toBe('canvas2d');
  expect(result.backend).toBe('canvas2d-native-frame-backend');
  expect(result.sameBackend).toBe(false);
  expect(result.diagnostics).toMatchObject({
    requestedBackendKind: 'webgl',
    candidateBackendKind: 'webgl',
    actualBackendKind: 'canvas2d',
    fallback: { occurred: true, from: 'webgl', to: 'canvas2d' }
  });
  expect(result.diagnostics.fallback.issues).toEqual([
    expect.objectContaining({ reason: 'webgl native-frame context lost', severity: 'required' })
  ]);
});

test('webgl native backend draws clear and 1px rect packets from finalized frames', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ createRenderFrameBuilder }, { createWebGlNativeFrameBackend }] = await Promise.all([
      import('/src/engine/render/frame-builder.js'),
      import('/src/render/backends/webgl-native-frame-backend.js')
    ]);
    const backend = createWebGlNativeFrameBackend({ width: 4, height: 4 });
    if (!backend) return { supported: false };
    const frame = createRenderFrameBuilder({ width: 4, height: 4 })
      .add({ kind: 'clear', fill: '#000000' })
      .add({ kind: 'rect', x: 1, y: 0, w: 1, h: 4, fill: '#ffffff' })
      .add({ kind: 'rect', x: 0, y: 2, w: 4, h: 1, fill: '#00ff00' })
      .finalize();
    backend.draw(frame);
    const gl = backend.gl;
    const pixels = new Uint8Array(4 * 4 * 4);
    gl.readPixels(0, 0, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const at = (x, y) => Array.from(pixels.slice(((3 - y) * 4 + x) * 4, ((3 - y) * 4 + x) * 4 + 4));
    return { supported: true, black: at(0, 0), whiteLine: at(1, 0), greenLine: at(3, 2), greenOverWhite: at(1, 2) };
  });

  test.skip(!result.supported, 'WebGL unavailable in this browser');
  expect(result.black).toEqual([0, 0, 0, 255]);
  expect(result.whiteLine).toEqual([255, 255, 255, 255]);
  expect(result.greenLine).toEqual([0, 255, 0, 255]);
  expect(result.greenOverWhite).toEqual([0, 255, 0, 255]);
});

test('webgl native backend draws gradients and vector packets via canvas texture path', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ createRenderFrameBuilder }, { createWebGlNativeFrameBackend }] = await Promise.all([
      import('/src/engine/render/frame-builder.js'),
      import('/src/render/backends/webgl-native-frame-backend.js')
    ]);
    const backend = createWebGlNativeFrameBackend({ width: 8, height: 4 });
    if (!backend) return { supported: false };
    const frame = createRenderFrameBuilder({ width: 8, height: 4 })
      .add({ kind: 'clear', fill: '#000000' })
      .add({ kind: 'rect', x: 0, y: 0, w: 8, h: 4, fill: { kind: 'linearGradient', x0: 0, y0: 0, x1: 8, y1: 0, stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#00ff00' }] } })
      .add({ kind: 'ellipse', x: 4, y: 2, radiusX: 1.5, radiusY: 1.5, fill: '#0000ff' })
      .finalize();
    backend.draw(frame);
    const gl = backend.gl;
    const pixels = new Uint8Array(8 * 4 * 4);
    gl.readPixels(0, 0, 8, 4, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const at = (x, y) => Array.from(pixels.slice(((3 - y) * 8 + x) * 4, ((3 - y) * 8 + x) * 4 + 4));
    return { supported: true, left: at(0, 1), right: at(7, 1), center: at(4, 2) };
  });

  expect(result.supported).toBe(true);
  expect(result.left[0]).toBeGreaterThan(result.left[1]);
  expect(result.right[1]).toBeGreaterThan(result.right[0]);
  expect(result.center[2]).toBeGreaterThan(200);
});

test('webgl native backend draws atlas sprite packets through the same asset IDs', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ createRenderFrameBuilder }, { createAssetRegistry, ASSET_IDS, createAtlasSpriteMetadata }, { createWebGlNativeFrameBackend }] = await Promise.all([
      import('/src/engine/render/frame-builder.js'),
      import('/src/render/asset-registry.js'),
      import('/src/render/backends/webgl-native-frame-backend.js')
    ]);

    const source = document.createElement('canvas');
    source.width = 4;
    source.height = 2;
    const sourceCtx = source.getContext('2d');
    sourceCtx.fillStyle = '#ff0000';
    sourceCtx.fillRect(0, 0, 2, 2);
    sourceCtx.fillStyle = '#00ff00';
    sourceCtx.fillRect(2, 0, 2, 2);
    const atlas = new Image();
    await new Promise(resolve => {
      atlas.onload = resolve;
      atlas.src = source.toDataURL();
    });
    const registry = createAssetRegistry(
      { atlas },
      { metadata: { [ASSET_IDS.HAZARD_SPIKES]: createAtlasSpriteMetadata({ atlasId: 'atlas.test', imageKey: 'atlas', x: 2, y: 0, w: 2, h: 2 }) } }
    );
    const backend = createWebGlNativeFrameBackend({ width: 2, height: 2, assetRegistry: registry });
    if (!backend) return { supported: false };
    const frame = createRenderFrameBuilder({ width: 2, height: 2 })
      .add({ kind: 'clear', fill: '#000' })
      .add({ kind: 'sprite', assetId: ASSET_IDS.HAZARD_SPIKES, x: 0, y: 0, w: 2, h: 2 })
      .finalize();
    backend.draw(frame);
    const pixel = new Uint8Array(4);
    backend.gl.readPixels(0, 1, 1, 1, backend.gl.RGBA, backend.gl.UNSIGNED_BYTE, pixel);
    return { supported: true, pixel: Array.from(pixel), source: backend.getSource() };
  });

  test.skip(!result.supported, 'WebGL unavailable in this browser');
  expect(result.pixel).toEqual([0, 255, 0, 255]);
  expect(result.source).toMatchObject({ kind: 'canvas2d', width: 2, height: 2 });
});

test('webgl native backend draws rotated image, sprite, and texturedQuad packets', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ createRenderFrameBuilder }, { createAssetRegistry, createAtlasSpriteMetadata }, { createWebGlNativeFrameBackend }, { renderNativeFrame }] = await Promise.all([
      import('/src/engine/render/frame-builder.js'),
      import('/src/render/asset-registry.js'),
      import('/src/render/backends/webgl-native-frame-backend.js'),
      import('/src/render/gameplay-render-pipeline.js')
    ]);

    const source = document.createElement('canvas');
    source.width = 6;
    source.height = 6;
    const sourceCtx = source.getContext('2d');
    sourceCtx.clearRect(0, 0, 6, 6);
    sourceCtx.fillStyle = '#00ff00';
    sourceCtx.fillRect(0, 0, 2, 4);
    sourceCtx.fillStyle = '#ff0000';
    sourceCtx.fillRect(2, 0, 2, 4);
    sourceCtx.fillStyle = '#0000ff';
    sourceCtx.fillRect(4, 0, 2, 4);
    const atlas = new Image();
    await new Promise(resolve => {
      atlas.onload = resolve;
      atlas.src = source.toDataURL();
    });
    const registry = createAssetRegistry(
      { atlas },
      { metadata: {
        rotatedImage: { kind: 'standalone-image', imageKey: 'atlas', rect: { x: 0, y: 0, w: 2, h: 4 } },
        rotatedSprite: createAtlasSpriteMetadata({ atlasId: 'atlas.test', imageKey: 'atlas', x: 2, y: 0, w: 2, h: 4 }),
        rotatedQuad: { kind: 'standalone-image', imageKey: 'atlas', rect: { x: 4, y: 0, w: 2, h: 4 } }
      } }
    );
    const frame = createRenderFrameBuilder({ width: 18, height: 6 })
      .add({ kind: 'clear', fill: '#000' })
      .add({ kind: 'image', assetId: 'rotatedImage', x: 2, y: 1, w: 2, h: 4, rotation: Math.PI / 2 })
      .add({ kind: 'sprite', assetId: 'rotatedSprite', x: 8, y: 1, w: 2, h: 4, rotation: Math.PI / 2 })
      .add({ kind: 'texturedQuad', assetId: 'rotatedQuad', sourceRect: { x: 4, y: 0, w: 2, h: 4 }, x: 14, y: 1, w: 2, h: 4, rotation: Math.PI / 2 })
      .finalize();

    const game = { view: { bufferWidth: 18, bufferHeight: 6 }, renderCanvas: document.createElement('canvas'), renderPipeline: {}, devTools: { flags: {} } };
    renderNativeFrame({ now: () => 0, random: () => 0.5 }, game, frame, { assetRegistry: registry, nativeBackendKind: 'webgl' });
    const pipelineDiagnostics = game.renderPipeline.diagnostics;

    const backend = createWebGlNativeFrameBackend({ width: 18, height: 6, assetRegistry: registry });
    if (!backend) return { supported: false };
    backend.draw(frame);
    const pixels = new Uint8Array(18 * 6 * 4);
    backend.gl.readPixels(0, 0, 18, 6, backend.gl.RGBA, backend.gl.UNSIGNED_BYTE, pixels);
    const at = (x, y) => Array.from(pixels.slice(((5 - y) * 18 + x) * 4, ((5 - y) * 18 + x) * 4 + 4));
    return {
      supported: true,
      actualBackendKind: pipelineDiagnostics.actualBackendKind,
      fallback: pipelineDiagnostics.fallback,
      imageRotatedExtent: at(1, 3),
      imageOriginalExtent: at(3, 0),
      spriteRotatedExtent: at(7, 3),
      quadRotatedExtent: at(13, 3)
    };
  });

  test.skip(!result.supported, 'WebGL unavailable in this browser');
  expect(result.actualBackendKind).toBe('webgl');
  expect(result.fallback.occurred).toBe(false);
  expect(result.imageRotatedExtent).toEqual([0, 255, 0, 255]);
  expect(result.imageOriginalExtent).toEqual([0, 0, 0, 255]);
  expect(result.spriteRotatedExtent).toEqual([255, 0, 0, 255]);
  expect(result.quadRotatedExtent).toEqual([0, 0, 255, 255]);
});

test('webgl2 deferred backend lights opaque rect terrain with point falloff', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ createRenderFrameBuilder }, { createWebGl2DeferredNativeFrameBackend }] = await Promise.all([
      import('/src/engine/render/frame-builder.js'),
      import('/src/render/backends/webgl2-deferred-native-frame-backend.js')
    ]);
    const backend = createWebGl2DeferredNativeFrameBackend({ width: 8, height: 4 });
    if (!backend) return { supported: false };
    const frame = createRenderFrameBuilder({ width: 8, height: 4 })
      .add({ kind: 'clear', fill: '#000000', lighting: 'unlit' })
      .add({ kind: 'rect', lighting: 'lit', x: 0, y: 0, w: 8, h: 4, fill: '#808080' })
      .add({ kind: 'light2d', lighting: 'light', lightKind: 'ambient', sourceId: 'ambient', color: [255, 255, 255, 255], intensity: 0.1 })
      .add({ kind: 'light2d', lighting: 'light', lightKind: 'point', sourceId: 'point', color: [255, 255, 255, 255], intensity: 1, x: 2, y: 2, radius: 2, volumetricIntensity: 0, castsShadows: false })
      .finalize();
    backend.draw(frame);
    const pixels = backend.ctx.getImageData(0, 0, 8, 4).data;
    const at = (x, y) => Array.from(pixels.slice((y * 8 + x) * 4, (y * 8 + x) * 4 + 4));
    return { supported: true, center: at(2, 2), outside: at(7, 2), source: backend.getSource(), gpuDiagnostics: backend.gpuDiagnostics };
  });

  test.skip(!result.supported, 'WebGL2 unavailable in this browser');
  expect(result.center[0]).toBeGreaterThan(result.outside[0]);
  expect(result.center[1]).toBeGreaterThan(result.outside[1]);
  expect(result.center[2]).toBeGreaterThan(result.outside[2]);
  expect(result.source).toMatchObject({ kind: 'canvas2d', width: 8, height: 4 });
  expect(result.gpuDiagnostics).toMatchObject({ frameCount: 1, albedoTexture: true, lightTexture: true, volumeTexture: true, framebuffer: true });
});

test('webgl2 deferred backend lights image, texturedQuad, and atlas sprite packets with alpha masking', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ createRenderFrameBuilder }, { createAssetRegistry, ASSET_IDS, createAtlasSpriteMetadata }, { createWebGl2DeferredNativeFrameBackend }] = await Promise.all([
      import('/src/engine/render/frame-builder.js'),
      import('/src/render/asset-registry.js'),
      import('/src/render/backends/webgl2-deferred-native-frame-backend.js')
    ]);

    const source = document.createElement('canvas');
    source.width = 6;
    source.height = 2;
    const sourceCtx = source.getContext('2d');
    sourceCtx.fillStyle = 'rgb(20,20,20)';
    sourceCtx.fillRect(0, 0, 2, 2);
    sourceCtx.fillStyle = 'rgb(80,80,80)';
    sourceCtx.fillRect(2, 0, 2, 2);
    sourceCtx.fillStyle = 'rgb(120,120,120)';
    sourceCtx.fillRect(4, 0, 2, 2);
    sourceCtx.clearRect(4, 0, 1, 1);
    const atlas = new Image();
    await new Promise(resolve => {
      atlas.onload = resolve;
      atlas.src = source.toDataURL();
    });

    const registry = createAssetRegistry(
      { atlas },
      {
        metadata: {
          'standalone.a': { kind: 'standalone-image', imageKey: 'atlas' },
          'standalone.b': { kind: 'standalone-image', imageKey: 'atlas' },
          [ASSET_IDS.HAZARD_SPIKES]: createAtlasSpriteMetadata({ atlasId: 'atlas.test', imageKey: 'atlas', x: 4, y: 0, w: 2, h: 2 })
        }
      }
    );
    const backend = createWebGl2DeferredNativeFrameBackend({ width: 6, height: 2, assetRegistry: registry });
    if (!backend) return { supported: false };
    const frame = createRenderFrameBuilder({ width: 6, height: 2 })
      .add({ kind: 'clear', fill: '#000000', lighting: 'unlit' })
      .add({ kind: 'image', assetId: 'standalone.a', sourceRect: { x: 0, y: 0, w: 2, h: 2 }, lighting: 'lit', x: 0, y: 0, w: 2, h: 2 })
      .add({ kind: 'texturedQuad', assetId: 'standalone.b', sourceRect: { x: 2, y: 0, w: 2, h: 2 }, lighting: 'lit', x: 2, y: 0, w: 2, h: 2 })
      .add({ kind: 'sprite', assetId: ASSET_IDS.HAZARD_SPIKES, lighting: 'lit', x: 4, y: 0, w: 2, h: 2 })
      .add({ kind: 'light2d', lighting: 'light', lightKind: 'ambient', sourceId: 'ambient', color: [255, 255, 255, 255], intensity: 1 })
      .add({ kind: 'light2d', lighting: 'light', lightKind: 'point', sourceId: 'point', color: [255, 255, 255, 255], intensity: 1, x: 1, y: 1, radius: 2, volumetricIntensity: 0, castsShadows: false })
      .finalize();
    backend.draw(frame);
    const pixels = backend.ctx.getImageData(0, 0, 6, 2).data;
    const at = (x, y) => Array.from(pixels.slice((y * 6 + x) * 4, (y * 6 + x) * 4 + 4));
    return { supported: true, imageCenter: at(1, 1), texturedQuad: at(2, 1), spriteTransparent: at(4, 0), spriteOpaque: at(5, 0), diagnostics: backend.diagnostics };
  });

  test.skip(!result.supported, 'WebGL2 unavailable in this browser');
  expect(result.imageCenter[0]).toBeGreaterThan(20);
  expect(result.texturedQuad[0]).toBeGreaterThanOrEqual(80);
  expect(result.texturedQuad[0]).toBeLessThan(90);
  expect(result.spriteTransparent).toEqual([0, 0, 0, 255]);
  expect(result.spriteOpaque).toEqual([120, 120, 120, 255]);
  expect(result.diagnostics).toEqual([]);
});

test('gameplay native backend can be toggled without changing extraction', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ ensureNativeFrameBackend }, { createAssetRegistry }] = await Promise.all([
      import('/src/render/gameplay-render-pipeline.js'),
      import('/src/render/asset-registry.js')
    ]);
    const game = { view: { bufferWidth: 8, bufferHeight: 8 }, renderCanvas: document.createElement('canvas'), renderPipeline: {} };
    const assetRegistry = createAssetRegistry({});
    const gpu = ensureNativeFrameBackend(game, { assetRegistry, nativeBackendKind: 'webgl' });
    const fallback = ensureNativeFrameBackend(game, { assetRegistry, nativeBackendKind: 'canvas2d' });
    return { gpuKind: gpu.kind, fallbackKind: fallback.kind };
  });

  expect(['webgl-native-frame-backend', 'canvas2d-native-frame-backend']).toContain(result.gpuKind);
  expect(result.fallbackKind).toBe('canvas2d-native-frame-backend');
});

test('deferred lighting selection ignores default ambient and requests deferred for authored lights', () => {
  const defaultBuilder = createRenderFrameBuilder({ width: 8, height: 8 });
  addLightPackets(defaultBuilder, [], { cameraX: 0, cameraY: 0, worldWidth: 8, worldHeight: 8, worldToNativeX: 1, worldToNativeY: 1 });
  const defaultFrame = defaultBuilder.finalize();
  expect(hasOnlyDefaultAmbientLight(defaultFrame)).toBe(true);
  expect(hasAuthoredLightPackets(defaultFrame)).toBe(false);
  expect(selectNativeFrameBackendKindForFrame(defaultFrame)).toBe('canvas2d');

  const authoredFrame = createRenderFrameBuilder({ width: 8, height: 8 })
    .add({ kind: 'light2d', lightKind: 'ambient', lighting: 'light', sourceId: 'ambient', color: [12, 16, 28, 255], intensity: 0.5 })
    .finalize();
  expect(hasOnlyDefaultAmbientLight(authoredFrame)).toBe(false);
  expect(hasAuthoredLightPackets(authoredFrame)).toBe(true);
  expect(selectNativeFrameBackendKindForFrame(authoredFrame)).toBe('webgl2-deferred');
  expect(selectNativeFrameBackendKindForFrame(authoredFrame, { devToolsFlags: { disableDeferredLighting: true } })).toBe('canvas2d');
  expect(selectNativeFrameBackendKindForFrame(defaultFrame, { devToolsFlags: { forceDeferredLighting: true } })).toBe('webgl2-deferred');
});

test('authored gameplay lights select the webgl2 deferred backend when available', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ createGameplaySession, syncGameplaySessionToGame }, { getTilemapById }, { renderGameplayFrame }, { createAssetRegistry }] = await Promise.all([
      import('/src/core/gameplay-session.js'),
      import('/src/content/tilemaps/registry.js'),
      import('/src/render/gameplay-render-pipeline.js'),
      import('/src/render/asset-registry.js')
    ]);
    const view = { width: 640, height: 360, bufferWidth: 320, bufferHeight: 180 };
    const session = createGameplaySession(getTilemapById('rendering-gym-map'), { view, scenarioId: 'rendering-gym' });
    const heartsEl = document.createElement('div');
    for (let i = 0; i < 5; i++) heartsEl.append(document.createElement('span'));
    const game = {
      view,
      renderCanvas: document.createElement('canvas'),
      renderPipeline: {},
      presentation: { present(source) { this.lastSource = source; } },
      devTools: { flags: {} },
      settings: {},
      appState: { started: true, paused: false },
      input: { inputScheme: 'wasd' },
      ui: {
        hudLevelName: document.createElement('div'),
        heartsEl,
        dashStatusEl: document.createElement('div'),
        messageEl: document.createElement('div'),
        messageTitleEl: document.createElement('div'),
        messageNextLevelButton: document.createElement('button'),
        hintLayerEl: null
      }
    };
    syncGameplaySessionToGame(game, session);
    game.tilemaps = { getNextTilemap: () => null };
    renderGameplayFrame({ now: () => 0, random: () => 0.5 }, game, { assetRegistry: createAssetRegistry({}) });
    return {
      backendKind: game.renderPipeline.nativeBackendKind,
      backend: game.renderPipeline.nativeBackend.kind,
      deferredFallbackReasons: game.renderPipeline.diagnostics?.fallback?.issues?.map(issue => issue.reason) ?? [],
      presentedWidth: game.presentation.lastSource?.width
    };
  });

  test.skip(result.backendKind === 'canvas2d' && result.deferredFallbackReasons.includes('webgl2 deferred native-frame backend unavailable'), 'WebGL2 unavailable in this browser');
  expect(result.backendKind).toBe('webgl2-deferred');
  expect(result.backend).toBe('webgl2-deferred-native-frame-backend');
  expect(result.deferredFallbackReasons).toEqual([]);
  expect(result.presentedWidth).toBe(320);
});

test('light packet extraction emits default ambient and culled/native point packets', () => {
  const view = { cameraX: 10, cameraY: 20, worldWidth: 100, worldHeight: 80, worldToNativeX: 2, worldToNativeY: 2 };
  const builder = createRenderFrameBuilder({ width: 200, height: 160 });
  addLightPackets(builder, [], view);
  expect(builder.finalize().packets).toEqual([
    expect.objectContaining({ kind: 'light2d', lightKind: 'ambient', sourceId: 'default-ambient-light', defaultLight: true, lighting: 'light', color: [255, 255, 255, 255], intensity: 1 })
  ]);

  const point = {
    id: 'torch:light2d:0',
    transform: { x: 20, y: 40, w: 16, h: 16 },
    render: renderLight2d({ kind: 'point', radius: 32, color: Color.rgb(255, 176, 92), intensity: 1.5, offset: Vec.xy(2, -4), volumetricIntensity: 0.02, castsShadows: true })
  };
  const outside = {
    id: 'far:light2d:0',
    transform: { x: 1000, y: 1000, w: 16, h: 16 },
    render: renderLight2d({ kind: 'point', radius: 32 })
  };
  const litBuilder = createRenderFrameBuilder({ width: 200, height: 160 });
  addLightPackets(litBuilder, [point, outside], view);
  const packets = litBuilder.finalize().packets;
  expect(lightWorldPosition(point)).toEqual({ x: 30, y: 44 });
  expect(pointLightIntersectsView(point, view)).toBe(true);
  expect(pointLightIntersectsView(outside, view)).toBe(false);
  expect(packets).toHaveLength(2);
  expect(packets[1]).toMatchObject({ kind: 'light2d', lightKind: 'point', sourceId: 'torch:light2d:0', lighting: 'light', x: 40, y: 48, radius: 64, color: [255, 176, 92, 255], intensity: 1.5, volumetricIntensity: 0.02, castsShadows: true });
});

test('rendering gym emits one authored ambient and two point light packets', () => {
  const view = { width: 640, height: 360, bufferWidth: 320, bufferHeight: 180 };
  const session = createGameplaySession(getTilemapById('rendering-gym-map'), { view, scenarioId: 'rendering-gym' });
  const game = { view, devTools: { flags: {} } };
  syncGameplaySessionToGame(game, session);

  const { frame } = extractGameplayRenderFrame({ game, runtime: { now: () => 0, random: () => 0.5 }, assetRegistry: createAssetRegistry({}) });
  const lightPackets = frame.packets.filter(packet => packet.kind === 'light2d');
  const ambientPackets = lightPackets.filter(packet => packet.lightKind === 'ambient');
  const pointPackets = lightPackets.filter(packet => packet.lightKind === 'point');

  expect(ambientPackets).toEqual([
    expect.objectContaining({ sourceId: 'rendering-gym-ambient-light:light2d:0', color: [56, 68, 84, 255], intensity: 0.72 })
  ]);
  expect(ambientPackets[0].defaultLight).toBeUndefined();
  expect(pointPackets).toHaveLength(2);
  expect(pointPackets.map(packet => packet.sourceId)).toEqual(['rendering-gym-left-torch-light:light2d:0', 'rendering-gym-right-torch-light:light2d:0']);
  expect(pointPackets).toEqual(expect.arrayContaining([
    expect.objectContaining({ color: [255, 176, 92, 255], intensity: 1, radius: 64, volumetricIntensity: 0.02, castsShadows: false })
  ]));
});

test('gameplay render read model collects multiple light components and authored ambient replaces default', () => {
  const tilemap = defineScene({
    id: 'lights-scene',
    kind: 'tilemap',
    objects: [{
      id: 'light-object',
      transform: { x: 16, y: 24, w: 32, h: 32 },
      components: [
        renderLight2d({ kind: 'ambient', color: Color.rgb(12, 16, 28), intensity: 0.55 }),
        renderLight2d({ kind: 'point', radius: 40, offset: Vec.xy(0, -8) })
      ]
    }]
  });
  const model = createGameplayRenderReadModel({ tilemap });
  expect(model.authoredScene.lights).toHaveLength(2);
  expect(model.authoredScene.lights.map(light => light.id)).toEqual(['light-object:light2d:0', 'light-object:light2d:1']);
  expect(model.authoredScene.lights[0].transform).toEqual({ x: 16, y: 24, w: 32, h: 32 });

  const builder = createRenderFrameBuilder({ width: 100, height: 100 });
  addLightPackets(builder, model.authoredScene.lights, { cameraX: 0, cameraY: 0, worldWidth: 100, worldHeight: 100, worldToNativeX: 1, worldToNativeY: 1 });
  const packets = builder.finalize().packets;
  const ambientPackets = packets.filter(packet => packet.lightKind === 'ambient');
  expect(ambientPackets).toEqual([
    expect.objectContaining({ sourceId: 'light-object:light2d:0', color: [12, 16, 28, 255], intensity: 0.55 })
  ]);
  expect(ambientPackets[0].defaultLight).toBeUndefined();
  expect(packets.filter(packet => packet.lightKind === 'point')).toHaveLength(1);
});

test('gameplay render read model separates authored scene, runtime actors, and transient effects', () => {
  const tilemap = { id: 'scene-a' };
  const model = createGameplayRenderReadModel({
    tilemap,
    devTools: { flags: { showPhysicsBodyRects: true } },
    player: { x: 1, y: 2, w: 20, h: 30, dir: -1, inv: 0, attack: 1, hp: 5 },
    enemies: [
      { x: 10, y: 20, w: 40, h: 32, hp: 3, hurt: 0 },
      { x: 50, y: 20, w: 40, h: 32, hp: 0, hurt: 0 }
    ],
    dust: [{ x: 5, y: 6, life: 0.25 }],
    particles: [{ x: 7, y: 8, life: 0.5, color: '#fff' }]
  });

  expect(model.authoredScene.tilemap).toBe(tilemap);
  expect(model.runtimeActors.map(actor => actor.render.actor)).toEqual(['player', 'slime']);
  expect(model.runtimeActors[0].transform).toEqual({ x: 1, y: 2, w: 20, h: 30 });
  expect(model.transientEffects.map(effect => effect.effect)).toEqual(['dust', 'particle']);
  expect(model.debug.physicsBodies).toHaveLength(2);
});
