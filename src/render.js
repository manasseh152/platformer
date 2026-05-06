import { assets, isLoaded } from './assets.js';
import { DEBUG_CAMERA, TILE_SIZE } from './core/constants.js';
import { controlsText } from './input.js';
import { forEachLayerTile, getDecorType, getTile, isSolidTile } from './core/tilemaps/tilemap.js';
import { drawCollisionDebugOverlay, drawPhysicsBodyDebugOverlay } from './devtools/debug-render.js';
import { isWon } from './app/app-state.js';
import { findObjectsWithComponent, getComponent } from './engine/scene/queries.js';

function roundedRect(ctx, x,y,w,h,r) {
  ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill();
}

function drawAsset(ctx, asset, x, y, w = TILE_SIZE, h = TILE_SIZE) {
  if (!isLoaded(asset)) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(asset, x, y, w, h);
  return true;
}

function getPixelPlatformerTerrainAsset(level, key) {
  const [, themeName = 'grass'] = (level.theme || 'kenney-pixel-platformer:grass').split(':');
  return assets.pixelPlatformer?.[themeName]?.terrain?.[key] || null;
}

function tileNoise(col, row, salt = 0) {
  const n = Math.sin((col * 127.1 + row * 311.7 + salt * 74.7)) * 43758.5453;
  return n - Math.floor(n);
}

function drawStoneTile(ctx, level, ch, col, row, asset) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  if (!drawAsset(ctx, asset, x, y)) {
    const grad = ctx.createLinearGradient(0, y, 0, y + TILE_SIZE);
    grad.addColorStop(0, '#b8cdd0'); grad.addColorStop(1, '#8fa7a9');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  }

  if (ch === '#') {
    ctx.fillStyle = 'rgba(0, 0, 0, .36)';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  }

  const shade = tileNoise(col, row) > .55 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.08)';
  ctx.fillStyle = shade;
  ctx.fillRect(x + 4, y + 5, TILE_SIZE - 8, TILE_SIZE - 10);

  const above = isSolidTile(getTile(level, 'terrain', col, row - 1));
  const below = isSolidTile(getTile(level, 'terrain', col, row + 1));
  const left = isSolidTile(getTile(level, 'terrain', col - 1, row));
  const right = isSolidTile(getTile(level, 'terrain', col + 1, row));

  if (ch === '=' || (!above && ch !== '#' && row > 0)) {
    ctx.fillStyle = 'rgba(255, 245, 198, .30)';
    ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, 6);
  }
  if (!below) {
    ctx.fillStyle = 'rgba(0, 0, 0, .28)';
    ctx.fillRect(x + 6, y + TILE_SIZE - 10, TILE_SIZE - 12, 7);
  }
  if (!left) {
    ctx.fillStyle = 'rgba(0, 0, 0, .18)';
    ctx.fillRect(x, y + 6, 6, TILE_SIZE - 12);
  }
  if (!right) {
    ctx.fillStyle = 'rgba(255, 255, 255, .08)';
    ctx.fillRect(x + TILE_SIZE - 6, y + 6, 4, TILE_SIZE - 12);
  }

  if (ch === 'B') {
    ctx.strokeStyle = 'rgba(36, 45, 45, .55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  }

  if (tileNoise(col, row, 1) > .72) {
    ctx.strokeStyle = 'rgba(49, 67, 66, .36)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 18);
    ctx.lineTo(x + 30 + tileNoise(col, row, 2) * 18, y + 24);
    ctx.lineTo(x + 26, y + 38);
    ctx.stroke();
  }
}

export function drawTilemap(ctx, level) {
  const terrainPrimitives = level.renderLayers?.terrainPrimitives;
  if (terrainPrimitives?.length) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, level.worldWidth, level.worldHeight);
    ctx.clip();
    for (const primitive of terrainPrimitives) {
      const asset = getPixelPlatformerTerrainAsset(level, primitive.assetKey);
      if (!drawAsset(ctx, asset, primitive.x, primitive.y, primitive.w, primitive.h)) {
        ctx.fillStyle = primitive.assetKey.includes('top') ? '#5cba47' : '#9b683f';
        ctx.fillRect(primitive.x, primitive.y, primitive.w, primitive.h);
      }
    }
    ctx.restore();
    return;
  }

  const terrainVisuals = level.renderLayers?.terrainVisuals;
  if (terrainVisuals?.length) {
    for (const visual of terrainVisuals) {
      const asset = getPixelPlatformerTerrainAsset(level, visual.assetKey);
      if (!drawAsset(ctx, asset, visual.x, visual.y, visual.w, visual.h)) {
        ctx.fillStyle = visual.assetKey.includes('top') ? '#5cba47' : '#9b683f';
        ctx.fillRect(visual.x, visual.y, visual.w, visual.h);
      }
    }
    return;
  }

  forEachLayerTile(level, 'terrain', (ch, col, row) => {
    if (ch !== '#' && ch !== '=' && ch !== 'B') return;
    const asset = ch === '=' ? assets.stoneTop : ch === 'B' ? assets.stoneBlock : assets.stoneFill;
    drawStoneTile(ctx, level, ch, col, row, asset);
  });
}

function drawBackdropGlyph(ctx, ch, x, y, col, row) {
  ctx.save();
  if (ch === 'd') {
    ctx.fillStyle = 'rgba(3, 8, 11, .28)';
    ctx.fillRect(x + 6, y + 8, TILE_SIZE - 12, TILE_SIZE - 16);
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    ctx.fillRect(x + 16, y + 18, 12, 10);
  } else if (ch === 'a') {
    ctx.fillStyle = 'rgba(0, 0, 0, .24)';
    ctx.beginPath();
    ctx.roundRect(x + 8, y + 18, TILE_SIZE - 16, TILE_SIZE + 26, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(151, 178, 174, .12)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 22, TILE_SIZE - 24, TILE_SIZE + 16, 24);
    ctx.stroke();
  } else if (ch === 'k') {
    ctx.strokeStyle = 'rgba(14, 22, 24, .44)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 22, y + 14);
    ctx.lineTo(x + 34, y + 29);
    ctx.lineTo(x + 28, y + 44);
    ctx.lineTo(x + 42, y + 58);
    ctx.moveTo(x + 34, y + 29);
    ctx.lineTo(x + 48, y + 24);
    ctx.stroke();
  } else if (ch === 'c') {
    ctx.strokeStyle = 'rgba(121, 105, 77, .42)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const cy = y + i * 17 + 3;
      ctx.ellipse(x + TILE_SIZE / 2, cy, 7, 10, i % 2 ? Math.PI / 2 : 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (tileNoise(col, row, 7) > .5) {
    ctx.fillStyle = 'rgba(185, 213, 207, .045)';
    ctx.fillRect(x + 48, y + 14, 8, 8);
  }
  ctx.restore();
}

export function drawBackdropLayer(ctx, level) {
  forEachLayerTile(level, 'backdrop', (ch, col, row) => {
    if (ch === '.') return;
    drawBackdropGlyph(ctx, ch, col * TILE_SIZE, row * TILE_SIZE, col, row);
  });
}

export function drawDecorLayer(ctx, level) {
  forEachLayerTile(level, 'decor', (ch, col, row) => {
    const type = getDecorType(ch);
    if (type) drawAsset(ctx, assets[type], col * TILE_SIZE, row * TILE_SIZE);
  });
}

export function drawSpikeLayer(ctx, level) {
  for (const object of findObjectsWithComponent(level, 'collision:hazard')) {
    const hazard = getComponent(object, 'collision:hazard');
    if (hazard?.kind !== 'spike') continue;
    const { x, y, w = level.tileSize, h = level.tileSize } = object.transform;
    if (!drawFloorSpike(ctx, assets.spikes, x, y, w, h)) {
      ctx.fillStyle = '#6c7472';
      ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w / 2, y + h / 3); ctx.lineTo(x + w, y + h); ctx.fill();
    }
  }
}

function spawnedObjectHasComponent(object, type) {
  return getComponent(object, 'spawner')?.object?.components?.some(component => component.type === type);
}

function renderGoalObjects(level) {
  return [
    ...findObjectsWithComponent(level, 'render:goal'),
    ...findObjectsWithComponent(level, 'spawner').filter(object => spawnedObjectHasComponent(object, 'render:goal'))
  ].filter((object, index, objects) => objects.indexOf(object) === index);
}

function getRenderGoalRects(level) {
  const goals = renderGoalObjects(level);
  if (!goals.length) return [];
  const minCol = Math.min(...goals.map(o => o.transform.col));
  const maxCol = Math.max(...goals.map(o => o.transform.col));
  const minRow = Math.min(...goals.map(o => o.transform.row));
  const maxRow = Math.max(...goals.map(o => o.transform.row));
  return [{ x: minCol * level.tileSize, y: minRow * level.tileSize, w: (maxCol - minCol + 1) * level.tileSize, h: (maxRow - minRow + 1) * level.tileSize, col: minCol, row: minRow, cols: maxCol - minCol + 1, rows: maxRow - minRow + 1, tileSize: level.tileSize }];
}

function drawGoals(ctx, level) {
  for (const goal of getRenderGoalRects(level)) drawGoal(ctx, goal);
}

export function drawGoal(ctx, goal) {
  const x = goal.x;
  const y = goal.y;
  ctx.save();
  ctx.shadowColor = 'rgba(227,185,79,.62)';
  ctx.shadowBlur = 18;

  const tileSize = goal.tileSize ?? TILE_SIZE;
  if (goal.cols >= 3) {
    const leftLoaded = drawAsset(ctx, assets.gateLeft, x, y, tileSize, tileSize);
    const centerLoaded = drawAsset(ctx, assets.gateCenter, x + tileSize, y, tileSize, tileSize);
    const rightLoaded = drawAsset(ctx, assets.gateRight, x + tileSize * 2, y, tileSize, tileSize);
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

function drawFloorSpike(ctx, asset, x, y, w = TILE_SIZE, h = TILE_SIZE) {
  if (!isLoaded(asset)) return false;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(Math.PI);
  ctx.drawImage(asset, -w / 2, -h / 2, w, h);
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
  if (ui.hudLevelName) ui.hudLevelName.textContent = game.tilemap?.name || 'Unknown Level';
  [...ui.heartsEl.children].forEach((heart, i) => heart.classList.toggle('full', i < player.hp));
  ui.dashStatusEl.classList.toggle('ready', player.dashCooldown <= 0);
  const won = isWon(game);
  const showingEndMessage = player.dead || won;
  ui.messageEl.hidden = !showingEndMessage;
  ui.messageTitleEl.textContent = won ? 'Gate Reached!' : 'You Faded';
  if (ui.messageNextLevelButton) {
    const nextLevel = won ? game.tilemaps.getNextTilemap() : null;
    ui.messageNextLevelButton.hidden = !nextLevel;
    ui.messageNextLevelButton.textContent = nextLevel ? `Play ${nextLevel.name}` : 'Play Next';
  }
  if (showingEndMessage && !game.endMessageWasVisible) {
    game.endMessageWasVisible = true;
    requestAnimationFrame(() => {
      const firstAction = ui.messageEl.querySelector('button:not([hidden]):not(:disabled)');
      firstAction?.focus?.({ preventScroll: true });
      firstAction?.classList.add('controller-focus');
    });
  } else if (!showingEndMessage) {
    game.endMessageWasVisible = false;
  }
  document.body.classList.toggle('game-over', player.dead);
  document.body.classList.toggle('game-won', won);
}

function snapRenderX(game, x) {
  const snap = game.renderSnap;
  return snap ? snap.cameraX + Math.round((x - snap.cameraX) * snap.scaleX) / snap.scaleX : x;
}

function snapRenderY(game, y) {
  const snap = game.renderSnap;
  return snap ? snap.cameraY + Math.round((y - snap.cameraY) * snap.scaleY) / snap.scaleY : y;
}

function drawPlayer(runtime, game) {
  const { ctx, player } = game;
  const flicker = player.inv > 0 && Math.floor(runtime.now()/70)%2 === 0;
  if (flicker) return;
  const x = snapRenderX(game, player.x), y = snapRenderY(game, player.y), d = player.dir;
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
  ctx.translate(snapRenderX(game, e.x), snapRenderY(game, e.y));
  ctx.fillStyle = e.hurt > 0 ? '#ffffff' : '#4a183f'; roundedRect(ctx, 0, 8, e.w, e.h-4, 13);
  ctx.fillStyle = '#ff7bd5'; ctx.fillRect(10, 20, 5, 5); ctx.fillRect(27, 20, 5, 5);
  ctx.strokeStyle = '#8e497b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(8, 12); ctx.quadraticCurveTo(2, 0, 17, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(33, 12); ctx.quadraticCurveTo(42, 0, 25, 8); ctx.stroke();
  ctx.restore();
}

export function drawGame(runtime, game) {
  if (!game) {
    game = runtime;
    runtime = { now: () => performance.now(), random: Math.random };
  }
  const { ctx, renderCanvas, view, ui } = game;
  const level = game.tilemap;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
  ctx.fillStyle = '#080b11';
  ctx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
  ctx.setTransform(renderCanvas.width / view.width, 0, 0, renderCanvas.height / view.height, 0, 0);

  const sx = Math.round((runtime.random()-.5)*game.camera.shake*24);
  const sy = Math.round((runtime.random()-.5)*game.camera.shake*24);
  const cameraScaleX = renderCanvas.width / view.width;
  const cameraScaleY = renderCanvas.height / view.height;
  const desiredCameraX = game.camera.x - sx;
  const desiredCameraY = game.camera.y - sy;
  const cameraX = Math.round(desiredCameraX * cameraScaleX) / cameraScaleX;
  const cameraY = Math.round(desiredCameraY * cameraScaleY) / cameraScaleY;
  const subpixelOffsetX = (cameraX - desiredCameraX) * cameraScaleX;
  const subpixelOffsetY = (cameraY - desiredCameraY) * cameraScaleY;
  game.renderSnap = { cameraX, cameraY, scaleX: cameraScaleX, scaleY: cameraScaleY };

  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  drawBackdropLayer(ctx, level);

  drawDecorLayer(ctx, level);

  drawTilemap(ctx, level);

  drawGoals(ctx, level);

  drawSpikeLayer(ctx, level);

  for (const d of game.dust) { ctx.globalAlpha = Math.max(0,d.life*3); ctx.fillStyle = '#bfffff'; ctx.beginPath(); ctx.arc(snapRenderX(game,d.x),snapRenderY(game,d.y),5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; }
  for (const e of game.enemies) drawEnemy(game, e);
  drawPlayer(runtime, game);
  for (const p of game.particles) { ctx.globalAlpha = Math.max(0,p.life*2); ctx.fillStyle = p.color; ctx.fillRect(snapRenderX(game,p.x),snapRenderY(game,p.y),4,4); ctx.globalAlpha = 1; }

  drawCollisionDebugOverlay(ctx, level, game.devTools?.flags);
  drawPhysicsBodyDebugOverlay(ctx, game, game.devTools?.flags);

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

  game.renderSnap = null;
  syncHtmlHud(game);
  ui.controlsEl.textContent = controlsText(game.input);
  game.presenter.present(subpixelOffsetX, subpixelOffsetY);
}
