import { assets, isLoaded } from './assets.js';
import { DEBUG_CAMERA, TILE_SIZE } from './constants.js';
import { controlsText } from './input.js';
import { forEachLayerTile, getDecorType, getGoalRect } from './level.js';

function roundedRect(ctx, x,y,w,h,r) {
  ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill();
}

function drawAsset(ctx, asset, x, y, w = TILE_SIZE, h = TILE_SIZE) {
  if (!isLoaded(asset)) return false;
  ctx.drawImage(asset, x, y, w, h);
  return true;
}

function drawStoneTile(ctx, x, y, asset) {
  if (!drawAsset(ctx, asset, x, y)) {
    const grad = ctx.createLinearGradient(0, y, 0, y + TILE_SIZE);
    grad.addColorStop(0, '#b8cdd0'); grad.addColorStop(1, '#8fa7a9');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  }
}

export function drawTilemap(ctx, level) {
  forEachLayerTile(level, 'terrain', (ch, col, row) => {
    if (ch !== '#' && ch !== '=' && ch !== 'B') return;
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    const asset = ch === '=' ? assets.stoneTop : ch === 'B' ? assets.stoneBlock : assets.stoneFill;
    drawStoneTile(ctx, x, y, asset);
  });
}

export function drawDecorLayer(ctx, level) {
  forEachLayerTile(level, 'decor', (ch, col, row) => {
    const type = getDecorType(ch);
    if (type) drawAsset(ctx, assets[type], col * TILE_SIZE, row * TILE_SIZE);
  });
}

export function drawSpikeLayer(ctx, level) {
  forEachLayerTile(level, 'terrain', (ch, col, row) => {
    if (ch !== '^') return;
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    if (!drawFloorSpike(ctx, assets.spikes, x, y)) {
      ctx.fillStyle = '#6c7472';
      ctx.beginPath(); ctx.moveTo(x, y + TILE_SIZE); ctx.lineTo(x + TILE_SIZE/2, y + 24); ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE); ctx.fill();
    }
  });
}

export function drawGoal(ctx, goal) {
  const x = goal.x;
  const y = goal.y;
  ctx.save();
  ctx.shadowColor = 'rgba(227,185,79,.62)';
  ctx.shadowBlur = 18;

  if (goal.cols >= 3) {
    const leftLoaded = drawAsset(ctx, assets.gateLeft, x, y);
    const centerLoaded = drawAsset(ctx, assets.gateCenter, x + TILE_SIZE, y);
    const rightLoaded = drawAsset(ctx, assets.gateRight, x + TILE_SIZE * 2, y);
    if (leftLoaded && centerLoaded && rightLoaded) {
      ctx.restore();
      return;
    }
  } else if (drawAsset(ctx, assets.gate, x, y, goal.w, goal.h)) {
    ctx.restore();
    return;
  }

  ctx.fillStyle = '#2d3838'; roundedRect(ctx, x, y, goal.w, goal.h, 18);
  ctx.strokeStyle = '#d7b15a'; ctx.lineWidth = 3; ctx.strokeRect(x + 12, y + 14, goal.w - 24, goal.h - 28);
  ctx.restore();
}

function drawFloorSpike(ctx, asset, x, y) {
  if (!isLoaded(asset)) return false;
  ctx.save();
  ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
  ctx.rotate(Math.PI);
  ctx.drawImage(asset, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
  ctx.restore();
  return true;
}

function drawCanvasBackdrop(ctx, canvas) {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#080b11');
  grad.addColorStop(.62, '#0d151c');
  grad.addColorStop(1, '#101e22');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tile = 96;
  ctx.fillStyle = 'rgba(185, 213, 207, .045)';
  ctx.strokeStyle = 'rgba(0, 0, 0, .22)';
  ctx.lineWidth = 4;
  for (let y = -tile; y < canvas.height + tile; y += tile) {
    for (let x = -tile; x < canvas.width + tile; x += tile) {
      const stagger = ((y / tile) & 1) * tile / 2;
      ctx.fillRect(x + stagger, y, tile - 4, tile - 4);
      ctx.strokeRect(x + stagger, y, tile - 4, tile - 4);
    }
  }
}

export function drawDungeonBackdrop(ctx, view, camera) {
  const grad = ctx.createLinearGradient(0, 0, 0, view.height);
  grad.addColorStop(0, '#080c13');
  grad.addColorStop(.48, '#101a22');
  grad.addColorStop(1, '#18272a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, view.width, view.height);

  const tile = 56;
  const parallaxX = Math.round(camera.x * .22) % tile;
  const parallaxY = Math.round(camera.y * .14) % tile;
  ctx.save();
  ctx.translate(-parallaxX - tile, -parallaxY - tile);
  for (let y = 0; y < view.height + tile * 2; y += tile) {
    for (let x = 0; x < view.width + tile * 2; x += tile) {
      const stagger = ((y / tile) & 1) * tile / 2;
      const bx = x + stagger;
      ctx.fillStyle = ((x / tile + y / tile) & 1) ? 'rgba(126, 159, 158, .105)' : 'rgba(187, 211, 205, .075)';
      ctx.fillRect(bx, y, tile - 2, tile - 2);
      ctx.fillStyle = 'rgba(255,255,255,.035)';
      ctx.fillRect(bx + 10, y + 12, 8, 8);
      ctx.fillStyle = 'rgba(0,0,0,.13)';
      ctx.fillRect(bx + 26, y + 30, 14, 12);
    }
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(4, 8, 12, .34)';
  for (let i = -1; i < 6; i++) {
    const x = i * 170 - (camera.x * .08 % 170);
    ctx.beginPath();
    ctx.roundRect(x + 20, 86, 80, view.height, 40);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(124,169,166,.18)';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(80 + i * 210 - (camera.x * .16 % 210), view.height - 64 + Math.sin(i) * 12, 150, 62, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const vignette = ctx.createRadialGradient(view.width * .54, view.height * .45, 40, view.width * .54, view.height * .45, view.width * .78);
  vignette.addColorStop(0, 'rgba(255, 245, 205, .10)');
  vignette.addColorStop(.55, 'rgba(255, 245, 205, .025)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, .38)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, view.width, view.height);
}

export function syncHtmlHud(game) {
  const { ui, player } = game;
  [...ui.heartsEl.children].forEach((heart, i) => heart.classList.toggle('full', i < player.hp));
  ui.dashStatusEl.classList.toggle('ready', player.dashCooldown <= 0);
  ui.messageEl.hidden = !(player.dead || game.flags.won);
  ui.messageTitleEl.textContent = game.flags.won ? 'Gate Reached!' : 'You Faded';
  document.body.classList.toggle('game-over', player.dead);
  document.body.classList.toggle('game-won', game.flags.won);
}

function drawPlayer(game) {
  const { ctx, player } = game;
  const flicker = player.inv > 0 && Math.floor(performance.now()/70)%2 === 0;
  if (flicker) return;
  const x = player.x, y = player.y, d = player.dir;
  ctx.save();
  ctx.translate(x + player.w/2, y + player.h/2);
  ctx.scale(d, 1);
  ctx.translate(-player.w/2, -player.h/2);

  ctx.fillStyle = '#171729'; roundedRect(ctx, 4, 18, 26, 31, 10);
  ctx.fillStyle = '#f4f1ff'; roundedRect(ctx, 1, 0, 32, 27, 13);
  ctx.fillStyle = '#171729'; roundedRect(ctx, 6, 6, 20, 16, 8);
  ctx.fillStyle = '#dffbff'; ctx.fillRect(11, 12, 4, 5); ctx.fillRect(21, 12, 4, 5);
  ctx.strokeStyle = '#f4f1ff'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(8, 4); ctx.quadraticCurveTo(1, -12, 13, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(25, 4); ctx.quadraticCurveTo(37, -12, 23, -2); ctx.stroke();
  ctx.fillStyle = '#0d0d19'; ctx.fillRect(7, 46, 7, 5); ctx.fillRect(22, 46, 7, 5);

  if (player.attack > 0) {
    ctx.globalAlpha = .86;
    ctx.fillStyle = '#cfffff';
    ctx.beginPath();
    ctx.ellipse(49, 23, 34, 12, -.25, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, 25); ctx.lineTo(73, 13); ctx.stroke();
  }
  ctx.restore();
}

function drawEnemy(game, e) {
  if (e.hp <= 0) return;
  const { ctx } = game;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = e.hurt > 0 ? '#ffffff' : '#4a183f'; roundedRect(ctx, 0, 8, e.w, e.h-4, 13);
  ctx.fillStyle = '#ff7bd5'; ctx.fillRect(10, 20, 5, 5); ctx.fillRect(27, 20, 5, 5);
  ctx.strokeStyle = '#8e497b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(8, 12); ctx.quadraticCurveTo(2, 0, 17, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(33, 12); ctx.quadraticCurveTo(42, 0, 25, 8); ctx.stroke();
  ctx.restore();
}

export function drawGame(game) {
  const { ctx, canvas, view, level, ui } = game;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCanvasBackdrop(ctx, canvas);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);

  const sx = Math.round((Math.random()-.5)*game.camera.shake*24);
  const sy = Math.round((Math.random()-.5)*game.camera.shake*24);
  const cameraX = Math.round(game.camera.x);
  const cameraY = Math.round(game.camera.y);
  drawDungeonBackdrop(ctx, view, { x: cameraX - sx, y: cameraY - sy });

  ctx.save();
  ctx.translate(-cameraX + sx, -cameraY + sy);

  drawDecorLayer(ctx, level);

  drawTilemap(ctx, level);

  drawGoal(ctx, getGoalRect(level));

  drawSpikeLayer(ctx, level);

  for (const d of game.dust) { ctx.globalAlpha = Math.max(0,d.life*3); ctx.fillStyle = '#bfffff'; ctx.beginPath(); ctx.arc(d.x,d.y,5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; }
  for (const e of game.enemies) drawEnemy(game, e);
  drawPlayer(game);
  for (const p of game.particles) { ctx.globalAlpha = Math.max(0,p.life*2); ctx.fillStyle = p.color; ctx.fillRect(p.x,p.y,4,4); ctx.globalAlpha = 1; }

  if (DEBUG_CAMERA) {
    ctx.strokeStyle = 'rgba(255,255,0,.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      cameraX + game.camera.deadzone.left,
      cameraY + game.camera.deadzone.top,
      game.camera.deadzone.right - game.camera.deadzone.left,
      game.camera.deadzone.bottom - game.camera.deadzone.top
    );
    ctx.strokeStyle = 'rgba(255,80,80,.9)';
    ctx.strokeRect(cameraX, cameraY, view.width, view.height);
  }

  ctx.restore();

  syncHtmlHud(game);
  ui.controlsEl.textContent = controlsText(game.input);
}
