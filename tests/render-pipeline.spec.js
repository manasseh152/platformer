import { expect, test } from '@playwright/test';
import { createRenderFrameBuilder, resetRenderPacketSequenceForTests } from '../src/engine/render/frame-builder.js';
import { computePresentationViewport, prepareRenderView, worldToNativeRect } from '../src/engine/render/viewport.js';
import { createAssetRegistry, ASSET_IDS, createAtlasSpriteMetadata } from '../src/render/asset-registry.js';
import { createGameplayRenderReadModel } from '../src/render/extractors/gameplay-renderables.js';

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
