import { ACTOR_SIZE, CELL_SIZE, GRID_SIZE, TERRAIN_PRIMITIVE_SIZE } from '../constants.js';
import { defineScene } from '../../engine/scene/scene.js';
import { createEnemiesFromScene } from '../gameplay-scene-queries.js';
import { sceneObject } from '../../engine/scene/objects.js';
import { getComponent, findObjectsWithComponent } from '../../engine/scene/queries.js';
import { TERRAIN_MASK, normalizeTerrainMask } from './terrain-mask.js';

const DECOR_TYPES = { r: 'bannerRed', g: 'bannerGreen', f: 'flag', t: 'torch' };
const T = GRID_SIZE;
const DEFAULT_ART_TILE_SIZE = CELL_SIZE.BUILD;
const TERRAIN_RENDER_MODE = 'contained-autotile';
const DEFAULT_THEME = 'contained-terrain:grass';
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

function validateTerrainDefinition(definition) {
  if (definition.terrainRenderMode !== undefined && definition.terrainRenderMode !== TERRAIN_RENDER_MODE) {
    throw new Error(`terrainRenderMode must be ${TERRAIN_RENDER_MODE}`);
  }
  for (const layer of definition.layers) {
    if (layer.id === 'terrain') throw new Error('terrain layer is not supported; use buildTerrain');
    if (layer.id === 'buildTerrain' && layer.cellSize !== CELL_SIZE.BUILD) throw new Error('buildTerrain layer must use CELL_SIZE.BUILD');
  }
}

export function defineTilemap(definition) {
  const tileSize = GRID_SIZE;
  const artTileSize = definition.artTileSize ?? DEFAULT_ART_TILE_SIZE;
  const artTilesPerTile = tileSize / artTileSize;
  if (!Number.isInteger(artTilesPerTile)) throw new Error(`gridSize ${tileSize} must be an integer multiple of artTileSize ${artTileSize}`);
  if (!Number.isInteger(definition.cols) || definition.cols < 1) throw new Error('defineTilemap requires positive integer cols');
  if (!Number.isInteger(definition.rows) || definition.rows < 1) throw new Error('defineTilemap requires positive integer rows');
  if (!Array.isArray(definition.layers) || definition.layers.length === 0) throw new Error('defineTilemap requires layers');
  validateTerrainDefinition(definition);

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
    terrainRenderMode: TERRAIN_RENDER_MODE,
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

  scene.collisionLayers = buildContainedTerrainCollisionLayers(scene);
  scene.renderLayers = { containedTerrainTiles: buildContainedTerrainTiles(scene) };
  scene.tiles = Object.fromEntries(scene.layers.map(layer => [`${layer.id}Rows`, layer.rows]));
  return scene;
}

function terrainObjects(scene) { return findObjectsWithComponent(scene, 'collision:solid').filter(object => hasComponent(object, 'terrain')); }
function terrainLayer(scene) { return scene.layers?.find(layer => layer.id === 'buildTerrain') ?? null; }
function terrainCellSize(scene) { return terrainLayer(scene)?.cellSize ?? terrainObjects(scene)[0]?.transform?.cellSize ?? CELL_SIZE.BUILD; }
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
  const cellsPerTile = scene.tileSize / cell;
  const startCol = col * cellsPerTile;
  const startRow = row * cellsPerTile;
  for (let y = 0; y < cellsPerTile; y++) for (let x = 0; x < cellsPerTile; x++) if (isSolidTerrainCellAt(scene, startCol + x, startRow + y)) return true;
  return false;
}
export function isSolidTile(tile) { return tile === '#'; }
export function getDecorType(tile) { return DECOR_TYPES[tile] ?? null; }

export function solidTileRectsOverlapping(scene, rect) {
  const collisionRects = scene.collisionLayers?.terrainRects ?? [];
  if (collisionRects.length) return collisionRects.filter(hit => rectsOverlap(rect, hit));
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
function greedyMergeAabbs2D(width, height, isSolid) { const visited = new Uint8Array(width * height); const boxes = []; const index = (x, y) => y * width + x; const canUse = (x, y) => x >= 0 && x < width && y >= 0 && y < height && visited[index(x, y)] === 0 && isSolid(x, y); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { if (!canUse(x, y)) continue; let boxWidth = 1; while (canUse(x + boxWidth, y)) boxWidth++; let boxHeight = 1; while (y + boxHeight < height) { let rowMatches = true; for (let xx = x; xx < x + boxWidth; xx++) if (!canUse(xx, y + boxHeight)) { rowMatches = false; break; } if (!rowMatches) break; boxHeight++; } for (let yy = y; yy < y + boxHeight; yy++) for (let xx = x; xx < x + boxWidth; xx++) visited[index(xx, yy)] = 1; boxes.push({ x, y, w: boxWidth, h: boxHeight }); } return boxes; }
function buildContainedTerrainCollisionPrimitives(scene) { const primitives = []; for (const object of terrainObjects(scene)) { const startCol = Math.floor(object.transform.x / TERRAIN_PRIMITIVE_SIZE); const startRow = Math.floor(object.transform.y / TERRAIN_PRIMITIVE_SIZE); const primitiveCols = object.transform.w / TERRAIN_PRIMITIVE_SIZE; const primitiveRows = object.transform.h / TERRAIN_PRIMITIVE_SIZE; for (let row = 0; row < primitiveRows; row++) for (let col = 0; col < primitiveCols; col++) primitives.push({ x: (startCol + col) * TERRAIN_PRIMITIVE_SIZE, y: (startRow + row) * TERRAIN_PRIMITIVE_SIZE, w: TERRAIN_PRIMITIVE_SIZE, h: TERRAIN_PRIMITIVE_SIZE, col: startCol + col, row: startRow + row, kind: 'terrain-primitive' }); } return primitives; }
function buildContainedTerrainCollisionLayers(scene) { const terrainPrimitives = buildContainedTerrainCollisionPrimitives(scene); const solids = new Set(terrainPrimitives.map(cell => terrainKey(cell.col, cell.row))); const cols = Math.floor(scene.worldWidth / TERRAIN_PRIMITIVE_SIZE); const rows = Math.floor(scene.worldHeight / TERRAIN_PRIMITIVE_SIZE); return { terrainPrimitives, terrainRects: greedyMergeAabbs2D(cols, rows, (col, row) => solids.has(terrainKey(col, row))).map(box => clippedWorldRect({ x: box.x * TERRAIN_PRIMITIVE_SIZE, y: box.y * TERRAIN_PRIMITIVE_SIZE, w: box.w * TERRAIN_PRIMITIVE_SIZE, h: box.h * TERRAIN_PRIMITIVE_SIZE, col: box.x, row: box.y, cols: box.w, rows: box.h, kind: 'terrain-solid' }, scene)).filter(Boolean) }; }
function buildTerrainNeighborMask(scene, col, row) { let mask = 0; const bit = (dx, dy, value) => isSolidTerrainCellAt(scene, col + dx, row + dy) ? value : 0; mask |= bit(0, -1, TERRAIN_MASK.N); mask |= bit(1, -1, TERRAIN_MASK.NE); mask |= bit(1, 0, TERRAIN_MASK.E); mask |= bit(1, 1, TERRAIN_MASK.SE); mask |= bit(0, 1, TERRAIN_MASK.S); mask |= bit(-1, 1, TERRAIN_MASK.SW); mask |= bit(-1, 0, TERRAIN_MASK.W); mask |= bit(-1, -1, TERRAIN_MASK.NW); return mask; }
function buildContainedTerrainTiles(scene) { return terrainObjects(scene).map(object => { const rawMask = buildTerrainNeighborMask(scene, object.transform.col, object.transform.row); return { layer: 'buildTerrain', x: object.transform.x, y: object.transform.y, w: object.transform.w, h: object.transform.h, col: object.transform.col, row: object.transform.row, rawMask, mask: normalizeTerrainMask(rawMask) }; }); }

export function createPlayer(spawn) { if (!spawn) throw new Error('createPlayer requires a spawn point'); return { x: spawn.x, y: spawn.y, ...ACTOR_SIZE.PLAYER, vx: 0, vy: 0, dir: 1, grounded: false, hp: 5, inv: 0, attack: 0, coyote: 0, jumpBuf: 0, dash: 0, dashCooldown: 0, wallDir: 0, wallSlide: false, dead: false }; }
export function createEnemies(scene) { return createEnemiesFromScene(scene); }
export const createEnemySpawns = createEnemies;
