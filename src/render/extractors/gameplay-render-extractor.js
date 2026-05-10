import { DEBUG_CAMERA } from '../../core/constants.js';
import { createRenderFrameBuilder } from '../../engine/render/frame-builder.js';
import { prepareRenderView } from '../../engine/render/viewport.js';
import { emptyAssetRegistry } from '../asset-registry.js';
import { addDungeonBackdropPackets, addTilemapVisualPackets } from './tilemap-render-extractor.js';
import { GameplayRenderLayer as L } from './gameplay-render-layers.js';
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

function addPhysicsDebugPackets(builder, game, view, flags = {}) {
  if (!flags.showPhysicsBodyRects) return;
  const rects = [game?.player, ...(game?.enemies ?? []).filter(enemy => enemy.hp === undefined || enemy.hp > 0)]
    .filter(rect => rect && Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.w) && Number.isFinite(rect.h) && rect.w > 0 && rect.h > 0);
  for (const rect of rects) addDebugRect(builder, view, rect, DEBUG_STYLES.physicsBody, L.DebugPhysics);
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
  const builder = createRenderFrameBuilder({ width: viewConfig.bufferWidth, height: viewConfig.bufferHeight, coordinateSpace: 'native' });
  builder.add({ kind: 'clear', layer: L.Clear, color: '#080b11' });
  addDungeonBackdropPackets(builder, renderView, L.Backdrop);
  const previousFlags = game.tilemap.devToolsFlags;
  game.tilemap.devToolsFlags = game.devTools?.flags;
  addTilemapVisualPackets(builder, game.tilemap, renderView, { assetRegistry, includeBackdrop: true, layers: L });
  game.tilemap.devToolsFlags = previousFlags;

  for (const d of game.dust ?? []) addWorldEllipse(builder, renderView, { x: d.x, y: d.y, radiusX: 5, radiusY: 5 }, { layer: L.Dust, fill: '#bfffff', alpha: Math.max(0, d.life * 3) });
  for (const enemy of game.enemies ?? []) addEnemyPackets(builder, renderView, enemy, L.Enemy);
  addPlayerPackets(builder, renderView, game.player, L.Player, runtime.now?.() ?? 0);
  for (const p of game.particles ?? []) addWorldRect(builder, renderView, { x: p.x, y: p.y, w: 4, h: 4 }, { kind: 'rect', layer: L.Particle, fill: p.color, alpha: Math.max(0, p.life * 2) });

  addCollisionDebugPackets(builder, game.tilemap, renderView, game.devTools?.flags);
  addPhysicsDebugPackets(builder, game, renderView, game.devTools?.flags);

  if (DEBUG_CAMERA) {
    addWorldRect(builder, renderView, { x: renderView.cameraX + game.camera.deadzone.left, y: renderView.cameraY + game.camera.deadzone.top, w: game.camera.deadzone.right - game.camera.deadzone.left, h: game.camera.deadzone.bottom - game.camera.deadzone.top }, { kind: 'rect', layer: L.DebugCamera, stroke: 'rgba(255,255,0,.8)', lineWidth: 1 });
    addWorldRect(builder, renderView, { x: renderView.cameraX, y: renderView.cameraY, w: viewConfig.width, h: viewConfig.height }, { kind: 'rect', layer: L.DebugCamera, stroke: 'rgba(255,80,80,.9)', lineWidth: 1 });
  }

  return { frame: builder.finalize(), renderView };
}
