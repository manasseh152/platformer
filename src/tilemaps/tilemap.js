import { TILE_SIZE } from '../constants.js';

const T = TILE_SIZE;
const DEFAULT_ART_TILE_SIZE = 18;
const DEFAULT_THEME = 'kenney-pixel-platformer:grass';

const EMPTY = '.';
const SOLID_TILES = new Set(['#', '=', 'B']);
const TERRAIN_CHARS = new Set([EMPTY, '#', '=', 'B', '^']);
const OBJECT_CHARS = new Set([EMPTY, 'P', 'E', 'G', '<', '>']);
const DECOR_CHARS = new Set([EMPTY, 'r', 'g', 't', 'f']);
const BACKDROP_CHARS = new Set([EMPTY, 'a', 'k', 'c', 'd']);

export function withLevelMeta(parsedLevel, meta) {
  return Object.assign(parsedLevel, meta);
}

export const DECOR_TYPES = {
  r: 'bannerRed',
  g: 'bannerGreen',
  t: 'torch',
  f: 'flag'
};

export function tileToWorld(col, row, tileSize = T) {
  return { x: col * tileSize, y: row * tileSize };
}

export function worldToTile(x, y, tileSize = T) {
  return { col: Math.floor(x / tileSize), row: Math.floor(y / tileSize) };
}

export function tileRect(col, row, cols = 1, rows = 1, kind = 'stone', tileSize = T) {
  const { x, y } = tileToWorld(col, row, tileSize);
  return { x, y, w: cols * tileSize, h: rows * tileSize, kind, col, row, cols, rows };
}

function spawnAt(col, floorRow, tileSize = T) {
  return { x: col * tileSize + 18, y: floorRow * tileSize - 50 };
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

function assertSingleMarker(rows, marker, label) {
  const positions = findMarkersInRows(rows, marker);
  if (positions.length !== 1) throw new Error(`tilemap must contain exactly one ${label}`);
  return positions[0];
}

function findMarkersInRows(rows, marker) {
  const positions = [];
  rows.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      if (ch === marker) positions.push({ col, row });
    });
  });
  return positions;
}

function layerRows(level, layer) {
  return level.tiles?.[`${layer}Rows`] ?? level.tiles?.[layer] ?? [];
}

export function getTile(level, layer, col, row) {
  return layerRows(level, layer)[row]?.[col] ?? EMPTY;
}

export function isSolidTile(tile) {
  return SOLID_TILES.has(tile);
}

export function isSolidTileAt(level, col, row) {
  return isSolidTile(getTile(level, 'terrain', col, row));
}

export function isSpikeTileAt(level, col, row) {
  return getTile(level, 'terrain', col, row) === '^';
}

export function forEachLayerTile(level, layer, callback) {
  layerRows(level, layer).forEach((line, row) => {
    [...line].forEach((tile, col) => callback(tile, col, row));
  });
}

export function findObjectMarkers(level, marker) {
  return findMarkersInRows(layerRows(level, 'object'), marker);
}

export function getGoalRect(level) {
  const [goal] = findObjectMarkers(level, 'G');
  let startCol = goal.col;
  let endCol = goal.col;
  while (getTile(level, 'object', startCol - 1, goal.row) === '<') startCol--;
  while (getTile(level, 'object', endCol + 1, goal.row) === '>') endCol++;
  return tileRect(startCol, goal.row, endCol - startCol + 1, 1, 'gate', level.tileSize);
}

export function getGoalTriggerRect(level) {
  const goal = getGoalRect(level);
  const pad = level.tileSize / 2;
  return {
    ...goal,
    x: goal.x - pad,
    w: goal.w + pad * 2,
    h: goal.h + level.tileSize,
    kind: 'gate-trigger'
  };
}

export function getSpawnPoint(level) {
  const [spawn] = findObjectMarkers(level, 'P');
  return spawnAt(spawn.col, spawn.row + 1, level.tileSize);
}

export function getDecorType(tile) {
  return DECOR_TYPES[tile];
}

export function getTileRangeForRect(level, rect) {
  const tileSize = level.tileSize;
  return {
    startCol: Math.floor(rect.x / tileSize),
    endCol: Math.floor((rect.x + rect.w - 0.001) / tileSize),
    startRow: Math.floor(rect.y / tileSize),
    endRow: Math.floor((rect.y + rect.h - 0.001) / tileSize)
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clippedWorldRect(rect, level) {
  const x = Math.max(0, rect.x);
  const y = Math.max(0, rect.y);
  const right = Math.min(level.worldWidth, rect.x + rect.w);
  const bottom = Math.min(level.worldHeight, rect.y + rect.h);
  if (right <= x || bottom <= y) return null;
  return { ...rect, x, y, w: right - x, h: bottom - y };
}

export function solidTileRectsOverlapping(level, rect) {
  const primitiveRects = level.collisionMode === 'dual-grid' ? level.renderLayers?.terrainCollisionRects : null;
  if (primitiveRects?.length) return primitiveRects.filter(hit => rectsOverlap(rect, hit));

  const range = getTileRangeForRect(level, rect);
  const hits = [];
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      if (isSolidTileAt(level, col, row)) hits.push(tileRect(col, row, 1, 1, 'solid', level.tileSize));
    }
  }
  return hits;
}

export function spikeHazardRectsOverlapping(level, rect) {
  const range = getTileRangeForRect(level, rect);
  const hits = [];
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      if (!isSpikeTileAt(level, col, row)) continue;
      const tileSize = level.tileSize;
      hits.push({
        x: col * tileSize,
        y: row * tileSize + tileSize * 0.66,
        w: tileSize,
        h: tileSize * 0.34,
        col,
        row
      });
    }
  }
  return hits;
}

function terrainNoise(col, row, subCol, subRow) {
  const n = Math.sin((col * 127.1 + row * 311.7 + subCol * 43.3 + subRow * 91.9)) * 43758.5453;
  return n - Math.floor(n);
}

function terrainAssetForSubtile(level, ch, col, row, subCol, subRow) {
  if (ch === '=') return 'platform';
  const above = isSolidTile(getTile(level, 'terrain', col, row - 1));
  const below = isSolidTile(getTile(level, 'terrain', col, row + 1));
  const left = isSolidTile(getTile(level, 'terrain', col - 1, row));
  const right = isSolidTile(getTile(level, 'terrain', col + 1, row));
  if (!above && !left && subCol === 0 && subRow === 0) return 'topLeft';
  if (!above && !right && subCol === 1 && subRow === 0) return 'topRight';
  if (!below && !left && subCol === 0 && subRow === 1) return 'bottomLeft';
  if (!below && !right && subCol === 1 && subRow === 1) return 'bottomRight';
  if (!above && subRow === 0) return 'top';
  if (!below && subRow === 1) return 'bottom';
  if (!left && subCol === 0) return 'left';
  if (!right && subCol === 1) return 'right';
  return terrainNoise(col, row, subCol, subRow) > 0.52 ? 'fillAlt' : 'fill';
}

function buildTerrainVisuals(level) {
  const visuals = [];
  const art = level.artTileSize;
  forEachLayerTile(level, 'terrain', (ch, col, row) => {
    if (!isSolidTile(ch)) return;
    for (let subRow = 0; subRow < level.artTilesPerTile; subRow++) {
      for (let subCol = 0; subCol < level.artTilesPerTile; subCol++) {
        visuals.push({
          layer: 'terrain',
          theme: level.theme,
          assetKey: terrainAssetForSubtile(level, ch, col, row, subCol, subRow),
          x: col * level.tileSize + subCol * art,
          y: row * level.tileSize + subRow * art,
          w: art,
          h: art,
          col,
          row,
          subCol,
          subRow
        });
      }
    }
  });
  return visuals;
}

function terrainPrimitiveAssetForMask(mask) {
  if (mask === 15) return 'fill';
  if (mask === 1) return 'bottomRight';
  if (mask === 2) return 'bottomLeft';
  if (mask === 4) return 'topRight';
  if (mask === 8) return 'topLeft';
  if ((mask & 3) === 3 && (mask & 12) === 0) return 'bottom';
  if ((mask & 12) === 12 && (mask & 3) === 0) return 'top';
  if ((mask & 5) === 5 && (mask & 10) === 0) return 'right';
  if ((mask & 10) === 10 && (mask & 5) === 0) return 'left';
  if (mask === 7) return 'bottomRight';
  if (mask === 11) return 'bottomLeft';
  if (mask === 13) return 'topRight';
  if (mask === 14) return 'topLeft';
  return terrainNoise(mask, mask, 0, 0) > 0.5 ? 'fillAlt' : 'fill';
}

function buildTerrainPrimitives(level) {
  const primitives = [];
  for (let row = 0; row <= level.rows; row++) {
    for (let col = 0; col <= level.cols; col++) {
      const nw = isSolidTileAt(level, col - 1, row - 1) ? 1 : 0;
      const ne = isSolidTileAt(level, col, row - 1) ? 2 : 0;
      const sw = isSolidTileAt(level, col - 1, row) ? 4 : 0;
      const se = isSolidTileAt(level, col, row) ? 8 : 0;
      const mask = nw | ne | sw | se;
      if (mask === 0) continue;
      primitives.push({
        layer: 'terrain',
        theme: level.theme,
        mask,
        assetKey: terrainPrimitiveAssetForMask(mask),
        x: (col - 0.5) * level.tileSize,
        y: (row - 0.5) * level.tileSize,
        w: level.tileSize,
        h: level.tileSize,
        col,
        row,
        offsetGrid: true
      });
    }
  }
  return primitives;
}

function buildTerrainCollisionRects(level, primitives) {
  return primitives
    .map(primitive => clippedWorldRect({
      x: primitive.x,
      y: primitive.y,
      w: primitive.w,
      h: primitive.h,
      col: primitive.col,
      row: primitive.row,
      mask: primitive.mask,
      kind: 'dual-grid-solid'
    }, level))
    .filter(Boolean);
}

function deriveEnemyPatrol(level, col, row) {
  const floorRow = row + 1;
  if (!isSolidTileAt(level, col, floorRow)) {
    throw new Error(`enemy at ${col},${row} must stand above a solid tile`);
  }

  let minCol = col;
  while (minCol > 0 && !isSolidTileAt(level, minCol - 1, row) && isSolidTileAt(level, minCol - 1, floorRow)) {
    minCol--;
  }

  let maxExclusiveCol = col + 1;
  while (
    maxExclusiveCol < level.cols &&
    !isSolidTileAt(level, maxExclusiveCol, row) &&
    isSolidTileAt(level, maxExclusiveCol, floorRow)
  ) {
    maxExclusiveCol++;
  }

  return { floorRow, minCol, maxExclusiveCol };
}

export function createEnemySpawns(sourceLevel = level) {
  return findObjectMarkers(sourceLevel, 'E').map((marker, index) => {
    const patrol = deriveEnemyPatrol(sourceLevel, marker.col, marker.row);
    const dir = index % 2 === 0 ? 1 : -1;
    const hp = index === 0 ? 2 : 3;
    return enemyAt(marker.col, patrol.floorRow, patrol.minCol, patrol.maxExclusiveCol, dir, hp, sourceLevel.tileSize);
  });
}

export function parseTilemap(definition, tileSize = definition.tileSize ?? T) {
  const { terrainRows, objectRows, decorRows } = definition;
  const artTileSize = definition.artTileSize ?? (tileSize % DEFAULT_ART_TILE_SIZE === 0 ? DEFAULT_ART_TILE_SIZE : tileSize);
  const artTilesPerTile = tileSize / artTileSize;
  if (!Number.isInteger(artTilesPerTile)) throw new Error(`tileSize ${tileSize} must be an integer multiple of artTileSize ${artTileSize}`);
  if (!Array.isArray(terrainRows) || terrainRows.length === 0) throw new Error('terrainRows must contain at least one row');

  const rows = terrainRows.length;
  const cols = terrainRows[0].length;
  validateLayer('terrainRows', terrainRows, cols, rows, TERRAIN_CHARS);
  validateLayer('objectRows', objectRows, cols, rows, OBJECT_CHARS);
  validateLayer('decorRows', decorRows, cols, rows, DECOR_CHARS);
  const backdropRows = definition.backdropRows ?? Array.from({ length: rows }, () => EMPTY.repeat(cols));
  validateLayer('backdropRows', backdropRows, cols, rows, BACKDROP_CHARS);

  const spawnMarker = assertSingleMarker(objectRows, 'P', 'player spawn');
  assertSingleMarker(objectRows, 'G', 'goal');

  const parsedLevel = {
    tileSize,
    artTileSize,
    artTilesPerTile,
    theme: definition.theme ?? DEFAULT_THEME,
    collisionMode: definition.collisionMode ?? 'tile',
    cols,
    rows,
    worldWidth: cols * tileSize,
    worldHeight: rows * tileSize,
    tiles: {
      terrainRows: [...terrainRows],
      objectRows: [...objectRows],
      decorRows: [...decorRows],
      backdropRows: [...backdropRows]
    }
  };

  const terrainPrimitives = buildTerrainPrimitives(parsedLevel);
  parsedLevel.renderLayers = {
    terrainVisuals: buildTerrainVisuals(parsedLevel),
    terrainPrimitives,
    terrainCollisionRects: buildTerrainCollisionRects(parsedLevel, terrainPrimitives)
  };

  if (!isSolidTileAt(parsedLevel, spawnMarker.col, spawnMarker.row + 1)) {
    throw new Error(`player spawn at ${spawnMarker.col},${spawnMarker.row} must stand above a solid tile`);
  }

  createEnemySpawns(parsedLevel);
  return parsedLevel;
}

export function createPlayer(spawn, tileSize = T) {
  if (!spawn) throw new Error('createPlayer requires a spawn point');
  return {
    x: spawn.x, y: spawn.y, w: 34, h: 50,
    vx: 0, vy: 0, dir: 1, grounded: false,
    hp: 5, inv: 0, attack: 0, coyote: 0, jumpBuf: 0,
    dash: 0, dashCooldown: 0, wallDir: 0, wallSlide: false,
    dead: false
  };
}

export function createEnemies(sourceLevel) {
  if (!sourceLevel) throw new Error('createEnemies requires a level');
  return createEnemySpawns(sourceLevel).map(enemy => ({ ...enemy }));
}
