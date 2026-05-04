import { TILE_SIZE } from './constants.js';

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

function spawnAt(col, floorRow, tileSize = T) {
  return { x: col * tileSize + 18, y: floorRow * tileSize - 50 };
}

function hazardAt(col, row, cols = 1, tileSize = T) {
  return {
    x: col * tileSize,
    y: row * tileSize + 46,
    w: cols * tileSize,
    h: 24,
    visualX: col * tileSize,
    visualY: row * tileSize,
    cols
  };
}

function enemyAt(col, floorRow, minCol, maxExclusiveCol, dir = 1, hp = 3, tileSize = T) {
  return {
    x: col * tileSize + 14,
    y: floorRow * tileSize - 38,
    w: 42,
    h: 38,
    vx: dir * 55,
    hp,
    hurt: 0,
    min: minCol * tileSize,
    max: maxExclusiveCol * tileSize
  };
}

const EMPTY = '.';
const SOLID_TILES = new Set(['#', '=']);
const TERRAIN_CHARS = new Set([EMPTY, '#', '=', '^']);
const OBJECT_CHARS = new Set([EMPTY, 'P', 'E', 'G']);
const DECOR_CHARS = new Set([EMPTY, 'r', 'g', 't', 'f']);

const DECOR_TYPES = {
  r: 'bannerRed',
  g: 'bannerGreen',
  t: 'torch',
  f: 'flag'
};

export const levelDefinition = {
  terrainRows: [
    '##################',
    '#................#',
    '#................#',
    '#................#',
    '#............==..#',
    '#..........==....#',
    '#.......==.......#',
    '#....==..........#',
    '#.==...^^...^^...#',
    '##################'
  ],
  objectRows: [
    '..................',
    '..................',
    '..................',
    '..................',
    '...........E......',
    '...............G..',
    '..................',
    '..................',
    '.P..E.............',
    '..................'
  ],
  decorRows: [
    '..................',
    '..r...........gf..',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '.......t...t......',
    '..................'
  ]
};

function validateLayer(name, rows, width, height, allowedChars) {
  if (!Array.isArray(rows) || rows.length !== height) {
    throw new Error(`${name} must contain ${height} rows`);
  }

  rows.forEach((row, rowIndex) => {
    if (typeof row !== 'string' || row.length !== width) {
      throw new Error(`${name} row ${rowIndex} must be ${width} chars wide`);
    }
    for (const ch of row) {
      if (!allowedChars.has(ch)) throw new Error(`${name} contains unknown tile '${ch}'`);
    }
  });
}

function tileAt(rows, col, row) {
  return rows[row]?.[col] ?? EMPTY;
}

function isSolidAt(rows, col, row) {
  return SOLID_TILES.has(tileAt(rows, col, row));
}

function assertSingleMarker(objectRows, marker, label) {
  const positions = [];
  objectRows.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      if (ch === marker) positions.push({ col, row });
    });
  });
  if (positions.length !== 1) throw new Error(`tilemap must contain exactly one ${label}`);
  return positions[0];
}

export function mergeSolidTiles(terrainRows, tileSize = T) {
  const platforms = [];

  terrainRows.forEach((line, row) => {
    let col = 0;
    while (col < line.length) {
      if (!SOLID_TILES.has(line[col])) {
        col++;
        continue;
      }

      const start = col;
      const kindChar = line[col];
      while (col < line.length && line[col] === kindChar) col++;
      const cols = col - start;
      const kind = kindChar === '#' ? 'stone-boundary' : 'stone-ledge';
      platforms.push(tileRect(start, row, cols, 1, kind, tileSize));
    }
  });

  return platforms;
}

function collectSpikeHazards(terrainRows, tileSize = T) {
  const spikes = [];

  terrainRows.forEach((line, row) => {
    let col = 0;
    while (col < line.length) {
      if (line[col] !== '^') {
        col++;
        continue;
      }
      const start = col;
      while (col < line.length && line[col] === '^') col++;
      spikes.push(hazardAt(start, row, col - start, tileSize));
    }
  });

  return spikes;
}

function collectDecor(decorRows) {
  const decor = [];
  decorRows.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      const type = DECOR_TYPES[ch];
      if (type) decor.push({ type, col, row });
    });
  });
  return decor;
}

function deriveEnemyPatrol(terrainRows, col, row) {
  const floorRow = row + 1;
  if (!isSolidAt(terrainRows, col, floorRow)) {
    throw new Error(`enemy at ${col},${row} must stand above a solid tile`);
  }

  let minCol = col;
  while (minCol > 0 && !isSolidAt(terrainRows, minCol - 1, row) && isSolidAt(terrainRows, minCol - 1, floorRow)) {
    minCol--;
  }

  let maxExclusiveCol = col + 1;
  while (
    maxExclusiveCol < terrainRows[0].length &&
    !isSolidAt(terrainRows, maxExclusiveCol, row) &&
    isSolidAt(terrainRows, maxExclusiveCol, floorRow)
  ) {
    maxExclusiveCol++;
  }

  return { floorRow, minCol, maxExclusiveCol };
}

function collectEnemies(objectRows, terrainRows, tileSize = T) {
  const enemies = [];
  objectRows.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      if (ch !== 'E') return;
      const patrol = deriveEnemyPatrol(terrainRows, col, row);
      const dir = enemies.length % 2 === 0 ? 1 : -1;
      const hp = enemies.length === 0 ? 2 : 3;
      enemies.push(enemyAt(col, patrol.floorRow, patrol.minCol, patrol.maxExclusiveCol, dir, hp, tileSize));
    });
  });
  return enemies;
}

export function parseTilemap(definition, tileSize = T) {
  const { terrainRows, objectRows, decorRows } = definition;
  if (!Array.isArray(terrainRows) || terrainRows.length === 0) throw new Error('terrainRows must contain at least one row');

  const rows = terrainRows.length;
  const cols = terrainRows[0].length;
  validateLayer('terrainRows', terrainRows, cols, rows, TERRAIN_CHARS);
  validateLayer('objectRows', objectRows, cols, rows, OBJECT_CHARS);
  validateLayer('decorRows', decorRows, cols, rows, DECOR_CHARS);

  const spawnMarker = assertSingleMarker(objectRows, 'P', 'player spawn');
  const goalMarker = assertSingleMarker(objectRows, 'G', 'goal');
  const spawnFloorRow = spawnMarker.row + 1;
  if (!isSolidAt(terrainRows, spawnMarker.col, spawnFloorRow)) {
    throw new Error(`player spawn at ${spawnMarker.col},${spawnMarker.row} must stand above a solid tile`);
  }

  return {
    tileSize,
    cols,
    rows,
    worldWidth: cols * tileSize,
    worldHeight: rows * tileSize,
    tiles: {
      terrainRows: [...terrainRows],
      objectRows: [...objectRows],
      decorRows: [...decorRows]
    },
    spawn: spawnAt(spawnMarker.col, spawnFloorRow, tileSize),
    platforms: mergeSolidTiles(terrainRows, tileSize),
    spikes: collectSpikeHazards(terrainRows, tileSize),
    goal: tileRect(goalMarker.col, goalMarker.row, 1, 1, 'gate', tileSize),
    decor: collectDecor(decorRows),
    enemySpawns: collectEnemies(objectRows, terrainRows, tileSize)
  };
}

export const level = parseTilemap(levelDefinition);

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
