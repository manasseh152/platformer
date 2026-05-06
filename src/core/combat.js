import { ATTACK_HITBOX } from './constants.js';

export function getSlashHitbox(player) {
  const slash = ATTACK_HITBOX.SLASH;
  const x = player.dir >= 0
    ? player.x + slash.offsetX
    : player.x + player.w - slash.offsetX - slash.w;
  return {
    x,
    y: player.y + slash.offsetY,
    w: slash.w,
    h: slash.h
  };
}
