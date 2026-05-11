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
    runtime.save?.(state.records);
  }
  return { isNewBest, bestMs, previousBestMs: previous };
}
