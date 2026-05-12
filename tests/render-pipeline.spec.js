import { expect, test } from '@playwright/test';
import { createRenderFrameBuilder, resetRenderPacketSequenceForTests } from '#/engine/render/frame-builder.js';
import { computePresentationViewport, prepareRenderView, worldToNativeRect } from '#/engine/render/viewport.js';
import { createAssetRegistry, ASSET_IDS, createAtlasSpriteMetadata } from '#/render/asset-registry.js';
import { analyzeWebGlNativeFrameSupport } from '#/render/backends/webgl-native-frame-capabilities.js';
import { extractGameplayRenderFrame } from '#/render/extractors/gameplay-render-extractor.js';
import { createGameplayRenderReadModel } from '#/render/extractors/gameplay-renderables.js';
import { createGameplaySession, syncGameplaySessionToGame } from '#/core/gameplay-session.js';
import { Color } from '#/core/color.js';
import { Vec } from '#/core/vector.js';
import { renderLight2d } from '#/engine/scene/components.js';
import { defineScene } from '#/engine/scene/scene.js';
import { getTilemapById } from '#/content/tilemaps/registry.js';
import { addLightPackets, lightWorldPosition, pointLightIntersectsView } from '#/render/extractors/light-packets.js';

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

test('webgl native backend capability check rejects unsupported real gameplay packets', () => {
  const view = { width: 640, height: 360, bufferWidth: 320, bufferHeight: 180 };
  const session = createGameplaySession(getTilemapById('act-01-level-1'), { view, scenarioId: 'act-01-level-1' });
  const game = { view, devTools: { flags: {} } };
  syncGameplaySessionToGame(game, session);

  const { frame } = extractGameplayRenderFrame({ game, runtime: { now: () => 0, random: () => 0.5 }, assetRegistry: createAssetRegistry({}) });
  const support = analyzeWebGlNativeFrameSupport(frame);
  const reasons = support.issues.map(issue => issue.reason);

  expect(support.supported).toBe(false);
  expect(reasons).toContain('unsupported packet kind: roundRect');
  expect(reasons).toContain('unsupported packet kind: ellipse');
  expect(reasons).toContain('unsupported packet kind: path');
  expect(reasons).toContain('unsupported fill kind for rect: linearGradient');
  expect(reasons).toContain('unsupported fill kind for rect: radialGradient');
});

test('renderGameplayFrame falls back to canvas2d when requested webgl cannot draw extracted packets', async ({ page }) => {
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
      fallbackReasons: game.renderPipeline.webglFallbackReason?.map(issue => issue.reason) ?? [],
      presentedWidth: game.presentation.lastSource?.width
    };
  });

  expect(result.backendKind).toBe('canvas2d');
  expect(result.backend).toBe('canvas2d-native-frame-backend');
  expect(result.fallbackReasons).toContain('unsupported packet kind: roundRect');
  expect(result.presentedWidth).toBe(320);
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
    expect.objectContaining({ sourceId: 'lights:0,0:light2d:0', color: [12, 16, 28, 255], intensity: 0.55 })
  ]);
  expect(ambientPackets[0].defaultLight).toBeUndefined();
  expect(pointPackets).toHaveLength(2);
  expect(pointPackets.map(packet => packet.sourceId)).toEqual(['lights:4,3:light2d:0', 'lights:12,3:light2d:0']);
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
