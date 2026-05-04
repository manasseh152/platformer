import { controlsText } from './input.js';

function roundedRect(ctx, x,y,w,h,r) {
  ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill();
}

export function syncHtmlHud(game) {
  const { ui, player } = game;
  [...ui.heartsEl.children].forEach((heart, i) => heart.classList.toggle('full', i < player.hp));
  ui.dashStatusEl.classList.toggle('ready', player.dashCooldown <= 0);
  ui.messageEl.hidden = !(player.dead || game.flags.won);
  ui.messageTitleEl.textContent = game.flags.won ? 'Gate Reached!' : 'You Faded';
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
  const W = view.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
  ctx.fillStyle = '#090912';
  ctx.fillRect(-view.offsetX / view.scale, -view.offsetY / view.scale, canvas.width / view.scale, canvas.height / view.scale);
  ctx.save();
  const sx = (Math.random()-.5)*game.camera.shake*24, sy = (Math.random()-.5)*game.camera.shake*24;
  ctx.translate(-game.camera.x + sx, sy);

  for (let i=0;i<9;i++) {
    ctx.fillStyle = `rgba(58,60,104,${0.06 + i*.008})`;
    ctx.beginPath();
    ctx.ellipse(120+i*150, 240 + Math.sin(i)*45, 120, 210, 0, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(130,230,255,.08)';
  for (let i=0;i<24;i++) { ctx.beginPath(); ctx.arc((i*97)%1250, 80+(i*53)%360, 2+(i%3), 0, Math.PI*2); ctx.fill(); }

  for (const p of level.platforms) {
    const grad = ctx.createLinearGradient(0,p.y,0,p.y+p.h);
    grad.addColorStop(0,'#34385a'); grad.addColorStop(1,'#17182a');
    ctx.fillStyle = grad; roundedRect(ctx, p.x,p.y,p.w,p.h,8);
    ctx.fillStyle = '#7ad7ff22'; ctx.fillRect(p.x, p.y, p.w, 4);
  }
  for (const s of level.spikes) {
    ctx.fillStyle = '#c7d7e9';
    for (let x=s.x; x<s.x+s.w; x+=20) { ctx.beginPath(); ctx.moveTo(x,s.y+s.h); ctx.lineTo(x+10,s.y); ctx.lineTo(x+20,s.y+s.h); ctx.fill(); }
  }

  ctx.fillStyle = '#101223'; roundedRect(ctx, 1190, 490, 50, 160, 18);
  ctx.strokeStyle = '#9ef7ff'; ctx.lineWidth = 3; ctx.strokeRect(1202, 508, 26, 132);

  for (const d of game.dust) { ctx.globalAlpha = Math.max(0,d.life*3); ctx.fillStyle = '#bfffff'; ctx.beginPath(); ctx.arc(d.x,d.y,5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; }
  for (const e of game.enemies) drawEnemy(game, e);
  drawPlayer(game);
  for (const p of game.particles) { ctx.globalAlpha = Math.max(0,p.life*2); ctx.fillStyle = p.color; ctx.fillRect(p.x,p.y,4,4); ctx.globalAlpha = 1; }

  ctx.restore();

  syncHtmlHud(game);
  ui.controlsEl.textContent = controlsText(game.input);

  if (game.player.dead || game.flags.won) {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0, 0, W, H);
  }
}
