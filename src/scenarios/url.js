export function readScenarioLaunchParams(search = globalThis.location?.search ?? '') {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return {
    scenarioId: params.get('scenario') || null,
    developerModeOverride: params.get('mode') === 'developer' || params.get('developerMode') === '1',
    autorun: params.get('autorun') === '1'
  };
}

export function applyScenarioLaunchParams(game, params, runtime = game.runtime) {
  if (params.developerModeOverride) game.session.developerModeOverride = true;

  let selection = { ok: true, scenario: game.scenarios.getSelected(), reason: null };
  if (params.scenarioId) selection = game.scenarios.select(params.scenarioId);

  runtime?.emit?.('scenario.url', {
    scenarioId: params.scenarioId,
    selectedScenarioId: game.scenarios.selectedScenarioId,
    developerModeOverride: Boolean(game.session.developerModeOverride),
    autorun: Boolean(params.autorun),
    ok: selection.ok,
    reason: selection.reason ?? null
  });

  if (!selection.ok || !params.autorun) return selection;
  return game.scenarios.launch(game.scenarios.selectedScenarioId, { origin: 'url' });
}
