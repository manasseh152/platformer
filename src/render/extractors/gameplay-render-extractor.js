import { DEBUG_CAMERA } from '../../core/constants.js';
import { createRenderFrameBuilder } from '../../engine/render/frame-builder.js';
import { prepareRenderView } from '../../engine/render/viewport.js';
import { emptyAssetRegistry } from '../asset-registry.js';
import { addDungeonBackdropPackets, addTilemapVisualPackets } from './tilemap-render-extractor.js';
import { GameplayRenderLayer as L } from './gameplay-render-layers.js';
import { createGameplayRenderReadModel } from './gameplay-renderables.js';
import { addEnemyPackets, addPlayerPackets, addWorldEllipse, addWorldRect } from './primitive-builders.js';

const DEBUG_STYLES = Object.freeze({
  terrainCell: { fill: 'rgba(255, 220, 0, 0.08)', stroke: 'rgba(255, 220, 0, 0.75)' },
  collisionCell: { fill: 'rgba(0, 220, 255, 0.16)', stroke: 'rgba(0, 220, 255, 0.72)' },
  collisionRect: { fill: 'rgba(255, 80, 80, 0.12)', stroke: 'rgba(255, 80, 80, 0.95)' },
  physicsBody: { fill: 'rgba(180, 90, 255, 0.12)', stroke: 'rgba(180, 90, 255, 0.95)' }
});

function addDebugRect(builder, view, rect, style, layer) {
  addWorldRect(builder, view, rect, { kind: 'rect', layer, fill: style.fill });
  addWorldRect(builder, view, rect, { kind: 'rect', layer, stroke: style.stroke, lineWidth: 1 });
}

function addCollisionDebugPackets(builder, tilemap, view, flags = {}) {
  if (!tilemap) return;
  if (flags.showBuildTerrainCells) for (const rect of tilemap.renderLayers?.containedTerrainTiles ?? []) addDebugRect(builder, view, rect, DEBUG_STYLES.terrainCell, L.DebugCollision);
  if (flags.showCollisionCells) for (const rect of tilemap.collisionLayers?.terrainPrimitives ?? []) addDebugRect(builder, view, rect, DEBUG_STYLES.collisionCell, L.DebugCollision);
  if (flags.showCollisionRects) for (const rect of tilemap.collisionLayers?.terrainRects ?? []) addDebugRect(builder, view, rect, DEBUG_STYLES.collisionRect, L.DebugCollision);
}

function addPhysicsDebugPackets(builder, readModel, view) {
  if (!readModel.debug.devToolsFlags?.showPhysicsBodyRects) return;
  for (const actor of readModel.debug.physicsBodies) addDebugRect(builder, view, actor.transform, DEBUG_STYLES.physicsBody, L.DebugPhysics);
}

function addAuthoredSceneRenderablePackets(builder, readModel, renderView, assetRegistry) {
  const { tilemap, devToolsFlags } = readModel.authoredScene;
  addDungeonBackdropPackets(builder, renderView, L.Backdrop);
  addTilemapVisualPackets(builder, tilemap, renderView, { assetRegistry, includeBackdrop: true, layers: L, devToolsFlags });
}

function addRuntimeActorRenderablePackets(builder, readModel, renderView, runtimeNow) {
  for (const actor of readModel.runtimeActors) {
    if (actor.render.actor === 'player') addPlayerPackets(builder, renderView, actor, L.Player, runtimeNow);
    else if (actor.render.actor === 'slime') addEnemyPackets(builder, renderView, actor, L.Enemy);
  }
}

function addTransientEffectRenderablePackets(builder, readModel, renderView) {
  for (const effect of readModel.transientEffects) {
    if (effect.render.shape === 'ellipse') addWorldEllipse(builder, renderView, effect.transform, { layer: L.Dust, fill: effect.render.fill, alpha: effect.render.alpha });
    else if (effect.render.shape === 'rect') addWorldRect(builder, renderView, effect.transform, { kind: 'rect', layer: L.Particle, fill: effect.render.fill, alpha: effect.render.alpha });
  }
}

export function extractGameplayRenderFrame({ game, runtime = { now: () => performance.now(), random: Math.random }, assetRegistry = emptyAssetRegistry } = {}) {
  const viewConfig = game.view;
  const renderView = prepareRenderView({
    camera: game.camera,
    viewWidth: viewConfig.width,
    viewHeight: viewConfig.height,
    bufferWidth: viewConfig.bufferWidth,
    bufferHeight: viewConfig.bufferHeight,
    shake: game.camera?.shake ?? 0,
    random: runtime.random ?? Math.random
  });
  const readModel = createGameplayRenderReadModel(game);
  const builder = createRenderFrameBuilder({ width: viewConfig.bufferWidth, height: viewConfig.bufferHeight, coordinateSpace: 'native' });
  builder.add({ kind: 'clear', layer: L.Clear, color: '#080b11' });

  addAuthoredSceneRenderablePackets(builder, readModel, renderView, assetRegistry);
  addRuntimeActorRenderablePackets(builder, readModel, renderView, runtime.now?.() ?? 0);
  addTransientEffectRenderablePackets(builder, readModel, renderView);

  addCollisionDebugPackets(builder, readModel.authoredScene.tilemap, renderView, readModel.debug.devToolsFlags);
  addPhysicsDebugPackets(builder, readModel, renderView);

  if (DEBUG_CAMERA) {
    addWorldRect(builder, renderView, { x: renderView.cameraX + game.camera.deadzone.left, y: renderView.cameraY + game.camera.deadzone.top, w: game.camera.deadzone.right - game.camera.deadzone.left, h: game.camera.deadzone.bottom - game.camera.deadzone.top }, { kind: 'rect', layer: L.DebugCamera, stroke: 'rgba(255,255,0,.8)', lineWidth: 1 });
    addWorldRect(builder, renderView, { x: renderView.cameraX, y: renderView.cameraY, w: viewConfig.width, h: viewConfig.height }, { kind: 'rect', layer: L.DebugCamera, stroke: 'rgba(255,80,80,.9)', lineWidth: 1 });
  }

  return { frame: builder.finalize(), renderView };
}
