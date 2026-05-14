import { createRenderFrameBuilder } from '../engine/render/frame-builder.js';
import { identityRenderView, addTilemapVisualPackets } from './extractors/tilemap-render-extractor.js';
import { addEnemyPackets, addPlayerPackets } from './extractors/primitive-builders.js';
import { GameplayRenderLayer as L } from './extractors/gameplay-render-layers.js';

export const PARITY_ASSET_IDS = Object.freeze({
  standalone: 'parity.standalone-image',
  atlasSprite: 'parity.atlas-sprite',
  actorSprite: 'parity.actor-sprite',
  rotatedSprite: 'parity.rotated-sprite'
});

function frame(width, height) {
  return createRenderFrameBuilder({ width, height });
}

function clearRectVectorScenario() {
  return frame(16, 16)
    .add({ kind: 'clear', color: '#010203' })
    .add({ kind: 'rect', x: 0, y: 0, w: 8, h: 16, fill: '#ff0000' })
    .add({ kind: 'path', fill: '#00ff00', commands: [
      { op: 'moveTo', x: 10, y: 2 },
      { op: 'lineTo', x: 14, y: 2 },
      { op: 'lineTo', x: 14, y: 6 },
      { op: 'lineTo', x: 10, y: 6 },
      { op: 'closePath' }
    ] })
    .add({ kind: 'ellipse', x: 12, y: 12, radiusX: 3, radiusY: 3, fill: '#0000ff' })
    .finalize();
}

function standaloneImageScenario(assetIds) {
  return frame(8, 8)
    .add({ kind: 'clear', color: '#000000' })
    .add({ kind: 'image', assetId: assetIds.standalone, sourceRect: { x: 0, y: 0, w: 4, h: 4 }, x: 2, y: 2, w: 4, h: 4 })
    .finalize();
}

function atlasSpriteScenario(assetIds) {
  return frame(8, 8)
    .add({ kind: 'clear', color: '#000000' })
    .add({ kind: 'sprite', assetId: assetIds.atlasSprite, x: 2, y: 2, w: 4, h: 4 })
    .finalize();
}

function tilemapContainedTerrainScenario() {
  const builder = frame(24, 24).add({ kind: 'clear', color: '#000000' });
  addTilemapVisualPackets(builder, {
    id: 'parity-contained-terrain',
    tileSize: 16,
    layers: [
      { id: 'backdrop', rows: ['..', '..'] },
      { id: 'decor', rows: ['..', '..'] }
    ],
    renderLayers: {
      containedTerrainTiles: [{ x: 4, y: 4, w: 16, h: 16, kind: 'dirt', mask: 0 }]
    },
    objects: []
  }, identityRenderView(24, 24), { includeBackdrop: false });
  return builder.finalize();
}

function actorsAndSpriteTransformsScenario(assetIds) {
  const builder = frame(40, 28).add({ kind: 'clear', color: '#000000' });
  addPlayerPackets(builder, identityRenderView(40, 28), {
    transform: { x: 2, y: -10, w: 28, h: 40 },
    render: { actor: 'player', facing: -1, attack: 1 }
  }, L.Player, 100);
  addEnemyPackets(builder, identityRenderView(40, 28), {
    transform: { x: 4, y: 4, w: 32, h: 24 },
    render: { actor: 'slime', hurt: 0 },
    health: { hp: 1 }
  }, L.Enemy);
  builder
    .add({ kind: 'sprite', assetId: assetIds.actorSprite, x: 28, y: 2, w: 4, h: 4, flipX: true })
    .add({ kind: 'sprite', assetId: assetIds.rotatedSprite, x: 30, y: 14, w: 2, h: 4, rotation: Math.PI / 2 });
  return builder.finalize();
}

function lightingPrimitivesScenario() {
  return frame(12, 8)
    .add({ kind: 'clear', color: '#000000', lighting: 'unlit' })
    .add({ kind: 'rect', x: 0, y: 0, w: 8, h: 8, fill: '#404040', lighting: 'lit' })
    .add({ kind: 'rect', x: 8, y: 0, w: 4, h: 8, fill: '#ff8000', lighting: 'unlit' })
    .add({ kind: 'light2d', lighting: 'light', lightKind: 'ambient', sourceId: 'parity-ambient', color: [255, 255, 255, 255], intensity: 0.2 })
    .add({ kind: 'light2d', lighting: 'light', lightKind: 'point', sourceId: 'parity-point', x: 3, y: 4, radius: 4, color: [255, 255, 255, 255], intensity: 1, volumetricIntensity: 0, castsShadows: false })
    .finalize();
}

function debugOverlayScenario() {
  return frame(12, 12)
    .add({ kind: 'clear', color: '#000000' })
    .add({ kind: 'rect', layer: L.DebugCollision, x: 2, y: 2, w: 8, h: 8, fill: 'rgba(0, 220, 255, 0.16)' })
    .add({ kind: 'rect', layer: L.DebugCollision, x: 2, y: 2, w: 8, h: 8, stroke: '#00dcff', lineWidth: 1 })
    .add({ kind: 'path', layer: L.DebugPhysics, stroke: '#b45aff', lineWidth: 2, commands: [{ op: 'moveTo', x: 1, y: 10 }, { op: 'lineTo', x: 10, y: 1 }] })
    .finalize();
}

export function createRenderParityScenarios({ assetIds = PARITY_ASSET_IDS } = {}) {
  return [
    { id: 'clear-rect-vector-primitives', frame: clearRectVectorScenario(), samplePoints: [{ x: 1, y: 1 }, { x: 12, y: 4 }, { x: 12, y: 12 }] },
    { id: 'standalone-image-packets', frame: standaloneImageScenario(assetIds), samplePoints: [{ x: 2, y: 2 }, { x: 5, y: 5 }] },
    { id: 'atlas-sprite-packets', frame: atlasSpriteScenario(assetIds), samplePoints: [{ x: 2, y: 2 }, { x: 5, y: 5 }] },
    { id: 'tilemap-contained-terrain-chunks', frame: tilemapContainedTerrainScenario(), samplePoints: [{ x: 12, y: 12 }, { x: 5, y: 5 }] },
    { id: 'actors-and-flipped-rotated-sprites', frame: actorsAndSpriteTransformsScenario(assetIds), samplePoints: [{ x: 30, y: 2 }, { x: 29, y: 16 }] },
    { id: 'lighting-primitives-lit-unlit-surfaces', frame: lightingPrimitivesScenario(), samplePoints: [{ x: 3, y: 4 }, { x: 10, y: 4 }] },
    { id: 'debug-overlays', frame: debugOverlayScenario(), samplePoints: [{ x: 2, y: 2 }, { x: 6, y: 6 }], tolerance: 60 }
  ];
}
