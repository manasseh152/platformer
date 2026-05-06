import { expect, test } from '@playwright/test';
import { createRuntime } from '../src/runtime.js';
import { createScenarioService } from '../src/catalog/scenarios/service.js';

function makeGame({ developerMode = false } = {}) {
  const runtime = createRuntime({ now: () => 100 });
  const calls = [];
  runtime.scenes = {
    replaceStack: scenes => ({ scenes })
  };
  const game = {
    runtime,
    settings: { developerMode },
    session: { developerModeOverride: false },
    input: {},
    menu: {},
    tilemapScenes: {
      current: { id: 'act-01-level-1' },
      switchTilemapScene: id => {
        calls.push(['switchTilemapScene', id]);
        game.tilemapScenes.current = { id, name: id };
        game.tilemapScene = game.tilemapScenes.current;
        return { ok: true, tilemapScene: game.tilemapScenes.current };
      }
    }
  };
  game.sceneLibrary = {
    create(id, app, props = {}) {
      if (props.tilemapSceneId) app.tilemapScenes.switchTilemapScene(props.tilemapSceneId);
      return { ok: true, scene: { id }, factory: { id } };
    },
    resolveSceneComposition(library, app, composition) {
      return { ok: true, scenes: composition.stack.map(layer => library.create(layer.scene, app, layer.props).scene) };
    }
  };
  game.scenarioCalls = calls;
  return game;
}

test('scenario service selects and launches public scenarios', () => {
  const game = makeGame();
  const scenarios = createScenarioService(game, game.runtime);

  expect(scenarios.getSelected().id).toBe('act-01-level-1');
  expect(scenarios.select('act-01-level-1')).toMatchObject({ ok: true });
  expect(scenarios.launch('act-01-level-1', { origin: 'start' })).toMatchObject({ ok: true, scenario: { id: 'act-01-level-1' } });
  expect(scenarios.current).toMatchObject({ id: 'act-01-level-1', source: 'campaigns', origin: 'start' });
  expect(game.scenarioCalls).toEqual([['switchTilemapScene', 'act-01-level-1']]);
  expect(game.runtime.events().map(event => event.type)).toEqual(['scenario.select', 'scenario.launch']);
});

test('scenario service enforces developer visibility and supports restart', () => {
  const game = makeGame();
  const scenarios = createScenarioService(game, game.runtime);

  expect(scenarios.select('movement-gym')).toMatchObject({ ok: false, reason: 'developer-only' });
  expect(scenarios.launch('movement-gym')).toMatchObject({ ok: false, reason: 'developer-only' });

  game.session.developerModeOverride = true;
  expect(scenarios.launch('movement-gym', { origin: 'url' })).toMatchObject({ ok: true });
  expect(scenarios.restartCurrent()).toMatchObject({ ok: true, scenario: { id: 'movement-gym' } });
  expect(game.scenarioCalls).toEqual([
    ['switchTilemapScene', 'movement-gym-map'],
    ['switchTilemapScene', 'movement-gym-map']
  ]);
});
