import { ACTOR_SIZE, CELL_SIZE } from './constants.js';
import { getComponent, findObjectsWithComponent } from '../engine/scene/queries.js';

export const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function spawnAtObject(object, tileSize) { return { x: object.transform.x + tileSize / 2, y: object.transform.y + tileSize - ACTOR_SIZE.PLAYER.h }; }

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
  return { x: spawn.x, y: spawn.y, ...ACTOR_SIZE.PLAYER, vx: 0, vy: 0, dir: 1, grounded: false, hp: 5, inv: 0, attack: 0, coyote: 0, jumpBuf: 0, dash: 0, dashCooldown: 0, wallDir: 0, wallSlide: false, dead: false };
}

const ENEMY_SPAWN_OFFSET_X = 12;
const PATROL_STEP = CELL_SIZE.TERRAIN_PRIMITIVE;
const FLOOR_PROBE_HEIGHT = 2;
const FLOOR_PROBE_INSET = 2;

function hasSolidOverlap(scene, rect) { return solidCollisionRectsOverlapping(scene, rect).length > 0; }
function supportedFootRect(rect) { return { x: rect.x + FLOOR_PROBE_INSET, y: rect.y + rect.h, w: Math.max(1, rect.w - FLOOR_PROBE_INSET * 2), h: FLOOR_PROBE_HEIGHT }; }
function hasFloorSupport(scene, rect) { return hasSolidOverlap(scene, supportedFootRect(rect)); }
function actorRectAt(x, y, actorSize) { return { x, y, w: actorSize.w, h: actorSize.h }; }

function findGroundBelow(scene, rect) {
  const probe = { x: rect.x, y: rect.y, w: rect.w, h: scene.worldHeight - rect.y };
  return solidCollisionRectsOverlapping(scene, probe)
    .filter(hit => hit.y >= rect.y)
    .sort((a, b) => a.y - b.y)[0] ?? null;
}

function deriveEnemyPatrol(scene, object, actorSize) {
  const x = object.transform.x + ENEMY_SPAWN_OFFSET_X;
  const spawnRect = actorRectAt(x, object.transform.y, actorSize);
  const ground = findGroundBelow(scene, spawnRect);
  const y = ground ? ground.y - actorSize.h : object.transform.y;
  const start = actorRectAt(x, y, actorSize);

  let min = x;
  while (min - PATROL_STEP >= 0) {
    const candidate = actorRectAt(min - PATROL_STEP, y, actorSize);
    if (hasSolidOverlap(scene, candidate) || !hasFloorSupport(scene, candidate)) break;
    min -= PATROL_STEP;
  }

  let max = x + actorSize.w;
  while (max + PATROL_STEP <= scene.worldWidth) {
    const candidate = actorRectAt(max + PATROL_STEP - actorSize.w, y, actorSize);
    if (hasSolidOverlap(scene, candidate) || !hasFloorSupport(scene, candidate)) break;
    max += PATROL_STEP;
  }

  if (max - min < actorSize.w) {
    min = start.x;
    max = start.x + actorSize.w;
  }

  return { x, y, min, max };
}

export function createEnemiesFromScene(scene) {
  return findSpawnerObjects(scene, 'slime').map((object, index) => {
    const patrol = deriveEnemyPatrol(scene, object, ACTOR_SIZE.SLIME);
    const dir = index % 2 === 0 ? 1 : -1;
    const hp = index === 0 ? 2 : 3;
    return { x: patrol.x, y: patrol.y, ...ACTOR_SIZE.SLIME, vx: dir * 55, hp, hurt: 0, min: patrol.min, max: patrol.max };
  });
}

export function solidCollisionRectsOverlapping(scene, rect) {
  const collisionRects = scene.collisionLayers?.terrainRects;
  if (collisionRects?.length) return collisionRects.filter(hit => rectsOverlap(rect, hit));
  /** @deprecated TODO(new-terrain): delete legacy renderLayers collision fallback after all terrain modes use collisionLayers. */
  const legacyCollisionRects = scene.renderLayers?.terrainCollisionRects;
  if (legacyCollisionRects?.length) return legacyCollisionRects.filter(hit => rectsOverlap(rect, hit));
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
