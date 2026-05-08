export const SPEEDRUN_RECORDS_KEY = 'chibi.speedrun.records';
export const ANY_PERCENT = 'anyPercent';

export function defaultSpeedRunRecords() {
  return { schemaVersion: 1, records: {} };
}

export function normalizeSpeedRunRecords(candidate = {}) {
  const output = defaultSpeedRunRecords();
  const records = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate.records : null;
  if (!records || typeof records !== 'object' || Array.isArray(records)) return output;
  for (const [tilemapId, tilemapRecords] of Object.entries(records)) {
    const anyPercent = tilemapRecords?.[ANY_PERCENT];
    if (!anyPercent || !Number.isFinite(anyPercent.bestMs) || anyPercent.bestMs < 0) continue;
    output.records[tilemapId] = {
      [ANY_PERCENT]: {
        bestMs: Math.round(anyPercent.bestMs),
        completedAt: typeof anyPercent.completedAt === 'string' ? anyPercent.completedAt : null
      }
    };
  }
  return output;
}

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

export function formatRunTime(ms) {
  if (!Number.isFinite(ms)) return '--:--.---';
  const total = Math.max(0, Math.floor(ms));
  const milli = String(total % 1000).padStart(3, '0');
  const totalSeconds = Math.floor(total / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes >= 60) {
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${Math.floor(totalMinutes / 60)}:${minutes}:${seconds}.${milli}`;
  }
  return `${totalMinutes}:${seconds}.${milli}`;
}

export function getBestTime(state, tilemapId, category = ANY_PERCENT) {
  return state.records.records[tilemapId]?.[category]?.bestMs ?? null;
}

export function recordAnyPercentTime(state, tilemapId, elapsedMs, runtime = {}) {
  const bestMs = Math.max(0, Math.round(elapsedMs));
  const previous = getBestTime(state, tilemapId);
  const isNewBest = previous === null || bestMs < previous;
  if (isNewBest) {
    state.records.records[tilemapId] = {
      ...(state.records.records[tilemapId] || {}),
      [ANY_PERCENT]: { bestMs, completedAt: new Date().toISOString() }
    };
    saveSpeedRunRecords(state, runtime.storage || state.storage);
  }
  return { isNewBest, bestMs, previousBestMs: previous };
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
