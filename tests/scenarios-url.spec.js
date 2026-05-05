import { expect, test } from '@playwright/test';
import { applyScenarioLaunchParams, readScenarioLaunchParams } from '../src/scenarios/url.js';
import { createRuntime } from '../src/runtime.js';
import { createScenarioService } from '../src/scenarios/service.js';

function makeGame() {
  const runtime = createRuntime({ now: () => 200 });
  const calls = [];
  const game = {
    runtime,
    settings: { developerMode: false },
    session: { developerModeOverride: false },
    levels: {
      switchLevel: id => {
        calls.push(id);
        return { ok: true, level: { id } };
      }
    }
  };
  game.scenarios = createScenarioService(game, runtime);
  game.calls = calls;
  return game;
}

test('scenario URL params parse scenario, developer mode override, and autorun', () => {
  expect(readScenarioLaunchParams('?mode=developer&scenario=finish-gate-gym&autorun=1')).toEqual({
    scenarioId: 'finish-gate-gym',
    developerModeOverride: true,
    autorun: true
  });
  expect(readScenarioLaunchParams('?developerMode=1')).toMatchObject({ developerModeOverride: true });
});

test('scenario URL preselects without launching by default', () => {
  const game = makeGame();
  const result = applyScenarioLaunchParams(game, readScenarioLaunchParams('?scenario=act-01-level-1'), game.runtime);

  expect(result).toMatchObject({ ok: true, scenario: { id: 'act-01-level-1' } });
  expect(game.scenarios.selectedScenarioId).toBe('act-01-level-1');
  expect(game.scenarios.current).toBeNull();
  expect(game.calls).toEqual([]);
});

test('scenario URL autorun launches developer scenarios when mode override is set', () => {
  const game = makeGame();
  const result = applyScenarioLaunchParams(game, readScenarioLaunchParams('?mode=developer&scenario=legacy-movement-lab&autorun=1'), game.runtime);

  expect(result).toMatchObject({ ok: true, scenario: { id: 'legacy-movement-lab' } });
  expect(game.session.developerModeOverride).toBe(true);
  expect(game.scenarios.current).toMatchObject({ id: 'legacy-movement-lab', origin: 'url' });
  expect(game.calls).toEqual(['legacy-movement-lab']);
});
