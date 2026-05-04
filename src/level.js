import { TILE_SIZE } from './constants.js';

const T = TILE_SIZE;

const EMPTY = '.';
const SOLID_TILES = new Set(['#', '=', 'B']);
const TERRAIN_CHARS = new Set([EMPTY, '#', '=', 'B', '^']);
const OBJECT_CHARS = new Set([EMPTY, 'P', 'E', 'G', '<', '>']);
const DECOR_CHARS = new Set([EMPTY, 'r', 'g', 't', 'f']);
const BACKDROP_CHARS = new Set([EMPTY, 'a', 'k', 'c', 'd']);

function withLevelMeta(parsedLevel, meta) {
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

export const mainLevelDefinition = {
  terrainRows: [
    '########################',
    '#......................#',
    '#......................#',
    '#.................===..#',
    '#.............===.BBB..#',
    '#.......====...........#',
    '#......................#',
    '#...====.........====..#',
    '#........^^^...........#',
    '#.....====.....====....#',
    '#..====.........====...#',
    '########################'
  ],
  objectRows: [
    '........................',
    '........................',
    '........................',
    '..................<G>...',
    '........................',
    '........................',
    '.....E...........E......',
    '........................',
    '........................',
    '.....E............E.....',
    '..P.....................',
    '........................'
  ],
  decorRows: [
    '........................',
    '..r...............g..f..',
    '........................',
    '..............t...t.....',
    '........................',
    '........................',
    '..........t.............',
    '........................',
    '.....t.........t........',
    '........................',
    '........................',
    '........................'
  ],
  backdropRows: [
    '........................',
    '.a..k.....a.....k..a....',
    '....d..........c........',
    '........a.........d.....',
    '..k.........d...........',
    '...............a....k...',
    '....c.....k.............',
    '............d...........',
    '..d.............k.......',
    '........a...............',
    '...k.........c.....d....',
    '........................'
  ]
};

const developerBackdropRows = [
  '........................',
  '.a..k.....a.....k..a....',
  '....d..........c........',
  '........a.........d.....',
  '..k.........d...........',
  '...............a....k...',
  '....c.....k.............',
  '............d...........',
  '..d.............k.......',
  '........a...............',
  '...k.........c.....d....',
  '........................'
];

export const movementGymDefinition = {
  terrainRows: [
    '########################',
    '#......................#',
    '#......................#',
    '#.................===..#',
    '#.............===......#',
    '#.........===..........#',
    '#.....===..............#',
    '#......................#',
    '#..===....===....===...#',
    '#......................#',
    '#.===..............==..#',
    '########################'
  ],
  objectRows: [
    '........................',
    '........................',
    '..................<G>...',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..P.....................',
    '........................'
  ],
  decorRows: [
    '........................',
    '..g......t.....t.....r..',
    '........................',
    '.................f......',
    '...........t............',
    '.......f................',
    '........................',
    '...t.......t......t.....',
    '........................',
    '..f...........f.....f...',
    '........................',
    '........................'
  ],
  backdropRows: developerBackdropRows
};

export const hazardGymDefinition = {
  terrainRows: [
    '########################',
    '#......................#',
    '#................===...#',
    '#......................#',
    '#..........===.........#',
    '#......................#',
    '#.....===..............#',
    '#..........^^^.........#',
    '#..===.....===....===..#',
    '#......^^^......^^.....#',
    '#.===..===......===....#',
    '########################'
  ],
  objectRows: [
    '........................',
    '.................<G>....',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..P.....................',
    '........................'
  ],
  decorRows: [
    '........................',
    '..r...............g.....',
    '........................',
    '..............t.........',
    '..........f.............',
    '........................',
    '.....t..................',
    '........................',
    '..f.......t......t......',
    '........................',
    '........................',
    '........................'
  ],
  backdropRows: developerBackdropRows
};

export const enemyZooDefinition = {
  terrainRows: [
    '########################',
    '#......................#',
    '#...............=====..#',
    '#......................#',
    '#.......=====..........#',
    '#......................#',
    '#..=====......=====....#',
    '#......................#',
    '#......====............#',
    '#......................#',
    '#.=====.....=====..==..#',
    '########################'
  ],
  objectRows: [
    '........................',
    '.................E.E....',
    '........................',
    '........<G>.............',
    '........................',
    '...E...........E........',
    '........................',
    '........................',
    '........................',
    '...E.........E..........',
    '..P.....................',
    '........................'
  ],
  decorRows: [
    '........................',
    '..r......t.....t.....r..',
    '........................',
    '........f...............',
    '........................',
    '...t...........t........',
    '........................',
    '........t...............',
    '........................',
    '..f.........f...........',
    '........................',
    '........................'
  ],
  backdropRows: developerBackdropRows
};

export const gateLabDefinition = {
  terrainRows: [
    '########################',
    '#......................#',
    '#......................#',
    '#................BBB...#',
    '#.............===BBB...#',
    '#......................#',
    '#......BBB.............#',
    '#..===.BBB.....===.....#',
    '#......................#',
    '#..===...........===...#',
    '#......................#',
    '########################'
  ],
  objectRows: [
    '........................',
    '........................',
    '........................',
    '.................<G>....',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..P.....................',
    '........................'
  ],
  decorRows: [
    '........................',
    '..g...............f.....',
    '........................',
    '..............t..t......',
    '........................',
    '......f.................',
    '........................',
    '...t..........t.........',
    '........................',
    '..f...........f.........',
    '........................',
    '........................'
  ],
  backdropRows: developerBackdropRows
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

export function solidTileRectsOverlapping(level, rect) {
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
        y: row * tileSize + 46,
        w: tileSize,
        h: 24,
        col,
        row
      });
    }
  }
  return hits;
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

export function parseTilemap(definition, tileSize = T) {
  const { terrainRows, objectRows, decorRows } = definition;
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

  if (!isSolidTileAt(parsedLevel, spawnMarker.col, spawnMarker.row + 1)) {
    throw new Error(`player spawn at ${spawnMarker.col},${spawnMarker.row} must stand above a solid tile`);
  }

  createEnemySpawns(parsedLevel);
  return parsedLevel;
}

export const level = withLevelMeta(parseTilemap(mainLevelDefinition), {
  id: 'main',
  name: 'Main Level',
  kind: 'campaign',
  developerOnly: false,
  description: 'Sprint through the moonlit keep and reach the glowing gate.'
});

export const gymLevel = withLevelMeta(parseTilemap(movementGymDefinition), {
  id: 'gym',
  name: 'Legacy Movement Lab',
  kind: 'legacy-test-map',
  developerOnly: true,
  deprecated: true,
  description: 'Deprecated tilemap-only test map. Prefer executable gyms for movement validation.'
});

export const hazardGymLevel = withLevelMeta(parseTilemap(hazardGymDefinition), {
  id: 'hazard-gym',
  name: 'Legacy Hazard Lab',
  kind: 'legacy-test-map',
  developerOnly: true,
  deprecated: true,
  description: 'Deprecated tilemap-only test map. Prefer executable gyms for hazard validation.'
});

export const enemyZooLevel = withLevelMeta(parseTilemap(enemyZooDefinition), {
  id: 'enemy-zoo',
  name: 'Legacy Enemy Zoo',
  kind: 'legacy-test-map',
  developerOnly: true,
  deprecated: true,
  description: 'Deprecated tilemap-only zoo. Prefer executable gyms for enemy behavior validation.'
});

export const gateLabLevel = withLevelMeta(parseTilemap(gateLabDefinition), {
  id: 'gate-lab',
  name: 'Gate Lab',
  kind: 'sandbox',
  developerOnly: true,
  description: 'Gate trigger sizing, block tiles, camera framing, and completion flow.'
});

export const levels = {
  main: level,
  gym: gymLevel,
  'hazard-gym': hazardGymLevel,
  'enemy-zoo': enemyZooLevel,
  'gate-lab': gateLabLevel
};

export function getLevelById(id) {
  return levels[id] ?? null;
}

export function createPlayer(spawn = getSpawnPoint(level)) {
  return {
    x: spawn.x, y: spawn.y, w: 34, h: 50,
    vx: 0, vy: 0, dir: 1, grounded: false,
    hp: 5, inv: 0, attack: 0, coyote: 0, jumpBuf: 0,
    dash: 0, dashCooldown: 0, wallDir: 0, wallSlide: false,
    dead: false
  };
}

export function createEnemies(sourceLevel = level) {
  return createEnemySpawns(sourceLevel).map(enemy => ({ ...enemy }));
}
