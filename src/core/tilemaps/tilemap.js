import { TILE_SIZE } from '../constants.js';
import { defineScene } from '../scene/scene.js';
import { defineObject, sceneObject } from '../scene/objects.js';
import { getComponent, findObjectsWithComponent } from '../scene/queries.js';
import { enemyController, health, patrol, physicsBody, playerController, renderGoal, renderTerrain, solid, spawner, terrain, transition, velocity } from '../scene/components.js';

const DECOR_TYPES = { r: 'bannerRed', g: 'bannerGreen', f: 'flag', t: 'torch' };
const BACKDROP_SYMBOLS = new Set(['.', 'a', 'k', 'c', 'd']);
const markerObject = id => ({ id, components: [] });

// Compatibility symbols for legacy row-based tilemap definitions. Authored tilemap
// content should prefer passing explicit layer symbols via gridLayer().
const legacySolidTerrain = defineObject({
  id: 'solid-terrain',
  components: [solid(), terrain(), renderTerrain({ strategy: 'dual-grid' })]
});
const legacyPlayer = defineObject({
  id: 'player',
  components: [physicsBody({ w: 34, h: 50 }), velocity(), health({ hp: 5 }), playerController()]
});
const legacySlime = defineObject({
  id: 'slime',
  components: [physicsBody({ w: 42, h: 38 }), velocity(), health({ hp: 3 }), enemyController(), patrol({ strategy: 'auto-platform' })]
});
const legacyFinishGate = defineObject({
  id: 'finish-gate',
  components: [transition({ kind: 'finish' }), renderGoal()]
});
const legacyPlayerSpawner = defineObject({ id: 'player-spawner', components: [spawner(legacyPlayer)] });
const legacySlimeSpawner = defineObject({ id: 'slime-spawner', components: [spawner(legacySlime)] });
const legacyFinishGateObject = defineObject({ id: 'finish-gate-object', components: [spawner(legacyFinishGate)] });

const T = TILE_SIZE;
const DEFAULT_ART_TILE_SIZE = 18;
const DEFAULT_THEME = 'kenney-pixel-platformer:grass';
const EMPTY = '.';

export function gridLayer({ id, symbols = {}, rows }) {
  if (!id) throw new Error('gridLayer requires an id');
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${id} layer rows must contain at least one row`);
  const width = rows[0].length;
  rows.forEach((row, rowIndex) => {
    if (typeof row !== 'string' || row.length !== width) throw new Error(`${id} layer row ${rowIndex} must be ${width} chars wide`);
    for (const symbol of row) if (symbol !== EMPTY && !symbols[symbol]) throw new Error(`${id} layer contains unknown symbol '${symbol}'`);
  });
  return { id, type: 'grid', symbols, rows: [...rows] };
}

function hasComponent(object, type) { return object.components.some(component => component.type === type); }

function objectFromCell(scene, layer, symbol, definition, col, row) {
  return sceneObject({
    id: `${layer.id}:${col},${row}`,
    layerId: layer.id,
    symbol,
    definitionId: definition.id,
    transform: { col, row, x: col * scene.tileSize, y: row * scene.tileSize, w: scene.tileSize, h: scene.tileSize },
    components: definition.components
  });
}

export function withLevelMeta(parsedScene, meta) { return Object.assign(parsedScene, meta); }

export function parseTilemap(definition, tileSize = definition.tileSize ?? T) {
  const terrainRows = validateLegacyRows(definition.terrainRows, 'terrainRows');
  const objectRows = validateLegacyRows(definition.objectRows, 'objectRows', terrainRows.length, terrainRows[0].length).map(row => row.replace(/<G>/g, 'GGG'));
  const decorRows = validateLegacyRows(definition.decorRows ?? terrainRows.map(row => EMPTY.repeat(row.length)), 'decorRows', terrainRows.length, terrainRows[0].length);
  const backdropRows = validateLegacyRows(definition.backdropRows ?? terrainRows.map(row => EMPTY.repeat(row.length)), 'backdropRows', terrainRows.length, terrainRows[0].length, BACKDROP_SYMBOLS);
  const normalizedTerrainRows = terrainRows.map(row => row.replace(/[=B]/g, '#').replace(/\^/g, '.'));
  const spikeRows = terrainRows.map(row => row.replace(/[^\^]/g, EMPTY));
  if (!objectRows.some(row => row.includes('P'))) throw new Error('objectRows must contain a player spawn');
  return defineTilemapScene({
    tileSize,
    artTileSize: definition.artTileSize,
    theme: definition.theme,
    collisionMode: definition.collisionMode,
    layers: [
      gridLayer({ id: 'backdrop', symbols: Object.fromEntries([...BACKDROP_SYMBOLS].filter(symbol => symbol !== EMPTY).map(symbol => [symbol, markerObject(`backdrop-${symbol}`)])), rows: backdropRows }),
      gridLayer({ id: 'terrain', symbols: { '#': legacySolidTerrain }, rows: normalizedTerrainRows }),
      gridLayer({ id: 'entities', symbols: { P: legacyPlayerSpawner, E: legacySlimeSpawner, G: legacyFinishGateObject }, rows: objectRows }),
      gridLayer({ id: 'decor', symbols: Object.fromEntries(Object.keys(DECOR_TYPES).map(symbol => [symbol, markerObject(`decor-${symbol}`)])), rows: decorRows }),
      gridLayer({ id: 'hazards', symbols: { '^': markerObject('spike-hazard') }, rows: spikeRows })
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

export function defineTilemapScene(definition) {
  const tileSize = definition.tileSize ?? T;
  const artTileSize = definition.artTileSize ?? (tileSize % DEFAULT_ART_TILE_SIZE === 0 ? DEFAULT_ART_TILE_SIZE : tileSize);
  const artTilesPerTile = tileSize / artTileSize;
  if (!Number.isInteger(artTilesPerTile)) throw new Error(`tileSize ${tileSize} must be an integer multiple of artTileSize ${artTileSize}`);
  if (!Array.isArray(definition.layers) || definition.layers.length === 0) throw new Error('defineTilemapScene requires layers');

  const rows = definition.layers[0].rows.length;
  const cols = definition.layers[0].rows[0].length;
  for (const layer of definition.layers) {
    if (layer.rows.length !== rows) throw new Error(`${layer.id} layer must contain ${rows} rows`);
    layer.rows.forEach((row, index) => { if (row.length !== cols) throw new Error(`${layer.id} layer row ${index} must be ${cols} chars wide`); });
  }

  const scene = {
    ...definition,
    id: definition.id ?? 'anonymous-tilemap-scene',
    kind: definition.kind ?? 'tilemap-scene',
    tileSize,
    artTileSize,
    artTilesPerTile,
    theme: definition.theme ?? DEFAULT_THEME,
    cols,
    rows,
    worldWidth: cols * tileSize,
    worldHeight: rows * tileSize,
    layers: definition.layers.map(layer => ({ ...layer, rows: [...layer.rows], symbols: { ...layer.symbols } }))
  };

  const objects = [];
  for (const layer of scene.layers) {
    layer.rows.forEach((line, row) => [...line].forEach((symbol, col) => {
      if (symbol === EMPTY) return;
      objects.push(objectFromCell(scene, layer, symbol, layer.symbols[symbol], col, row));
    }));
  }
  Object.assign(scene, defineScene({ ...scene, objects: [...objects, ...(definition.objects ?? [])] }));

  const terrainPrimitives = buildTerrainPrimitives(scene);
  // Compatibility fields for current gameplay/render systems.
  // New systems should prefer scene.objects + components + core/scene queries.
  scene.renderLayers = {
    terrainVisuals: buildTerrainVisuals(scene),
    terrainPrimitives,
    terrainCollisionRects: buildTerrainCollisionRects(scene, terrainPrimitives)
  };
  scene.tiles = Object.fromEntries(scene.layers.map(layer => [`${layer.id}Rows`, layer.rows]));
  return scene;
}

function terrainObjects(scene) { return findObjectsWithComponent(scene, 'collision:solid').filter(object => hasComponent(object, 'terrain')); }
function terrainKey(col, row) { return `${col},${row}`; }
function terrainSet(scene) { return new Set(terrainObjects(scene).map(object => terrainKey(object.transform.col, object.transform.row))); }

export function tileToWorld(col, row, tileSize = T) { return { x: col * tileSize, y: row * tileSize }; }
export function worldToTile(x, y, tileSize = T) { return { col: Math.floor(x / tileSize), row: Math.floor(y / tileSize) }; }
export function tileRect(col, row, cols = 1, rows = 1, kind = 'solid', tileSize = T) { const { x, y } = tileToWorld(col, row, tileSize); return { x, y, w: cols * tileSize, h: rows * tileSize, kind, col, row, cols, rows }; }
export function getTile(scene, layerId, col, row) { return scene.layers?.find(layer => layer.id === layerId)?.rows[row]?.[col] ?? EMPTY; }
export function forEachLayerTile(scene, layerId, callback) { scene.layers?.find(layer => layer.id === layerId)?.rows.forEach((line, row) => [...line].forEach((tile, col) => callback(tile, col, row))); }
export function isSolidTileAt(scene, col, row) { return terrainSet(scene).has(terrainKey(col, row)); }
export function isSolidTile(tile) { return tile === '#'; }
export function getDecorType(tile) { return DECOR_TYPES[tile] ?? null; }

export function solidTileRectsOverlapping(scene, rect) {
  if (scene.collisionMode === 'dual-grid') {
    const primitiveRects = scene.renderLayers?.terrainCollisionRects;
    if (primitiveRects?.length) return primitiveRects.filter(hit => rectsOverlap(rect, hit));
  }
  return terrainObjects(scene).map(object => ({ ...object.transform, kind: 'solid' })).filter(hit => rectsOverlap(rect, hit));
}

export function spikeHazardRectsOverlapping(scene, rect) {
  const layer = scene.layers?.find(layer => layer.id === 'hazards');
  if (!layer) return [];
  const hits = [];
  layer.rows.forEach((line, row) => [...line].forEach((tile, col) => {
    if (tile === '^') {
      const hit = tileRect(col, row, 1, 1, 'spike', scene.tileSize);
      if (rectsOverlap(rect, hit)) hits.push(hit);
    }
  }));
  return hits;
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

function spawnAtObject(object, tileSize) { return { x: object.transform.x + tileSize / 2, y: object.transform.y + tileSize - 50 }; }
export function getSpawnPoint(scene) { const [spawn] = instantiatedObjects(scene, 'player'); return spawn ? spawnAtObject(spawn, scene.tileSize) : null; }

function instantiatedObjects(scene, definitionId) {
  return findObjectsWithComponent(scene, 'spawner').filter(object => getComponent(object, 'spawner')?.object?.id === definitionId);
}

function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function clippedWorldRect(rect, scene) { const x = Math.max(0, rect.x); const y = Math.max(0, rect.y); const right = Math.min(scene.worldWidth, rect.x + rect.w); const bottom = Math.min(scene.worldHeight, rect.y + rect.h); return right <= x || bottom <= y ? null : { ...rect, x, y, w: right - x, h: bottom - y }; }
function terrainNoise(col, row, subCol, subRow) { const n = Math.sin((col * 127.1 + row * 311.7 + subCol * 43.3 + subRow * 91.9)) * 43758.5453; return n - Math.floor(n); }
function terrainAssetForSubtile(scene, col, row, subCol, subRow) { const above = isSolidTileAt(scene, col, row - 1); const below = isSolidTileAt(scene, col, row + 1); const left = isSolidTileAt(scene, col - 1, row); const right = isSolidTileAt(scene, col + 1, row); if (!above && !left && subCol === 0 && subRow === 0) return 'topLeft'; if (!above && !right && subCol === 1 && subRow === 0) return 'topRight'; if (!below && !left && subCol === 0 && subRow === 1) return 'bottomLeft'; if (!below && !right && subCol === 1 && subRow === 1) return 'bottomRight'; if (!above && subRow === 0) return 'top'; if (!below && subRow === 1) return 'bottom'; if (!left && subCol === 0) return 'left'; if (!right && subCol === 1) return 'right'; return terrainNoise(col, row, subCol, subRow) > 0.52 ? 'fillAlt' : 'fill'; }
function buildTerrainVisuals(scene) { const visuals = []; const art = scene.artTileSize; for (const object of terrainObjects(scene)) { const { col, row } = object.transform; for (let subRow = 0; subRow < scene.artTilesPerTile; subRow++) for (let subCol = 0; subCol < scene.artTilesPerTile; subCol++) visuals.push({ layer: 'terrain', theme: scene.theme, assetKey: terrainAssetForSubtile(scene, col, row, subCol, subRow), x: col * scene.tileSize + subCol * art, y: row * scene.tileSize + subRow * art, w: art, h: art, col, row, subCol, subRow }); } return visuals; }
function terrainPrimitiveAssetForMask(mask) { if (mask === 15) return 'fill'; if (mask === 1) return 'bottomRight'; if (mask === 2) return 'bottomLeft'; if (mask === 4) return 'topRight'; if (mask === 8) return 'topLeft'; if ((mask & 3) === 3 && (mask & 12) === 0) return 'bottom'; if ((mask & 12) === 12 && (mask & 3) === 0) return 'top'; if ((mask & 5) === 5 && (mask & 10) === 0) return 'right'; if ((mask & 10) === 10 && (mask & 5) === 0) return 'left'; if (mask === 7) return 'bottomRight'; if (mask === 11) return 'bottomLeft'; if (mask === 13) return 'topRight'; if (mask === 14) return 'topLeft'; return terrainNoise(mask, mask, 0, 0) > 0.5 ? 'fillAlt' : 'fill'; }
function buildTerrainPrimitives(scene) { const primitives = []; for (let row = 0; row <= scene.rows; row++) for (let col = 0; col <= scene.cols; col++) { const nw = isSolidTileAt(scene, col - 1, row - 1) ? 1 : 0; const ne = isSolidTileAt(scene, col, row - 1) ? 2 : 0; const sw = isSolidTileAt(scene, col - 1, row) ? 4 : 0; const se = isSolidTileAt(scene, col, row) ? 8 : 0; const mask = nw | ne | sw | se; if (mask === 0) continue; primitives.push({ layer: 'terrain', theme: scene.theme, mask, assetKey: terrainPrimitiveAssetForMask(mask), x: (col - 0.5) * scene.tileSize, y: (row - 0.5) * scene.tileSize, w: scene.tileSize, h: scene.tileSize, col, row, offsetGrid: true }); } return primitives; }
function buildTerrainCollisionRects(scene, primitives) { return primitives.map(primitive => clippedWorldRect({ x: primitive.x, y: primitive.y, w: primitive.w, h: primitive.h, col: primitive.col, row: primitive.row, mask: primitive.mask, kind: 'dual-grid-solid' }, scene)).filter(Boolean); }

function deriveEnemyPatrol(scene, col, row) { const floorRow = row + 1; let minCol = col; while (minCol > 0 && !isSolidTileAt(scene, minCol - 1, row) && isSolidTileAt(scene, minCol - 1, floorRow)) minCol--; let maxExclusiveCol = col + 1; while (maxExclusiveCol < scene.cols && !isSolidTileAt(scene, maxExclusiveCol, row) && isSolidTileAt(scene, maxExclusiveCol, floorRow)) maxExclusiveCol++; return { floorRow, minCol, maxExclusiveCol }; }
export function createPlayer(spawn) { if (!spawn) throw new Error('createPlayer requires a spawn point'); return { x: spawn.x, y: spawn.y, w: 34, h: 50, vx: 0, vy: 0, dir: 1, grounded: false, hp: 5, inv: 0, attack: 0, coyote: 0, jumpBuf: 0, dash: 0, dashCooldown: 0, wallDir: 0, wallSlide: false, dead: false }; }
export function createEnemies(scene) { return instantiatedObjects(scene, 'slime').map((object, index) => { const patrol = deriveEnemyPatrol(scene, object.transform.col, object.transform.row); const dir = index % 2 === 0 ? 1 : -1; const hp = index === 0 ? 2 : 3; return { x: object.transform.x + 14, y: patrol.floorRow * scene.tileSize - 38, w: 42, h: 38, vx: dir * 55, hp, hurt: 0, min: patrol.minCol * scene.tileSize, max: patrol.maxExclusiveCol * scene.tileSize }; }); }
export const createEnemySpawns = createEnemies;
