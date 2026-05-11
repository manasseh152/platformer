import { expect, test } from '@playwright/test';
import { defaultSettings, normalizeSettings } from '#/core/settings.js';
import { createMemoryStorage, createRuntime } from '#/app/runtime/browser-runtime.js';
import { clearSpeedRunRecords, createSpeedRunState, formatRunTime, getBestTime, prepareSpeedRunAttempt, recordAnyPercentTime, SPEEDRUN_RECORDS_KEY, updateSpeedRun } from '#/app/speedrun/speedrun.js';

test('settings include speed run mode and normalize legacy settings', () => {
  expect(defaultSettings().speedRunMode).toBe(false);
  expect(normalizeSettings({ speedRunMode: true }).speedRunMode).toBe(true);
  expect(normalizeSettings({}).speedRunMode).toBe(false);
});

test('speedrun records only replace Any% best with faster times', () => {
  const storage = createMemoryStorage();
  const runtime = createRuntime({ now: () => 1000, storage });
  const state = createSpeedRunState(storage);

  expect(getBestTime(state, 'act-01-level-1')).toBeNull();
  expect(recordAnyPercentTime(state, 'act-01-level-1', 12345, runtime).isNewBest).toBe(true);
  expect(recordAnyPercentTime(state, 'act-01-level-1', 13000, runtime).isNewBest).toBe(false);
  expect(recordAnyPercentTime(state, 'act-01-level-1', 12000, runtime).isNewBest).toBe(true);
  expect(getBestTime(state, 'act-01-level-1')).toBe(12000);
  expect(JSON.parse(storage.getItem(SPEEDRUN_RECORDS_KEY)).records['act-01-level-1'].anyPercent.bestMs).toBe(12000);
});

test('speedrun timer completes an Any% attempt and saves the best for the level', () => {
  const storage = createMemoryStorage();
  const runtime = createRuntime({ storage });
  const game = {
    runtime,
    settings: { speedRunMode: true },
    tilemap: { id: 'act-01-level-1' },
    gameplaySession: { outcome: 'active' },
    player: { dead: false },
    enemies: [{ hp: 1 }, { hp: 0 }],
    speedRun: createSpeedRunState(storage)
  };

  prepareSpeedRunAttempt(game);
  updateSpeedRun(game, 1.25, runtime);
  game.gameplaySession.outcome = 'completed';
  const result = updateSpeedRun(game, 0.5, runtime);

  expect(result.isNewBest).toBe(true);
  expect(result.bestMs).toBe(1750);
  expect(result.enemyTotal).toBe(1);
  expect(getBestTime(game.speedRun, 'act-01-level-1')).toBe(1750);
});

test('speedrun record helpers format and clear local records', () => {
  const storage = createMemoryStorage();
  const runtime = createRuntime({ storage });
  const state = createSpeedRunState(storage);

  recordAnyPercentTime(state, 'level', 3723456, runtime);
  expect(formatRunTime(12345)).toBe('0:12.345');
  expect(formatRunTime(3723456)).toBe('1:02:03.456');
  clearSpeedRunRecords(state, storage);
  expect(getBestTime(state, 'level')).toBeNull();
  expect(storage.getItem(SPEEDRUN_RECORDS_KEY)).toContain('"records":{}');
});
