import { drawPixelRect } from '../rendering/pixel-outline.js';

const DEBUG_RECT_STYLES = {
  terrainCell: {
    fill: 'rgba(255, 220, 0, 0.08)',
    outline: 'rgba(255, 220, 0, 0.75)',
    thickness: 1
  },
  collisionCell: {
    fill: 'rgba(0, 220, 255, 0.16)',
    outline: 'rgba(0, 220, 255, 0.72)',
    thickness: 1
  },
  collisionRect: {
    fill: 'rgba(255, 80, 80, 0.12)',
    outline: 'rgba(255, 80, 80, 0.95)',
    thickness: 1
  },
  physicsBody: {
    fill: 'rgba(180, 90, 255, 0.12)',
    outline: 'rgba(180, 90, 255, 0.95)',
    thickness: 1
  }
};

export function registerDebugRenderDevTools(game) {
  game.devTools.registry.registerSection({
    id: 'render',
    title: 'Render',
    order: 200,
    items: [
      {
        id: 'show-build-terrain-cells',
        kind: 'toggle',
        label: 'Show terrain cells',
        get: game => Boolean(game.devTools.flags.showBuildTerrainCells),
        set: (game, value) => { game.devTools.flags.showBuildTerrainCells = value; }
      },
      {
        id: 'show-collision-cells',
        kind: 'toggle',
        label: 'Show collision cells',
        get: game => Boolean(game.devTools.flags.showCollisionCells),
        set: (game, value) => { game.devTools.flags.showCollisionCells = value; }
      },
      {
        id: 'show-collision-rects',
        kind: 'toggle',
        label: 'Show collision rects',
        get: game => Boolean(game.devTools.flags.showCollisionRects),
        set: (game, value) => { game.devTools.flags.showCollisionRects = value; }
      },
      {
        id: 'show-physics-body-rects',
        kind: 'toggle',
        label: 'Show physics body rects',
        get: game => Boolean(game.devTools.flags.showPhysicsBodyRects),
        set: (game, value) => { game.devTools.flags.showPhysicsBodyRects = value; }
      }
    ]
  });
}

export function drawCollisionDebugOverlay(ctx, tilemap, flags = {}) {
  if (!tilemap) return;
  const showBuildCells = Boolean(flags.showBuildTerrainCells);
  const showCells = Boolean(flags.showCollisionCells);
  const showRects = Boolean(flags.showCollisionRects);
  if (!showBuildCells && !showCells && !showRects) return;

  if (showBuildCells) {
    drawPixelRect(ctx, tilemap.renderLayers?.containedTerrainTiles ?? [], DEBUG_RECT_STYLES.terrainCell);
  }

  if (showCells) {
    const cells = tilemap.collisionLayers?.terrainPrimitives ?? [];
    drawPixelRect(ctx, cells, DEBUG_RECT_STYLES.collisionCell);
  }

  if (showRects) {
    const rects = tilemap.collisionLayers?.terrainRects ?? [];
    drawPixelRect(ctx, rects, DEBUG_RECT_STYLES.collisionRect);
  }
}

function isDrawableRect(rect) {
  return rect && Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.w) && Number.isFinite(rect.h) && rect.w > 0 && rect.h > 0;
}

function physicsBodyDebugRects(game) {
  return [
    game?.player,
    ...(game?.enemies ?? []).filter(enemy => enemy.hp === undefined || enemy.hp > 0)
  ].filter(isDrawableRect);
}

export function drawPhysicsBodyDebugOverlay(ctx, game, flags = game?.devTools?.flags ?? {}) {
  if (!flags.showPhysicsBodyRects) return;
  const rects = physicsBodyDebugRects(game);
  if (!rects.length) return;

  drawPixelRect(ctx, rects, DEBUG_RECT_STYLES.physicsBody);
}
