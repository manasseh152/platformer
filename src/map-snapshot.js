import { assets } from './assets.js';
import { getDefaultTilemap } from './content/tilemaps/registry.js';
import { ACTOR_DRAW } from './core/constants.js';
import { createEnemies, createPlayer, getGoalRect, getSpawnPoint } from './core/tilemaps/tilemap.js';
import { drawBackdropLayer, drawDecorLayer, drawGoal, drawSpikeLayer, drawTilemap } from './render.js';

function waitForAsset(asset) {
  if (!asset || typeof asset.addEventListener !== 'function' || asset.complete) return Promise.resolve();
  return new Promise(resolve => {
    asset.addEventListener('load', resolve, { once: true });
    asset.addEventListener('error', resolve, { once: true });
  });
}

export async function waitForMapAssets() {
  await Promise.all(Object.values(assets).map(waitForAsset));
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawSnapshotPlayer(ctx, player) {
  const draw = ACTOR_DRAW.PLAYER;
  ctx.save();
  ctx.translate(player.x + draw.offsetX, player.y + player.h - draw.h + draw.offsetY);
  ctx.scale(draw.w / 34, draw.h / 50);
  ctx.fillStyle = '#171729';
  roundedRect(ctx, 4, 18, 26, 31, 10);
  ctx.fillStyle = '#f4f1ff';
  roundedRect(ctx, 1, 0, 32, 27, 13);
  ctx.fillStyle = '#171729';
  roundedRect(ctx, 6, 6, 20, 16, 8);
  ctx.fillStyle = '#dffbff';
  ctx.fillRect(11, 12, 4, 5);
  ctx.fillRect(21, 12, 4, 5);
  ctx.restore();
}

function drawSnapshotEnemy(ctx, enemy) {
  const draw = ACTOR_DRAW.SLIME;
  ctx.save();
  ctx.translate(enemy.x + draw.offsetX, enemy.y + enemy.h - draw.h + draw.offsetY);
  ctx.fillStyle = '#4a183f';
  roundedRect(ctx, 0, 8, draw.w, draw.h - 4, 13);
  ctx.fillStyle = '#ff7bd5';
  ctx.fillRect(10, 20, 5, 5);
  ctx.fillRect(27, 20, 5, 5);
  ctx.restore();
}

export async function renderMapToCanvas(sourceTilemap = getDefaultTilemap()) {
  await waitForMapAssets();

  const canvas = document.createElement('canvas');
  canvas.width = sourceTilemap.worldWidth;
  canvas.height = sourceTilemap.worldHeight;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#080b11';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawBackdropLayer(ctx, sourceTilemap);
  drawDecorLayer(ctx, sourceTilemap);
  drawTilemap(ctx, sourceTilemap);
  drawGoal(ctx, getGoalRect(sourceTilemap));
  drawSpikeLayer(ctx, sourceTilemap);

  for (const enemy of createEnemies(sourceTilemap)) drawSnapshotEnemy(ctx, enemy);
  drawSnapshotPlayer(ctx, createPlayer(getSpawnPoint(sourceTilemap)));

  return canvas;
}

export async function renderMapToDataUrl(sourceTilemap = getDefaultTilemap()) {
  return (await renderMapToCanvas(sourceTilemap)).toDataURL('image/png');
}
