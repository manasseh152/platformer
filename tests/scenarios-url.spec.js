import { expect, test } from '@playwright/test';
import { applyScenarioLaunchParams, readScenarioLaunchParams } from '../src/catalog/scenarios/url.js';
import { createRuntime } from '../src/runtime.js';
import { createScenarioService } from '../src/catalog/scenarios/service.js';

function makeGame() {
  const runtime = createRuntime({ now: () => 200 });
  const calls = [];
  runtime.scenes = {
    replaceStack: scenes => ({ scenes })
  };
  const game = {
    runtime,
    settings: { developerMode: false },
    session: { developerModeOverride: false },
    input: {},
    menu: {},
    tilemaps: {
      current: { id: 'act-01-level-1' },
      switchTilemap: id => {
        calls.push(id);
        game.tilemaps.current = { id };
        game.tilemap = game.tilemaps.current;
        return { ok: true, tilemap: game.tilemaps.current };
      }
    }
  };
  game.sceneLibrary = {
    create(id, app, props = {}) {
      if (props.tilemapId) app.tilemaps.switchTilemap(props.tilemapId);
      return { ok: true, scene: { id }, factory: { id } };
    },
    resolveSceneComposition(library, app, composition) {
      return { ok: true, scenes: composition.stack.map(layer => library.create(layer.scene, app, layer.props).scene) };
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
  const result = applyScenarioLaunchParams(game, readScenarioLaunchParams('?mode=developer&scenario=movement-gym&autorun=1'), game.runtime);

  expect(result).toMatchObject({ ok: true, scenario: { id: 'movement-gym' } });
  expect(game.session.developerModeOverride).toBe(true);
  expect(game.scenarios.current).toMatchObject({ id: 'movement-gym', origin: 'url' });
  expect(game.calls).toEqual(['movement-gym-map']);
});
