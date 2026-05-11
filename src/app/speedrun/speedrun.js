/**
 * Application speedrun state and game-object glue.
 * Pure record normalization, categories, and formatting live in `src/core/speedrun/records.js`.
 */
import {
  ANY_PERCENT,
  SPEEDRUN_RECORDS_KEY,
  defaultSpeedRunRecords,
  formatRunTime,
  getBestTime,
  normalizeSpeedRunRecords,
  recordAnyPercentTime as recordAnyPercentTimeInCore
} from '#/core/speedrun/records.js';

export { ANY_PERCENT, SPEEDRUN_RECORDS_KEY, defaultSpeedRunRecords, formatRunTime, getBestTime, normalizeSpeedRunRecords };

export function loadSpeedRunRecords(storage) {
  try {
    const raw = storage.getItem(SPEEDRUN_RECORDS_KEY);
    return raw ? normalizeSpeedRunRecords(JSON.parse(raw)) : defaultSpeedRunRecords();
  } catch (err) {
    console.warn('Falling back to default speed run records:', err);
    return defaultSpeedRunRecords();
  }
}

export function saveSpeedRunRecords(state, storage = state.storage) {
  state.records = normalizeSpeedRunRecords(state.records);
  storage?.setItem(SPEEDRUN_RECORDS_KEY, JSON.stringify(state.records));
  return state.records;
}

export function createSpeedRunState(storage) {
  return {
    storage,
    records: loadSpeedRunRecords(storage),
    attempt: createIdleAttempt(),
    lastResult: null
  };
}

function createIdleAttempt() {
  return { status: 'idle', tilemapId: null, elapsedMs: 0, pausedDuringRun: false, enemyTotal: 0, enemyKills: 0 };
}

export function recordAnyPercentTime(state, tilemapId, elapsedMs, runtime = {}) {
  return recordAnyPercentTimeInCore(state, tilemapId, elapsedMs, {
    save: () => saveSpeedRunRecords(state, runtime.storage || state.storage)
  });
}

export function clearSpeedRunRecords(state, storage = state.storage) {
  state.records = defaultSpeedRunRecords();
  storage?.setItem(SPEEDRUN_RECORDS_KEY, JSON.stringify(state.records));
  state.lastResult = null;
  return state.records;
}

export function prepareSpeedRunAttempt(game) {
  if (!game.speedRun) return null;
  game.speedRun.lastResult = null;
  const tilemapId = game.tilemap?.id || null;
  game.speedRun.attempt = {
    status: game.settings?.speedRunMode ? 'ready' : 'idle',
    tilemapId,
    elapsedMs: 0,
    pausedDuringRun: false,
    enemyTotal: game.enemies?.filter(enemy => enemy.hp > 0).length ?? 0,
    enemyKills: 0
  };
  return game.speedRun.attempt;
}

export function invalidateSpeedRunAttempt(game) {
  if (!game.speedRun?.attempt) return;
  if (['ready', 'running'].includes(game.speedRun.attempt.status)) game.speedRun.attempt.status = 'invalid';
}

export function markSpeedRunPaused(game) {
  const attempt = game.speedRun?.attempt;
  if (attempt && ['ready', 'running'].includes(attempt.status)) attempt.pausedDuringRun = true;
}

export function updateSpeedRun(game, dt, runtime = game.runtime) {
  const state = game.speedRun;
  const attempt = state?.attempt;
  if (!state || !attempt) return null;
  if (!game.settings?.speedRunMode) { invalidateSpeedRunAttempt(game); return null; }
  if (attempt.status === 'idle') return null;
  if (game.player?.dead) { invalidateSpeedRunAttempt(game); return null; }
  attempt.enemyKills = Math.max(0, attempt.enemyTotal - (game.enemies?.filter(enemy => enemy.hp > 0).length ?? 0));
  if (attempt.status === 'ready') attempt.status = 'running';
  if (attempt.status === 'running') attempt.elapsedMs += Math.max(0, dt * 1000);
  if (game.gameplaySession?.outcome === 'completed') return completeSpeedRunAttempt(game, runtime);
  return attempt;
}

export function completeSpeedRunAttempt(game, runtime = game.runtime) {
  const state = game.speedRun;
  const attempt = state?.attempt;
  if (!attempt || !['ready', 'running'].includes(attempt.status)) return state?.lastResult ?? null;
  attempt.status = 'completed';
  const tilemapId = attempt.tilemapId || game.tilemap?.id;
  if (game.scenarios?.current?.source === 'local') {
    state.lastResult = { isNewBest: false, bestMs: Math.max(0, Math.round(attempt.elapsedMs)), previousBestMs: null, tilemapId, category: ANY_PERCENT, pausedDuringRun: attempt.pausedDuringRun, enemyTotal: attempt.enemyTotal, enemyKills: attempt.enemyKills, recorded: false };
    return state.lastResult;
  }
  const result = recordAnyPercentTime(state, tilemapId, attempt.elapsedMs, runtime);
  state.lastResult = { ...result, tilemapId, category: ANY_PERCENT, pausedDuringRun: attempt.pausedDuringRun, enemyTotal: attempt.enemyTotal, enemyKills: attempt.enemyKills };
  return state.lastResult;
}
