import { ACTOR_DRAW, TILE_SIZE } from '../../core/constants.js';
import { worldToNativePoint, worldToNativeRect } from '../../engine/render/viewport.js';

export function addWorldRect(builder, view, rect, packet) {
  builder.add({ ...packet, ...worldToNativeRect(view, rect) });
}

export function addWorldImage(builder, view, rect, assetId, packet = {}) {
  addWorldRect(builder, view, rect, { kind: 'image', assetId, ...packet });
}

export function addWorldEllipse(builder, view, ellipse, packet) {
  const p = worldToNativePoint(view, ellipse.x, ellipse.y);
  builder.add({
    kind: 'ellipse',
    ...packet,
    x: p.x,
    y: p.y,
    radiusX: ellipse.radiusX * view.worldToNativeX,
    radiusY: ellipse.radiusY * view.worldToNativeY
  });
}

function roundRect(builder, layer, x, y, w, h, radius, fill, order = 0) {
  builder.add({ kind: 'roundRect', layer, order, x, y, w, h, radius, fill });
}

function rect(builder, layer, x, y, w, h, fill, order = 0) {
  builder.add({ kind: 'rect', layer, order, x, y, w, h, fill });
}

function actorRect(actor, localX, localY, localW, localH) {
  const sx = actor.draw.w / actor.sourceW;
  const sy = actor.draw.h / actor.sourceH;
  const x1 = actor.originX + (actor.facing * (localX - actor.pivotX)) * sx;
  const x2 = actor.originX + (actor.facing * (localX + localW - actor.pivotX)) * sx;
  return { x: Math.min(x1, x2), y: actor.originY + localY * sy, w: Math.abs(x2 - x1), h: localH * sy, sx, sy };
}

function actorPoint(actor, localX, localY) {
  const sx = actor.draw.w / actor.sourceW;
  const sy = actor.draw.h / actor.sourceH;
  return { x: actor.originX + (actor.facing * (localX - actor.pivotX)) * sx, y: actor.originY + localY * sy };
}

function actorToNative(view, actor, localX, localY) {
  const p = actorPoint(actor, localX, localY);
  return worldToNativePoint(view, p.x, p.y);
}

function addActorRoundRect(builder, view, actor, layer, localX, localY, localW, localH, radius, fill) {
  const r = actorRect(actor, localX, localY, localW, localH);
  const n = worldToNativeRect(view, r);
  roundRect(builder, layer, n.x, n.y, n.w, n.h, radius * view.worldToNativeX, fill);
}

function addActorRect(builder, view, actor, layer, localX, localY, localW, localH, fill) {
  const r = actorRect(actor, localX, localY, localW, localH);
  const n = worldToNativeRect(view, r);
  rect(builder, layer, n.x, n.y, n.w, n.h, fill);
}

function addActorPath(builder, view, actor, layer, commands, packet) {
  builder.add({
    kind: 'path',
    layer,
    ...packet,
    commands: commands.map(command => {
      if (command.op === 'moveTo' || command.op === 'lineTo') return { ...command, ...actorToNative(view, actor, command.x, command.y) };
      if (command.op === 'quadraticCurveTo') {
        const cp = actorToNative(view, actor, command.cpx, command.cpy);
        const p = actorToNative(view, actor, command.x, command.y);
        return { op: 'quadraticCurveTo', cpx: cp.x, cpy: cp.y, x: p.x, y: p.y };
      }
      return command;
    })
  });
}

export function addPlayerPackets(builder, view, player, layer, runtimeNow = 0) {
  const flicker = player.inv > 0 && Math.floor(runtimeNow / 70) % 2 === 0;
  if (flicker) return;
  const draw = ACTOR_DRAW.PLAYER;
  const actor = {
    draw,
    sourceW: 34,
    sourceH: 50,
    pivotX: 17,
    originX: player.x + draw.offsetX + draw.w / 2,
    originY: player.y + player.h - draw.h + draw.offsetY,
    facing: player.dir || 1
  };
  addActorRoundRect(builder, view, actor, layer, 4, 18, 26, 31, 10, '#171729');
  addActorRoundRect(builder, view, actor, layer, 1, 0, 32, 27, 13, '#f4f1ff');
  addActorRoundRect(builder, view, actor, layer, 6, 6, 20, 16, 8, '#171729');
  addActorRect(builder, view, actor, layer, 11, 12, 4, 5, '#dffbff');
  addActorRect(builder, view, actor, layer, 21, 12, 4, 5, '#dffbff');
  addActorPath(builder, view, actor, layer, [{ op: 'moveTo', x: 8, y: 4 }, { op: 'quadraticCurveTo', cpx: 1, cpy: -12, x: 13, y: -2 }], { stroke: '#f4f1ff', lineWidth: 5 * view.worldToNativeX });
  addActorPath(builder, view, actor, layer, [{ op: 'moveTo', x: 25, y: 4 }, { op: 'quadraticCurveTo', cpx: 37, cpy: -12, x: 23, y: -2 }], { stroke: '#f4f1ff', lineWidth: 5 * view.worldToNativeX });
  addActorRect(builder, view, actor, layer, 7, 46, 7, 5, '#0d0d19');
  addActorRect(builder, view, actor, layer, 22, 46, 7, 5, '#0d0d19');
  if (player.attack > 0) {
    const center = actorToNative(view, actor, 49, 23);
    builder.add({ kind: 'ellipse', layer, x: center.x, y: center.y, radiusX: 34 * draw.w / 34 * view.worldToNativeX, radiusY: 12 * draw.h / 50 * view.worldToNativeY, rotation: -0.25, fill: '#cfffff', alpha: 0.86 });
    addActorPath(builder, view, actor, layer, [{ op: 'moveTo', x: 20, y: 25 }, { op: 'lineTo', x: 73, y: 13 }], { stroke: '#ffffff', lineWidth: 2 * view.worldToNativeX });
  }
}

export function addEnemyPackets(builder, view, enemy, layer) {
  if (enemy.hp <= 0) return;
  const draw = ACTOR_DRAW.SLIME;
  const actor = { draw, sourceW: draw.w, sourceH: draw.h, pivotX: 0, originX: enemy.x + draw.offsetX, originY: enemy.y + enemy.h - draw.h + draw.offsetY, facing: 1 };
  addActorRoundRect(builder, view, actor, layer, 0, 8, draw.w, draw.h - 4, 13, enemy.hurt > 0 ? '#ffffff' : '#4a183f');
  addActorRect(builder, view, actor, layer, 10, 20, 5, 5, '#ff7bd5');
  addActorRect(builder, view, actor, layer, 27, 20, 5, 5, '#ff7bd5');
  addActorPath(builder, view, actor, layer, [{ op: 'moveTo', x: 8, y: 12 }, { op: 'quadraticCurveTo', cpx: 2, cpy: 0, x: 17, y: 8 }], { stroke: '#8e497b', lineWidth: 3 * view.worldToNativeX });
  addActorPath(builder, view, actor, layer, [{ op: 'moveTo', x: 33, y: 12 }, { op: 'quadraticCurveTo', cpx: 42, cpy: 0, x: 25, y: 8 }], { stroke: '#8e497b', lineWidth: 3 * view.worldToNativeX });
}

export function addSpikeFallback(builder, view, rect, layer) {
  const a = worldToNativePoint(view, rect.x, rect.y + rect.h);
  const b = worldToNativePoint(view, rect.x + rect.w / 2, rect.y + rect.h / 3);
  const c = worldToNativePoint(view, rect.x + rect.w, rect.y + rect.h);
  builder.add({ kind: 'path', layer, fill: '#6c7472', commands: [{ op: 'moveTo', ...a }, { op: 'lineTo', ...b }, { op: 'lineTo', ...c }, { op: 'closePath' }] });
}

export function tileRect(col, row, tileSize = TILE_SIZE) {
  return { x: col * tileSize, y: row * tileSize, w: tileSize, h: tileSize };
}
