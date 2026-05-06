import { ACTOR_SIZE, CELL_SIZE, GRID_SIZE, TERRAIN_PRIMITIVE_SIZE } from '../constants.js';
import { defineScene } from '../../engine/scene/scene.js';
import { defineObject, sceneObject } from '../../engine/scene/objects.js';
import { getComponent, findObjectsWithComponent } from '../../engine/scene/queries.js';
import { enemyController, hazard, health, patrol, physicsBody, playerController, renderGoal, renderTerrain, solid, spawner, terrain, transition, velocity } from '../../engine/scene/components.js';

const DECOR_TYPES = { r: 'bannerRed', g: 'bannerGreen', f: 'flag', t: 'torch' };
const BACKDROP_SYMBOLS = new Set(['.', 'a', 'k', 'c', 'd']);
const markerObject = (id, components = []) => ({ id, components });

// Compatibility symbols for legacy row-based tilemap definitions. Authored tilemap
// content should prefer passing explicit layer symbols via gridLayer().
const legacySolidTerrain = defineObject({
  id: 'solid-terrain',
  components: [solid(), terrain(), renderTerrain({ strategy: 'dual-grid' })]
});
const legacyPlayer = defineObject({
  id: 'player',
  components: [physicsBody(ACTOR_SIZE.PLAYER), velocity(), health({ hp: 5 }), playerController()]
});
const legacySlime = defineObject({
  id: 'slime',
  components: [physicsBody(ACTOR_SIZE.SLIME), velocity(), health({ hp: 3 }), enemyController(), patrol({ strategy: 'auto-platform' })]
});
const legacyFinishGate = defineObject({
  id: 'finish-gate',
  components: [transition({ kind: 'finish' }), renderGoal()]
});
const legacyPlayerSpawner = defineObject({ id: 'player-spawner', components: [spawner(legacyPlayer)] });
const legacySlimeSpawner = defineObject({ id: 'slime-spawner', components: [spawner(legacySlime)] });
const legacyFinishGateObject = defineObject({ id: 'finish-gate-object', components: [spawner(legacyFinishGate)] });

const T = GRID_SIZE;
/**
 * @deprecated TODO(new-terrain): remove with legacy Kenney/dual-grid terrain path.
 */
const DEFAULT_ART_TILE_SIZE = 16;
const TERRAIN_RENDER_MODE = Object.freeze({ LEGACY_DUAL_GRID: 'legacy-dual-grid', CONTAINED_AUTOTILE: 'contained-autotile' });
const DEFAULT_THEME = 'kenney-pixel-platformer:grass';
const EMPTY = '.';

function isAllowedCellSize(cellSize) { return Object.values(CELL_SIZE).includes(cellSize); }

export function gridLayer({ id, cellSize = CELL_SIZE.GRID, symbols = {}, rows, resolution }) {
  if (!id) throw new Error('gridLayer requires an id');
  if (resolution !== undefined) throw new Error(`${id} layer uses deprecated resolution; use cellSize from CELL_SIZE instead`);
  if (!isAllowedCellSize(cellSize)) throw new Error(`${id} layer has unsupported cellSize ${cellSize}`);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${id} layer rows must contain at least one row`);
  const width = rows[0].length;
  rows.forEach((row, rowIndex) => {
    if (typeof row !== 'string' || row.length !== width) throw new Error(`${id} layer row ${rowIndex} must be ${width} chars wide`);
    for (const symbol of row) if (symbol !== EMPTY && !symbols[symbol]) throw new Error(`${id} layer contains unknown symbol '${symbol}'`);
  });
  return { id, type: 'grid', cellSize, symbols, rows: [...rows] };
}

function hasComponent(object, type) { return object.components.some(component => component.type === type); }
function layerCellSize(scene, layer) { return layer.cellSize ?? scene.tileSize; }

function objectFromCell(scene, layer, symbol, definition, col, row) {
  const cellSize = layerCellSize(scene, layer);
  return sceneObject({
    id: `${layer.id}:${col},${row}`,
    layerId: layer.id,
    symbol,
    definitionId: definition.id,
    transform: { col, row, cellSize, x: col * cellSize, y: row * cellSize, w: cellSize, h: cellSize },
    components: definition.components
  });
}

export function withTilemapMeta(parsedScene, meta) { return Object.assign(parsedScene, meta); }

export function parseTilemap(definition) {
  const terrainRows = validateLegacyRows(definition.terrainRows, 'terrainRows');
  const objectRows = validateLegacyRows(definition.objectRows, 'objectRows', terrainRows.length, terrainRows[0].length).map(row => row.replace(/<G>/g, 'GGG'));
  const decorRows = validateLegacyRows(definition.decorRows ?? terrainRows.map(row => EMPTY.repeat(row.length)), 'decorRows', terrainRows.length, terrainRows[0].length);
  const backdropRows = validateLegacyRows(definition.backdropRows ?? terrainRows.map(row => EMPTY.repeat(row.length)), 'backdropRows', terrainRows.length, terrainRows[0].length, BACKDROP_SYMBOLS);
  const normalizedTerrainRows = terrainRows.map(row => row.replace(/[=B]/g, '#').replace(/\^/g, '.'));
  const spikeRows = terrainRows.map(row => row.replace(/[^\^]/g, EMPTY));
  if (!objectRows.some(row => row.includes('P'))) throw new Error('objectRows must contain a player spawn');
  return defineTilemap({
    cols: terrainRows[0].length,
    rows: terrainRows.length,
    artTileSize: definition.artTileSize,
    theme: definition.theme,
    collisionMode: definition.collisionMode,
    terrainRenderMode: TERRAIN_RENDER_MODE.LEGACY_DUAL_GRID,
    layers: [
      gridLayer({ id: 'backdrop', symbols: Object.fromEntries([...BACKDROP_SYMBOLS].filter(symbol => symbol !== EMPTY).map(symbol => [symbol, markerObject(`backdrop-${symbol}`)])), rows: backdropRows }),
      gridLayer({ id: 'terrain', symbols: { '#': legacySolidTerrain }, rows: normalizedTerrainRows }),
      gridLayer({ id: 'entities', symbols: { P: legacyPlayerSpawner, E: legacySlimeSpawner, G: legacyFinishGateObject }, rows: objectRows }),
      gridLayer({ id: 'decor', symbols: Object.fromEntries(Object.keys(DECOR_TYPES).map(symbol => [symbol, markerObject(`decor-${symbol}`)])), rows: decorRows }),
      gridLayer({ id: 'hazards', symbols: { '^': markerObject('spike-hazard', [hazard({ kind: 'spike', damage: 1 })]) }, rows: spikeRows })
    ]
  });
}

function validateLegacyRows(rows, name, expectedRows = null, expectedCols = null, allowedSymbols = null) {
  if (!Array.isArray(rows)) throw new Error(`${name} must be rows`);
  if (expectedRows !== null && rows.length !== expectedRows) throw new Error(`${name} must contain ${expectedRows} rows`);
  if (rows.length === 0) throw new Error(`${name} must contain at least one row`);
  const cols = expectedCols ?? rows[0].length;
  return rows.map((row, index) => {
    if (typeof row !== 'string') throw new Error(`${name} row ${index} must be a string`);
    if (row.length !== cols) throw new Error(`${name} row ${index} must be ${cols} chars wide`);
    if (allowedSymbols) for (const symbol of row) if (!allowedSymbols.has(symbol)) throw new Error(`${name} contains unknown tile '${symbol}'`);
    if (name === 'terrainRows' && /[^#.=B^]/.test(row)) throw new Error(`${name} contains unknown tile`);
    if (name === 'decorRows' && [...row].some(symbol => symbol !== EMPTY && !DECOR_TYPES[symbol])) throw new Error(`${name} contains unknown tile`);
    return row;
  });
}

export function defineTilemap(definition) {
  const tileSize = GRID_SIZE;
  const artTileSize = definition.artTileSize ?? DEFAULT_ART_TILE_SIZE;
  const artTilesPerTile = tileSize / artTileSize;
  if (!Number.isInteger(artTilesPerTile)) throw new Error(`gridSize ${tileSize} must be an integer multiple of artTileSize ${artTileSize}`);
  if (!Number.isInteger(definition.cols) || definition.cols < 1) throw new Error('defineTilemap requires positive integer cols');
  if (!Number.isInteger(definition.rows) || definition.rows < 1) throw new Error('defineTilemap requires positive integer rows');
  if (!Array.isArray(definition.layers) || definition.layers.length === 0) throw new Error('defineTilemap requires layers');

  const cols = definition.cols;
  const rows = definition.rows;
  for (const layer of definition.layers) {
    const cellSize = layer.cellSize ?? CELL_SIZE.GRID;
    if (!isAllowedCellSize(cellSize)) throw new Error(`${layer.id} layer has unsupported cellSize ${cellSize}`);
    if (!Number.isInteger(tileSize / cellSize)) throw new Error(`${layer.id} layer cellSize ${cellSize} must divide gridSize ${tileSize}`);
    const cellsPerGrid = tileSize / cellSize;
    const expectedRows = rows * cellsPerGrid;
    const expectedCols = cols * cellsPerGrid;
    if (layer.rows.length !== expectedRows) throw new Error(`${layer.id} layer must contain ${expectedRows} rows`);
    layer.rows.forEach((row, index) => { if (row.length !== expectedCols) throw new Error(`${layer.id} layer row ${index} must be ${expectedCols} chars wide`); });
  }

  const scene = {
    ...definition,
    id: definition.id ?? 'anonymous-tilemap',
    kind: definition.kind ?? 'tilemap',
    tileSize,
    gridSize: GRID_SIZE,
    artTileSize,
    artTilesPerTile,
    terrainRenderMode: definition.terrainRenderMode ?? TERRAIN_RENDER_MODE.LEGACY_DUAL_GRID,
    theme: definition.theme ?? DEFAULT_THEME,
    cols,
    rows,
    worldWidth: cols * tileSize,
    worldHeight: rows * tileSize,
    layers: definition.layers.map(layer => ({ ...layer, cellSize: layer.cellSize ?? CELL_SIZE.GRID, rows: [...layer.rows], symbols: { ...layer.symbols } }))
  };

  const objects = [];
  for (const layer of scene.layers) {
    layer.rows.forEach((line, row) => [...line].forEach((symbol, col) => {
      if (symbol === EMPTY) return;
      objects.push(objectFromCell(scene, layer, symbol, layer.symbols[symbol], col, row));
    }));
  }
  Object.assign(scene, defineScene({ ...scene, objects: [...objects, ...(definition.objects ?? [])] }));

  const containedTerrain = scene.terrainRenderMode === TERRAIN_RENDER_MODE.CONTAINED_AUTOTILE;
  const terrainPrimitives = containedTerrain ? [] : buildTerrainPrimitives(scene);
  scene.collisionLayers = containedTerrain ? buildContainedTerrainCollisionLayers(scene) : {};
  // Compatibility fields for current legacy render systems.
  // New systems should prefer scene.objects + components + engine/scene queries.
  scene.renderLayers = containedTerrain ? {
    containedTerrainTiles: buildContainedTerrainTiles(scene)
  } : {
    /** @deprecated TODO(new-terrain): delete with legacy Kenney/dual-grid terrain path. */
    terrainVisuals: buildTerrainVisuals(scene),
    /** @deprecated TODO(new-terrain): delete with legacy offset terrain primitive renderer. */
    terrainPrimitives,
    /** @deprecated TODO(new-terrain): replaced by scene.collisionLayers. */
    terrainCollisionCells: buildTerrainCollisionCells(scene),
    /** @deprecated TODO(new-terrain): replaced by scene.collisionLayers. */
    terrainCollisionRects: buildTerrainCollisionRects(scene)
  };
  scene.tiles = Object.fromEntries(scene.layers.map(layer => [`${layer.id}Rows`, layer.rows]));
  return scene;
}

function terrainObjects(scene) { return findObjectsWithComponent(scene, 'collision:solid').filter(object => hasComponent(object, 'terrain')); }
function terrainLayer(scene) { return scene.layers?.find(layer => layer.id === 'buildTerrain') ?? scene.layers?.find(layer => layer.id === 'terrain') ?? null; }
function terrainCellSize(scene) { return terrainLayer(scene)?.cellSize ?? terrainObjects(scene)[0]?.transform?.cellSize ?? scene.tileSize; }
function terrainGridCols(scene) { return (terrainLayer(scene)?.rows[0]?.length) ?? Math.floor(scene.worldWidth / terrainCellSize(scene)); }
function terrainGridRows(scene) { return terrainLayer(scene)?.rows.length ?? Math.floor(scene.worldHeight / terrainCellSize(scene)); }
function terrainKey(col, row) { return `${col},${row}`; }
function terrainSet(scene) { return new Set(terrainObjects(scene).map(object => terrainKey(object.transform.col, object.transform.row))); }
function isSolidTerrainCellAt(scene, col, row) { return terrainSet(scene).has(terrainKey(col, row)); }

export function tileToWorld(col, row, tileSize = T) { return { x: col * tileSize, y: row * tileSize }; }
export function worldToTile(x, y, tileSize = T) { return { col: Math.floor(x / tileSize), row: Math.floor(y / tileSize) }; }
export function tileRect(col, row, cols = 1, rows = 1, kind = 'solid', tileSize = T) { const { x, y } = tileToWorld(col, row, tileSize); return { x, y, w: cols * tileSize, h: rows * tileSize, kind, col, row, cols, rows }; }
export function getTile(scene, layerId, col, row) { return scene.layers?.find(layer => layer.id === layerId)?.rows[row]?.[col] ?? EMPTY; }
export function forEachLayerTile(scene, layerId, callback) { scene.layers?.find(layer => layer.id === layerId)?.rows.forEach((line, row) => [...line].forEach((tile, col) => callback(tile, col, row))); }
export function isSolidTileAt(scene, col, row) {
  const cell = terrainCellSize(scene);
  if (cell === scene.tileSize) return isSolidTerrainCellAt(scene, col, row);
  const cellsPerTile = scene.tileSize / cell;
  const startCol = col * cellsPerTile;
  const startRow = row * cellsPerTile;
  for (let y = 0; y < cellsPerTile; y++) for (let x = 0; x < cellsPerTile; x++) if (isSolidTerrainCellAt(scene, startCol + x, startRow + y)) return true;
  return false;
}
export function isSolidTile(tile) { return tile === '#'; }
export function getDecorType(tile) { return DECOR_TYPES[tile] ?? null; }

export function solidTileRectsOverlapping(scene, rect) {
  const collisionRects = scene.collisionLayers?.terrainRects;
  if (collisionRects?.length) return collisionRects.filter(hit => rectsOverlap(rect, hit));
  /** @deprecated TODO(new-terrain): delete legacy renderLayers collision fallback after all terrain modes use collisionLayers. */
  const legacyCollisionRects = scene.renderLayers?.terrainCollisionRects;
  if (legacyCollisionRects?.length) return legacyCollisionRects.filter(hit => rectsOverlap(rect, hit));
  return terrainObjects(scene).map(object => ({ ...object.transform, kind: 'solid' })).filter(hit => rectsOverlap(rect, hit));
}

export function spikeHazardRectsOverlapping(scene, rect) {
  return findObjectsWithComponent(scene, 'collision:hazard')
    .filter(object => getComponent(object, 'collision:hazard')?.kind === 'spike')
    .map(object => ({ ...object.transform, kind: 'spike' }))
    .filter(hit => rectsOverlap(rect, hit));
}

export function getGoalRect(scene) {
  const goals = instantiatedObjects(scene, 'finish-gate');
  if (!goals.length) return { x: 0, y: 0, w: 0, h: 0, cols: 0, rows: 0, kind: 'gate' };
  const minCol = Math.min(...goals.map(o => o.transform.col));
  const maxCol = Math.max(...goals.map(o => o.transform.col));
  const minRow = Math.min(...goals.map(o => o.transform.row));
  const maxRow = Math.max(...goals.map(o => o.transform.row));
  return tileRect(minCol, minRow, maxCol - minCol + 1, maxRow - minRow + 1, 'gate', scene.tileSize);
}

export function getGoalTriggerRect(scene) { const goal = getGoalRect(scene); const pad = scene.tileSize / 2; return { ...goal, x: goal.x - pad, w: goal.w + pad * 2, h: goal.h + scene.tileSize, kind: 'gate-trigger' }; }

function spawnAtObject(object, tileSize) { return { x: object.transform.x + tileSize / 2, y: object.transform.y + tileSize - ACTOR_SIZE.PLAYER.h }; }
export function getSpawnPoint(scene) { const [spawn] = instantiatedObjects(scene, 'player'); return spawn ? spawnAtObject(spawn, scene.tileSize) : null; }

function instantiatedObjects(scene, definitionId) {
  return findObjectsWithComponent(scene, 'spawner').filter(object => getComponent(object, 'spawner')?.object?.id === definitionId);
}

function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function clippedWorldRect(rect, scene) { const x = Math.max(0, rect.x); const y = Math.max(0, rect.y); const right = Math.min(scene.worldWidth, rect.x + rect.w); const bottom = Math.min(scene.worldHeight, rect.y + rect.h); return right <= x || bottom <= y ? null : { ...rect, x, y, w: right - x, h: bottom - y }; }
function terrainNoise(col, row, subCol, subRow) { const n = Math.sin((col * 127.1 + row * 311.7 + subCol * 43.3 + subRow * 91.9)) * 43758.5453; return n - Math.floor(n); }
function terrainAssetForSubtile(scene, col, row, subCol, subRow, subCols = scene.artTilesPerTile, subRows = scene.artTilesPerTile) { const above = isSolidTerrainCellAt(scene, col, row - 1); const below = isSolidTerrainCellAt(scene, col, row + 1); const left = isSolidTerrainCellAt(scene, col - 1, row); const right = isSolidTerrainCellAt(scene, col + 1, row); const lastSubCol = subCols - 1; const lastSubRow = subRows - 1; if (!above && !left && subCol === 0 && subRow === 0) return 'topLeft'; if (!above && !right && subCol === lastSubCol && subRow === 0) return 'topRight'; if (!below && !left && subCol === 0 && subRow === lastSubRow) return 'bottomLeft'; if (!below && !right && subCol === lastSubCol && subRow === lastSubRow) return 'bottomRight'; if (!above && subRow === 0) return 'top'; if (!below && subRow === lastSubRow) return 'bottom'; if (!left && subCol === 0) return 'left'; if (!right && subCol === lastSubCol) return 'right'; return terrainNoise(col, row, subCol, subRow) > 0.52 ? 'fillAlt' : 'fill'; }
function buildTerrainVisuals(scene) { const visuals = []; const art = scene.artTileSize; for (const object of terrainObjects(scene)) { const { col, row, x, y, w, h } = object.transform; const subCols = Math.max(1, Math.floor(w / art)); const subRows = Math.max(1, Math.floor(h / art)); for (let subRow = 0; subRow < subRows; subRow++) for (let subCol = 0; subCol < subCols; subCol++) visuals.push({ layer: 'terrain', theme: scene.theme, assetKey: terrainAssetForSubtile(scene, col, row, subCol, subRow, subCols, subRows), x: x + subCol * art, y: y + subRow * art, w: art, h: art, col, row, subCol, subRow }); } return visuals; }
/**
 * @deprecated TODO(new-terrain): delete with legacy offset dual-grid terrain renderer.
 */
function terrainPrimitiveAssetForMask(mask) { if (mask === 15) return 'fill'; if (mask === 1) return 'bottomRight'; if (mask === 2) return 'bottomLeft'; if (mask === 4) return 'topRight'; if (mask === 8) return 'topLeft'; if ((mask & 3) === 3 && (mask & 12) === 0) return 'bottom'; if ((mask & 12) === 12 && (mask & 3) === 0) return 'top'; if ((mask & 5) === 5 && (mask & 10) === 0) return 'right'; if ((mask & 10) === 10 && (mask & 5) === 0) return 'left'; if (mask === 7) return 'bottomRight'; if (mask === 11) return 'bottomLeft'; if (mask === 13) return 'topRight'; if (mask === 14) return 'topLeft'; return terrainNoise(mask, mask, 0, 0) > 0.5 ? 'fillAlt' : 'fill'; }
function buildTerrainPrimitives(scene) { const primitives = []; const cell = terrainCellSize(scene); for (let row = 0; row <= terrainGridRows(scene); row++) for (let col = 0; col <= terrainGridCols(scene); col++) { const nw = isSolidTerrainCellAt(scene, col - 1, row - 1) ? 1 : 0; const ne = isSolidTerrainCellAt(scene, col, row - 1) ? 2 : 0; const sw = isSolidTerrainCellAt(scene, col - 1, row) ? 4 : 0; const se = isSolidTerrainCellAt(scene, col, row) ? 8 : 0; const mask = nw | ne | sw | se; if (mask === 0) continue; primitives.push({ layer: 'terrain', theme: scene.theme, mask, assetKey: terrainPrimitiveAssetForMask(mask), x: (col - 0.5) * cell, y: (row - 0.5) * cell, w: cell, h: cell, col, row, offsetGrid: true }); } return primitives; }
function buildTerrainCollisionCells(scene) { return terrainObjects(scene).map(object => ({ ...object.transform, kind: 'terrain-cell' })); }
function greedyMergeAabbs2D(width, height, isSolid) { const visited = new Uint8Array(width * height); const boxes = []; const index = (x, y) => y * width + x; const canUse = (x, y) => x >= 0 && x < width && y >= 0 && y < height && visited[index(x, y)] === 0 && isSolid(x, y); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { if (!canUse(x, y)) continue; let boxWidth = 1; while (canUse(x + boxWidth, y)) boxWidth++; let boxHeight = 1; while (y + boxHeight < height) { let rowMatches = true; for (let xx = x; xx < x + boxWidth; xx++) if (!canUse(xx, y + boxHeight)) { rowMatches = false; break; } if (!rowMatches) break; boxHeight++; } for (let yy = y; yy < y + boxHeight; yy++) for (let xx = x; xx < x + boxWidth; xx++) visited[index(xx, yy)] = 1; boxes.push({ x, y, w: boxWidth, h: boxHeight }); } return boxes; }
function buildTerrainCollisionRects(scene) { const solids = terrainSet(scene); const cell = terrainCellSize(scene); return greedyMergeAabbs2D(terrainGridCols(scene), terrainGridRows(scene), (col, row) => solids.has(terrainKey(col, row))).map(box => clippedWorldRect({ x: box.x * cell, y: box.y * cell, w: box.w * cell, h: box.h * cell, col: box.x, row: box.y, cols: box.w, rows: box.h, kind: 'terrain-solid' }, scene)).filter(Boolean); }
function buildContainedTerrainCollisionPrimitives(scene) { const primitives = []; for (const object of terrainObjects(scene)) { const startCol = Math.floor(object.transform.x / TERRAIN_PRIMITIVE_SIZE); const startRow = Math.floor(object.transform.y / TERRAIN_PRIMITIVE_SIZE); const primitiveCols = object.transform.w / TERRAIN_PRIMITIVE_SIZE; const primitiveRows = object.transform.h / TERRAIN_PRIMITIVE_SIZE; for (let row = 0; row < primitiveRows; row++) for (let col = 0; col < primitiveCols; col++) primitives.push({ x: (startCol + col) * TERRAIN_PRIMITIVE_SIZE, y: (startRow + row) * TERRAIN_PRIMITIVE_SIZE, w: TERRAIN_PRIMITIVE_SIZE, h: TERRAIN_PRIMITIVE_SIZE, col: startCol + col, row: startRow + row, kind: 'terrain-primitive' }); } return primitives; }
function buildContainedTerrainCollisionLayers(scene) { const terrainPrimitives = buildContainedTerrainCollisionPrimitives(scene); const solids = new Set(terrainPrimitives.map(cell => terrainKey(cell.col, cell.row))); const cols = Math.floor(scene.worldWidth / TERRAIN_PRIMITIVE_SIZE); const rows = Math.floor(scene.worldHeight / TERRAIN_PRIMITIVE_SIZE); return { terrainPrimitives, terrainRects: greedyMergeAabbs2D(cols, rows, (col, row) => solids.has(terrainKey(col, row))).map(box => clippedWorldRect({ x: box.x * TERRAIN_PRIMITIVE_SIZE, y: box.y * TERRAIN_PRIMITIVE_SIZE, w: box.w * TERRAIN_PRIMITIVE_SIZE, h: box.h * TERRAIN_PRIMITIVE_SIZE, col: box.x, row: box.y, cols: box.w, rows: box.h, kind: 'terrain-solid' }, scene)).filter(Boolean) }; }
function buildTerrainNeighborMask(scene, col, row) { let mask = 0; const bit = (dx, dy, value) => isSolidTerrainCellAt(scene, col + dx, row + dy) ? value : 0; mask |= bit(0, -1, 1); mask |= bit(1, -1, 2); mask |= bit(1, 0, 4); mask |= bit(1, 1, 8); mask |= bit(0, 1, 16); mask |= bit(-1, 1, 32); mask |= bit(-1, 0, 64); mask |= bit(-1, -1, 128); return mask; }
function buildContainedTerrainTiles(scene) { return terrainObjects(scene).map(object => ({ layer: 'buildTerrain', x: object.transform.x, y: object.transform.y, w: object.transform.w, h: object.transform.h, col: object.transform.col, row: object.transform.row, mask: buildTerrainNeighborMask(scene, object.transform.col, object.transform.row) })); }

function deriveEnemyPatrol(scene, col, row) { const floorRow = row + 1; let minCol = col; while (minCol > 0 && !isSolidTileAt(scene, minCol - 1, row) && isSolidTileAt(scene, minCol - 1, floorRow)) minCol--; let maxExclusiveCol = col + 1; while (maxExclusiveCol < scene.cols && !isSolidTileAt(scene, maxExclusiveCol, row) && isSolidTileAt(scene, maxExclusiveCol, floorRow)) maxExclusiveCol++; return { floorRow, minCol, maxExclusiveCol }; }
export function createPlayer(spawn) { if (!spawn) throw new Error('createPlayer requires a spawn point'); return { x: spawn.x, y: spawn.y, ...ACTOR_SIZE.PLAYER, vx: 0, vy: 0, dir: 1, grounded: false, hp: 5, inv: 0, attack: 0, coyote: 0, jumpBuf: 0, dash: 0, dashCooldown: 0, wallDir: 0, wallSlide: false, dead: false }; }
export function createEnemies(scene) { return instantiatedObjects(scene, 'slime').map((object, index) => { const patrol = deriveEnemyPatrol(scene, object.transform.col, object.transform.row); const dir = index % 2 === 0 ? 1 : -1; const hp = index === 0 ? 2 : 3; return { x: object.transform.x + 12, y: patrol.floorRow * scene.tileSize - ACTOR_SIZE.SLIME.h, ...ACTOR_SIZE.SLIME, vx: dir * 55, hp, hurt: 0, min: patrol.minCol * scene.tileSize, max: patrol.maxExclusiveCol * scene.tileSize }; }); }
export const createEnemySpawns = createEnemies;
