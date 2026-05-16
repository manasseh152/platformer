import { ACTOR_SIZE, GRID_SIZE } from '../constants.js';
import { createEnemiesFromScene } from '../gameplay-scene-queries.js';
import { getComponent, findObjectsWithComponent } from '../../engine/scene/queries.js';
import { terrainKindConfig } from './terrain-layer.js';
import { EMPTY } from './layers.js';
import { rectsOverlap } from './collision.js';
import { isSolidTerrainCellAt, terrainCellSize } from './terrain-model.js';

const DECOR_TYPES = { r: 'bannerRed', g: 'bannerGreen', f: 'flag', t: 'torch' };
const T = GRID_SIZE;

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
  return (scene.terrain?.cells ?? [])
    .filter(cell => terrainKindConfig(cell.kind)?.solid)
    .map(cell => ({ x: cell.x, y: cell.y, w: cell.w, h: cell.h, col: cell.col, row: cell.row, kind: 'solid', terrainKind: cell.kind }))
    .filter(hit => rectsOverlap(rect, hit));
}

function insetRect(rect, inset = {}) {
  const left = inset.left ?? 0;
  const right = inset.right ?? 0;
  const top = inset.top ?? 0;
  const bottom = inset.bottom ?? 0;
  return {
    ...rect,
    x: rect.x + left,
    y: rect.y + top,
    w: Math.max(0, rect.w - left - right),
    h: Math.max(0, rect.h - top - bottom)
  };
}

export function spikeHazardRectsOverlapping(scene, rect) {
  return findObjectsWithComponent(scene, 'collision:hazard')
    .map(object => ({ object, hazard: getComponent(object, 'collision:hazard') }))
    .filter(({ hazard }) => hazard?.kind === 'spike')
    .map(({ object, hazard }) => ({ ...insetRect(object.transform, hazard?.inset), kind: 'spike' }))
    .filter(hit => rectsOverlap(rect, hit));
}

export function getGoalRect(scene) {
  const goals = instantiatedObjects(scene, 'finish-gate');
  if (!goals.length) return { x: 0, y: 0, w: 0, h: 0, cols: 0, rows: 0, kind: 'gate' };
  const minX = Math.min(...goals.map(o => o.transform.x));
  const minY = Math.min(...goals.map(o => o.transform.y));
  const maxX = Math.max(...goals.map(o => o.transform.x + o.transform.w));
  const maxY = Math.max(...goals.map(o => o.transform.y + o.transform.h));
  const w = maxX - minX;
  const h = maxY - minY;
  return { x: minX, y: minY, w, h, col: Math.floor(minX / scene.tileSize), row: Math.floor(minY / scene.tileSize), cols: Math.ceil(w / scene.tileSize), rows: Math.ceil(h / scene.tileSize), kind: 'gate' };
}

export function getGoalTriggerRect(scene) { const goal = getGoalRect(scene); const pad = scene.tileSize / 2; return { ...goal, x: goal.x - pad, w: goal.w + pad * 2, h: goal.h + scene.tileSize, kind: 'gate-trigger' }; }

function spawnAtObject(object) { return { x: object.transform.x + object.transform.w / 2, y: object.transform.y + object.transform.h - ACTOR_SIZE.PLAYER.h }; }
export function getSpawnPoint(scene) { const [spawn] = instantiatedObjects(scene, 'player'); return spawn ? spawnAtObject(spawn) : null; }

function instantiatedObjects(scene, definitionId) {
  return findObjectsWithComponent(scene, 'spawner').filter(object => getComponent(object, 'spawner')?.object?.id === definitionId);
}

export function createPlayer(spawn) { if (!spawn) throw new Error('createPlayer requires a spawn point'); return { x: spawn.x, y: spawn.y, ...ACTOR_SIZE.PLAYER, vx: 0, vy: 0, dir: 1, grounded: false, hp: 5, inv: 0, attack: 0, coyote: 0, jumpBuf: 0, dash: 0, dashCooldown: 0, wallDir: 0, wallSlide: false, dead: false }; }
export function createEnemies(scene) { return createEnemiesFromScene(scene); }
export const createEnemySpawns = createEnemies;
