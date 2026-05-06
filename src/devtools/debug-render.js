export function registerDebugRenderDevTools(game) {
  game.devTools.registry.registerSection({
    id: 'render',
    title: 'Render',
    order: 200,
    items: [
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
      },
      {
        id: 'use-raw-terrain-debug-render',
        kind: 'toggle',
        label: 'Use raw terrain debug render',
        get: game => Boolean(game.devTools.flags.useRawTerrainDebugRender),
        set: (game, value) => { game.devTools.flags.useRawTerrainDebugRender = value; }
      }
    ]
  });
}

export function drawCollisionDebugOverlay(ctx, tilemap, flags = {}) {
  if (!tilemap?.renderLayers) return;
  const showCells = Boolean(flags.showCollisionCells);
  const showRects = Boolean(flags.showCollisionRects);
  if (!showCells && !showRects) return;

  ctx.save();

  if (showCells) {
    ctx.fillStyle = 'rgba(0, 220, 255, 0.16)';
    ctx.strokeStyle = 'rgba(0, 220, 255, 0.72)';
    ctx.lineWidth = 1;
    for (const cell of tilemap.renderLayers.terrainCollisionCells ?? []) {
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, Math.max(0, cell.w - 1), Math.max(0, cell.h - 1));
    }
  }

  if (showRects) {
    ctx.fillStyle = 'rgba(255, 80, 80, 0.12)';
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.95)';
    ctx.lineWidth = 2;
    for (const rect of tilemap.renderLayers.terrainCollisionRects ?? []) {
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeRect(rect.x + 1, rect.y + 1, Math.max(0, rect.w - 2), Math.max(0, rect.h - 2));
    }
  }

  ctx.restore();
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

  ctx.save();
  ctx.fillStyle = 'rgba(180, 90, 255, 0.12)';
  ctx.strokeStyle = 'rgba(180, 90, 255, 0.95)';
  ctx.lineWidth = 2;
  for (const rect of rects) {
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeRect(rect.x + 1, rect.y + 1, Math.max(0, rect.w - 2), Math.max(0, rect.h - 2));
  }
  ctx.restore();
}
