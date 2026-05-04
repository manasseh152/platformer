import { hasDown, hasPressed } from './input.js';
import { getGoalRect, solidTileRectsOverlapping, spikeHazardRectsOverlapping } from './level.js';

export const rectsOverlap = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

export function collideWithLevel(entity, level, dt) {
  entity.wallDir = 0;
  entity.x += entity.vx * dt;
  for (const p of solidTileRectsOverlapping(level, entity)) if (rectsOverlap(entity, p)) {
    if (entity.vx > 0) { entity.x = p.x - entity.w; entity.wallDir = 1; }
    if (entity.vx < 0) { entity.x = p.x + p.w; entity.wallDir = -1; }
    entity.vx = 0;
  }
  entity.y += entity.vy * dt;
  entity.grounded = false;
  for (const p of solidTileRectsOverlapping(level, entity)) if (rectsOverlap(entity, p)) {
    if (entity.vy > 0) { entity.y = p.y - entity.h; entity.grounded = true; entity.coyote = .09; }
    if (entity.vy < 0) entity.y = p.y + p.h;
    entity.vy = 0;
  }
}

export function spawnBurst(game, x, y, color, n = 10) {
  for (let i=0;i<n;i++) game.particles.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.9)*180,life:.35+Math.random()*.25,color});
}

export function hurtPlayer(game, amount, knockDir) {
  const { player } = game;
  if (player.inv > 0 || player.dead) return;
  player.hp -= amount; player.inv = 1.1; game.camera.shake = .18;
  player.vx = knockDir * 260; player.vy = -210;
  spawnBurst(game, player.x+player.w/2, player.y+20, '#ffffff', 14);
  if (player.hp <= 0) player.dead = true;
}

export function updateEnemy(game, enemy, dt) {
  const { player, level } = game;
  enemy.hurt -= dt;
  enemy.vy = (enemy.vy || 0) + 1200 * dt;

  const moveVx = enemy.vx;
  let turnAround = false;
  enemy.x += moveVx * dt;

  for (const p of solidTileRectsOverlapping(level, enemy)) if (rectsOverlap(enemy, p)) {
    if (moveVx > 0) enemy.x = p.x - enemy.w;
    else if (moveVx < 0) enemy.x = p.x + p.w;
    turnAround = true;
  }

  if (enemy.x < enemy.min) {
    enemy.x = enemy.min;
    if (moveVx < 0) turnAround = true;
  }
  if (enemy.x + enemy.w > enemy.max) {
    enemy.x = enemy.max - enemy.w;
    if (moveVx > 0) turnAround = true;
  }
  if (turnAround && moveVx !== 0) enemy.vx = -moveVx;

  enemy.y += enemy.vy * dt;
  for (const p of solidTileRectsOverlapping(level, enemy)) if (rectsOverlap(enemy, p)) {
    if (enemy.vy > 0) enemy.y = p.y - enemy.h;
    if (enemy.vy < 0) enemy.y = p.y + p.h;
    enemy.vy = 0;
  }
  if (rectsOverlap(player, enemy)) hurtPlayer(game, 1, player.x < enemy.x ? -1 : 1);
}

export function updateGame(game, dt) {
  const { input, player, enemies, level } = game;
  if (hasPressed(input, 'restart')) game.resetGame();
  if (player.dead || game.flags.won) { input.pressed.clear(); return; }

  const left = hasDown(input, 'left');
  const right = hasDown(input, 'right');
  const jumpPressed = hasPressed(input, 'jump');
  const jumpHeld = hasDown(input, 'jump');
  const attackPressed = hasPressed(input, 'attack');
  const dashPressed = hasPressed(input, 'dash');

  if (dashPressed && player.dashCooldown <= 0) {
    player.dash = .14; player.dashCooldown = .55;
    player.vx = player.dir * 560; player.vy = 0; game.camera.shake = .08;
    spawnBurst(game, player.x + player.w/2, player.y + player.h/2, '#cfffff', 14);
  }

  if (player.dash <= 0) {
    const accel = player.grounded ? 2500 : 1500;
    const max = 245;
    if (left) { player.vx -= accel * dt; player.dir = -1; }
    if (right) { player.vx += accel * dt; player.dir = 1; }
    if (!left && !right) player.vx *= player.grounded ? Math.pow(.0007, dt) : Math.pow(.03, dt);
    player.vx = Math.max(-max, Math.min(max, player.vx));
  }

  if (jumpPressed) player.jumpBuf = .12;
  if (player.jumpBuf > 0 && player.wallSlide) {
    player.vx = -player.wallDir * 335; player.vy = -505; player.dir = -player.wallDir;
    player.jumpBuf = 0; player.wallSlide = false;
    spawnBurst(game, player.x + player.w/2, player.y + 28, '#7ad7ff', 12);
  } else if (player.jumpBuf > 0 && (player.grounded || player.coyote > 0)) {
    player.vy = -535; player.grounded = false; player.coyote = 0; player.jumpBuf = 0;
    spawnBurst(game, player.x + player.w/2, player.y + player.h, '#7ad7ff', 8);
  }
  if (!jumpHeld && player.vy < -120 && player.dash <= 0) player.vy *= .965;

  if (attackPressed && player.attack <= 0) {
    player.attack = .22; game.camera.shake = .05;
    const slash = {x: player.x + (player.dir > 0 ? 24 : -48), y: player.y + 8, w: 58, h: 34};
    for (const e of enemies) if (e.hp > 0 && rectsOverlap(slash, e)) {
      e.hp--; e.hurt = .22; e.vx = player.dir * 180; game.camera.shake = .12;
      spawnBurst(game, e.x+e.w/2, e.y+e.h/2, '#bfffff', 16);
    }
  }

  if (player.dash > 0) player.dash -= dt;
  else player.vy += 1450 * dt;
  player.coyote -= dt; player.jumpBuf -= dt; player.inv -= dt; player.attack -= dt; player.dashCooldown -= dt;
  collideWithLevel(player, level, dt);
  const pushingWall = (player.wallDir === -1 && left) || (player.wallDir === 1 && right);
  player.wallSlide = !player.grounded && player.wallDir !== 0 && pushingWall && player.vy >= 0 && player.dash <= 0;
  if (player.wallSlide) player.vy = Math.min(player.vy, 95);

  for (const s of spikeHazardRectsOverlapping(level, player)) if (rectsOverlap(player, s)) hurtPlayer(game, 1, player.x < s.x ? -1 : 1);

  for (const e of enemies) if (e.hp > 0) updateEnemy(game, e, dt);

  if (rectsOverlap(player, getGoalRect(level))) game.flags.won = true;

  for (let i=game.particles.length-1;i>=0;i--) {
    const p = game.particles[i]; p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 500*dt;
    if (p.life <= 0) game.particles.splice(i,1);
  }
  if (player.grounded && Math.abs(player.vx) > 90 && Math.random() < .35) game.dust.push({x:player.x+player.w/2,y:player.y+player.h,vx:-player.dir*30,life:.25});
  if (player.wallSlide && Math.random() < .45) game.dust.push({x:player.x+(player.wallDir>0?player.w:0),y:player.y+28,vx:-player.wallDir*45,life:.22});
  for (let i=game.dust.length-1;i>=0;i--) { game.dust[i].life -= dt; game.dust[i].x += game.dust[i].vx*dt; if (game.dust[i].life<=0) game.dust.splice(i,1); }
  input.pressed.clear();
}
