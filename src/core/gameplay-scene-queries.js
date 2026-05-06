import { getComponent, findObjectsWithComponent } from '../engine/scene/queries.js';

export const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function hasComponent(object, type) { return object.components?.some(component => component.type === type); }
function terrainKey(col, row) { return `${col},${row}`; }
function solidTerrainObjects(scene) { return findObjectsWithComponent(scene, 'collision:solid').filter(object => hasComponent(object, 'terrain')); }
function solidTerrainSet(scene) { return new Set(solidTerrainObjects(scene).map(object => terrainKey(object.transform.col, object.transform.row))); }
function isSolidAt(scene, col, row) { return solidTerrainSet(scene).has(terrainKey(col, row)); }

function spawnAtObject(object, tileSize) { return { x: object.transform.x + tileSize / 2, y: object.transform.y + tileSize - 50 }; }

export function findSpawnerObjects(scene, definitionId) {
  return findObjectsWithComponent(scene, 'spawner').filter(object => getComponent(object, 'spawner')?.object?.id === definitionId);
}

export function getPlayerSpawnPoint(scene) {
  const [spawn] = findSpawnerObjects(scene, 'player');
  return spawn ? spawnAtObject(spawn, scene.tileSize) : null;
}

export function createPlayerFromScene(scene) {
  const spawn = getPlayerSpawnPoint(scene);
  if (!spawn) throw new Error('createPlayerFromScene requires a player spawner');
  return { x: spawn.x, y: spawn.y, w: 34, h: 50, vx: 0, vy: 0, dir: 1, grounded: false, hp: 5, inv: 0, attack: 0, coyote: 0, jumpBuf: 0, dash: 0, dashCooldown: 0, wallDir: 0, wallSlide: false, dead: false };
}

function deriveEnemyPatrol(scene, col, row) {
  const floorRow = row + 1;
  let minCol = col;
  while (minCol > 0 && !isSolidAt(scene, minCol - 1, row) && isSolidAt(scene, minCol - 1, floorRow)) minCol--;
  let maxExclusiveCol = col + 1;
  while (maxExclusiveCol < scene.cols && !isSolidAt(scene, maxExclusiveCol, row) && isSolidAt(scene, maxExclusiveCol, floorRow)) maxExclusiveCol++;
  return { floorRow, minCol, maxExclusiveCol };
}

export function createEnemiesFromScene(scene) {
  return findSpawnerObjects(scene, 'slime').map((object, index) => {
    const patrol = deriveEnemyPatrol(scene, object.transform.col, object.transform.row);
    const dir = index % 2 === 0 ? 1 : -1;
    const hp = index === 0 ? 2 : 3;
    return { x: object.transform.x + 14, y: patrol.floorRow * scene.tileSize - 38, w: 42, h: 38, vx: dir * 55, hp, hurt: 0, min: patrol.minCol * scene.tileSize, max: patrol.maxExclusiveCol * scene.tileSize };
  });
}

export function solidCollisionRectsOverlapping(scene, rect) {
  if (scene.collisionMode === 'dual-grid') {
    const primitiveRects = scene.renderLayers?.terrainCollisionRects;
    if (primitiveRects?.length) return primitiveRects.filter(hit => rectsOverlap(rect, hit));
  }
  return findObjectsWithComponent(scene, 'collision:solid').map(object => ({ ...object.transform, kind: 'solid' })).filter(hit => rectsOverlap(rect, hit));
}

export function hazardCollisionRectsOverlapping(scene, rect, kind = null) {
  return findObjectsWithComponent(scene, 'collision:hazard')
    .map(object => ({ object, hazard: getComponent(object, 'collision:hazard') }))
    .filter(({ hazard }) => !kind || hazard?.kind === kind)
    .map(({ object, hazard }) => ({ ...object.transform, kind: hazard?.kind ?? 'hazard', damage: hazard?.damage ?? 1 }))
    .filter(hit => rectsOverlap(rect, hit));
}

function objectTransitionKind(object) {
  return getComponent(object, 'transition')?.kind ?? getComponent(object, 'spawner')?.object?.components?.find(component => component.type === 'transition')?.kind;
}

function transitionObjects(scene, kind = 'finish') {
  return [
    ...findObjectsWithComponent(scene, 'transition'),
    ...findObjectsWithComponent(scene, 'spawner')
  ].filter((object, index, objects) => objects.indexOf(object) === index && objectTransitionKind(object) === kind);
}

export function getTransitionRect(scene, kind = 'finish') {
  const goals = transitionObjects(scene, kind);
  if (!goals.length) return { x: 0, y: 0, w: 0, h: 0, cols: 0, rows: 0, kind };
  const minCol = Math.min(...goals.map(o => o.transform.col));
  const maxCol = Math.max(...goals.map(o => o.transform.col));
  const minRow = Math.min(...goals.map(o => o.transform.row));
  const maxRow = Math.max(...goals.map(o => o.transform.row));
  return { x: minCol * scene.tileSize, y: minRow * scene.tileSize, w: (maxCol - minCol + 1) * scene.tileSize, h: (maxRow - minRow + 1) * scene.tileSize, col: minCol, row: minRow, cols: maxCol - minCol + 1, rows: maxRow - minRow + 1, kind };
}

export function getTransitionTriggerRect(scene, kind = 'finish') {
  const goal = getTransitionRect(scene, kind);
  const pad = scene.tileSize / 2;
  return { ...goal, x: goal.x - pad, w: goal.w + pad * 2, h: goal.h + scene.tileSize, kind: `${kind}-trigger` };
}
