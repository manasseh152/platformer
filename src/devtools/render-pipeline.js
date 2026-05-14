export { summarizeRenderFrame } from '../render/render-frame-diagnostics.js';

function formatCounts(counts) {
  if (!counts.length) return 'None';
  return counts.map(([key, count]) => `${key}: ${count}`).join(', ');
}

function fallbackSummary(game) {
  const pipeline = game.renderPipeline ?? {};
  const issues = pipeline.diagnostics?.fallback?.issues ?? [];
  if (!issues.length) return 'None';
  const counts = new Map();
  for (const issue of issues) counts.set(issue.reason, (counts.get(issue.reason) ?? 0) + 1);
  return [...counts.entries()]
    .map(([reason, count]) => count > 1 ? `${reason} ×${count}` : reason)
    .join('; ');
}

function pipelineDiagnostics(game) {
  return game.renderPipeline?.diagnostics ?? null;
}

function setExclusiveBackendFlag(game, flag, value) {
  game.devTools.flags.forceCanvas2DNativeFrame = false;
  game.devTools.flags.forceWebGlNativeFrame = false;
  if (value) game.devTools.flags[flag] = true;
}

function setDeferredFlag(game, flag, value) {
  game.devTools.flags.forceDeferredLighting = false;
  game.devTools.flags.disableDeferredLighting = false;
  if (value) game.devTools.flags[flag] = true;
}

function activeSceneSummary(game) {
  const scene = game.runtime?.scenes?.snapshot?.();
  if (!scene) return 'No scene host';
  return `${scene.id ?? 'unknown'} (${scene.kind ?? 'unknown'})`;
}

function appStateSummary(game) {
  const state = game.appState ?? {};
  const parts = [];
  if (state.started) parts.push('started'); else parts.push('not started');
  if (state.paused) parts.push('paused');
  if (state.won) parts.push('won');
  if (game.player?.dead) parts.push('player dead');
  return parts.join(', ');
}

function actorsSummary(game) {
  const enemies = game.enemies ?? [];
  const livingEnemies = enemies.filter(enemy => enemy.hp === undefined || enemy.hp > 0).length;
  return `player: ${game.player ? 1 : 0}, enemies: ${livingEnemies}/${enemies.length}`;
}

function transientSummary(game) {
  return `dust: ${(game.dust ?? []).length}, particles: ${(game.particles ?? []).length}`;
}

function cameraSummary(game) {
  const camera = game.camera;
  if (!camera) return 'None';
  return `${camera.mode || 'follow'} @ ${Math.round(camera.x)}, ${Math.round(camera.y)}`;
}

function gpuSummary(game) {
  if (!game.gpu) return 'None';
  const status = game.gpu.enabled ? 'enabled' : 'disabled';
  return `${status}${game.gpu.backend ? ` (${game.gpu.backend})` : ''}`;
}

export function registerRenderPipelineDevTools(game) {
  game.devTools.registry.registerSection({
    id: 'render',
    title: 'Render',
    order: 200,
    items: [
      { id: 'backend-kind', kind: 'value', label: 'Native backend', get: game => game.renderPipeline?.nativeBackend?.kind ?? 'Not rendered yet' },
      { id: 'backend-request', kind: 'value', label: 'Backend request', get: game => pipelineDiagnostics(game)?.requestedBackendKind ?? 'auto' },
      { id: 'backend-selected', kind: 'value', label: 'Backend selected', get: game => pipelineDiagnostics(game)?.candidateBackendKind ?? 'Not rendered yet' },
      { id: 'backend-actual', kind: 'value', label: 'Backend actual', get: game => pipelineDiagnostics(game)?.actualBackendKind ?? game.renderPipeline?.nativeBackendKind ?? 'Not rendered yet' },
      { id: 'frame-size', kind: 'value', label: 'Frame size', get: game => {
        const frame = pipelineDiagnostics(game)?.frame;
        return frame ? `${frame.width}×${frame.height} ${frame.coordinateSpace}` : 'Not rendered yet';
      } },
      { id: 'packet-count', kind: 'value', label: 'Packets', get: game => pipelineDiagnostics(game)?.frame?.packetCount ?? 0 },
      { id: 'packet-kinds', kind: 'value', label: 'Packet kinds', get: game => formatCounts(pipelineDiagnostics(game)?.frame?.packetsByKind ?? []) },
      { id: 'light-packets', kind: 'value', label: 'Light packets', get: game => pipelineDiagnostics(game)?.frame?.lightCount ?? 0 },
      { id: 'lighting-packets', kind: 'value', label: 'Lit/unlit packets', get: game => {
        const frame = pipelineDiagnostics(game)?.frame;
        return frame ? `${frame.litPacketCount}/${frame.unlitPacketCount}` : '0/0';
      } },
      { id: 'fallback-reason', kind: 'value', label: 'Fallback', get: fallbackSummary },
      { id: 'force-canvas2d-native-frame', kind: 'toggle', label: 'Force Canvas2D backend', get: game => Boolean(game.devTools.flags.forceCanvas2DNativeFrame), set: (game, value) => setExclusiveBackendFlag(game, 'forceCanvas2DNativeFrame', value) },
      { id: 'force-webgl-native-frame', kind: 'toggle', label: 'Force WebGL backend', get: game => Boolean(game.devTools.flags.forceWebGlNativeFrame), set: (game, value) => setExclusiveBackendFlag(game, 'forceWebGlNativeFrame', value) },
      { id: 'force-deferred-lighting', kind: 'toggle', label: 'Force deferred lighting', get: game => Boolean(game.devTools.flags.forceDeferredLighting), set: (game, value) => setDeferredFlag(game, 'forceDeferredLighting', value) },
      { id: 'disable-deferred-lighting', kind: 'toggle', label: 'Disable deferred lighting', get: game => Boolean(game.devTools.flags.disableDeferredLighting), set: (game, value) => setDeferredFlag(game, 'disableDeferredLighting', value) }
    ]
  });

  game.devTools.registry.registerSection({
    id: 'systems',
    title: 'Systems',
    order: 50,
    items: [
      { id: 'active-scene', kind: 'value', label: 'Active scene', get: activeSceneSummary },
      { id: 'app-state', kind: 'value', label: 'App state', get: appStateSummary },
      { id: 'actors', kind: 'value', label: 'Actors', get: actorsSummary },
      { id: 'transients', kind: 'value', label: 'Transient effects', get: transientSummary },
      { id: 'camera', kind: 'value', label: 'Camera', get: cameraSummary },
      { id: 'gpu-extras', kind: 'value', label: 'GPU extras', get: gpuSummary }
    ]
  });
}
