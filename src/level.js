import { TILE_SIZE, WORLD_COLS, WORLD_ROWS } from './constants.js';

const T = TILE_SIZE;

export function tileToWorld(col, row, tileSize = T) {
  return { x: col * tileSize, y: row * tileSize };
}

export function worldToTile(x, y, tileSize = T) {
  return { col: Math.floor(x / tileSize), row: Math.floor(y / tileSize) };
}

export function tileRect(col, row, cols = 1, rows = 1, kind = 'stone', tileSize = T) {
  const { x, y } = tileToWorld(col, row, tileSize);
  return { x, y, w: cols * tileSize, h: rows * tileSize, kind };
}

function spawnAt(col, floorRow) {
  return { x: col * T + 18, y: floorRow * T - 50 };
}

function hazardAt(col, row, cols = 1) {
  return {
    x: col * T,
    y: row * T + 46,
    w: cols * T,
    h: 24,
    visualX: col * T,
    visualY: row * T,
    cols
  };
}

function enemyAt(col, floorRow, minCol, maxCol, dir = 1, hp = 3) {
  return {
    x: col * T + 14,
    y: floorRow * T - 38,
    w: 42,
    h: 38,
    vx: dir * 55,
    hp,
    hurt: 0,
    min: minCol * T,
    max: (maxCol + 1) * T
  };
}

export const level = {
  tileSize: T,
  cols: WORLD_COLS,
  rows: WORLD_ROWS,
  worldWidth: WORLD_COLS * T,
  worldHeight: WORLD_ROWS * T,
  spawn: spawnAt(1, 9),
  platforms: [
    tileRect(0, 0, 18, 1, 'stone-boundary'),
    tileRect(0, 0, 1, 10, 'stone-boundary'),
    tileRect(17, 0, 1, 10, 'stone-boundary'),
    tileRect(0, 9, 18, 1, 'stone-floor'),
    tileRect(2, 8, 2, 1, 'stone-ledge'),
    tileRect(5, 7, 2, 1, 'stone-ledge'),
    tileRect(8, 6, 2, 1, 'stone-ledge'),
    tileRect(11, 5, 2, 1, 'stone-ledge'),
    tileRect(13, 4, 2, 1, 'stone-ledge')
  ],
  spikes: [hazardAt(7, 8, 2), hazardAt(12, 8, 2)],
  goal: tileRect(15, 8, 1, 1, 'gate'),
  decor: [
    { type: 'bannerRed', col: 2, row: 1 },
    { type: 'bannerGreen', col: 14, row: 1 },
    { type: 'torch', col: 7, row: 8 },
    { type: 'torch', col: 11, row: 8 },
    { type: 'flag', col: 15, row: 1 }
  ],
  enemySpawns: [
    enemyAt(4, 9, 2, 6, 1, 2),
    enemyAt(11, 5, 11, 12, -1, 3)
  ]
};

export function createPlayer(spawn = level.spawn) {
  return {
    x: spawn.x, y: spawn.y, w: 34, h: 50,
    vx: 0, vy: 0, dir: 1, grounded: false,
    hp: 5, inv: 0, attack: 0, coyote: 0, jumpBuf: 0,
    dash: 0, dashCooldown: 0, wallDir: 0, wallSlide: false,
    dead: false
  };
}

export function createEnemies(sourceLevel = level) {
  return (sourceLevel.enemySpawns || []).map(enemy => ({ ...enemy }));
}
