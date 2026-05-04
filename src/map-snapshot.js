import { assets } from './assets.js';
import { createEnemies, createPlayer, getGoalRect, getSpawnPoint, level as defaultLevel } from './level.js';
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
  ctx.save();
  ctx.translate(player.x, player.y);
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
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = '#4a183f';
  roundedRect(ctx, 0, 8, enemy.w, enemy.h - 4, 13);
  ctx.fillStyle = '#ff7bd5';
  ctx.fillRect(10, 20, 5, 5);
  ctx.fillRect(27, 20, 5, 5);
  ctx.restore();
}

export async function renderMapToCanvas(sourceLevel = defaultLevel) {
  await waitForMapAssets();

  const canvas = document.createElement('canvas');
  canvas.width = sourceLevel.worldWidth;
  canvas.height = sourceLevel.worldHeight;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#080b11';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawBackdropLayer(ctx, sourceLevel);
  drawDecorLayer(ctx, sourceLevel);
  drawTilemap(ctx, sourceLevel);
  drawGoal(ctx, getGoalRect(sourceLevel));
  drawSpikeLayer(ctx, sourceLevel);

  for (const enemy of createEnemies(sourceLevel)) drawSnapshotEnemy(ctx, enemy);
  drawSnapshotPlayer(ctx, createPlayer(getSpawnPoint(sourceLevel)));

  return canvas;
}

export async function renderMapToDataUrl(sourceLevel = defaultLevel) {
  return (await renderMapToCanvas(sourceLevel)).toDataURL('image/png');
}
