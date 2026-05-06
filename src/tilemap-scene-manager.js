/**
 * Application-layer legacy tilemapScene orchestration adapter.
 * Intentionally outside `src/core`: mutates the compatibility game object, emits app events,
 * and mirrors active tilemapScene identity to browser DOM state.
 */
import { resetGameplaySession, syncGameplaySessionToGame } from './core/gameplay-session.js';
import { getAllTilemapScenes as getRegisteredTilemapScenes, getDefaultTilemapScene, getTilemapSceneById } from './content/tilemaps/registry.js';
import { isVisibleToMode } from './catalog/categories/registry.js';
import { browserRuntime } from './runtime.js';

function syncActiveTilemapSceneDataset(game) {
  const id = game.tilemapScene?.id || getDefaultTilemapScene().id;
  document.body.dataset.tilemapSceneId = id;
}

function canAccessTilemapScene(settings, tilemapScene) {
  return Boolean(tilemapScene) && isVisibleToMode(tilemapScene, settings.developerMode);
}

export function resolveInitialTilemapScene() {
  return getDefaultTilemapScene();
}

export function getAllTilemapScenes() {
  return getRegisteredTilemapScenes();
}

export function createTilemapSceneManager(game, runtime = browserRuntime) {
  function resetRuntimeForTilemapScene() {
    resetGameplaySession(game.gameplaySession, game.tilemapScene, {
      view: game.view,
      scenarioId: game.scenarios?.current?.id ?? game.tilemapScene?.id ?? null
    });
    syncGameplaySessionToGame(game, game.gameplaySession);
    syncActiveTilemapSceneDataset(game);
  }

  function switchTilemapScene(tilemapSceneId) {
    const previousTilemapScene = game.tilemapScene;
    const nextTilemapScene = getTilemapSceneById(tilemapSceneId);
    if (!nextTilemapScene) {
      runtime.emit('tilemap-scene.switch.failed', { tilemapSceneId, reason: 'missing-tilemap-scene', previousTilemapSceneId: previousTilemapScene?.id || null });
      return { ok: false, reason: 'missing-tilemap-scene', tilemapScene: null, previousTilemapScene };
    }
    if (!canAccessTilemapScene(game.settings, nextTilemapScene)) {
      runtime.emit('tilemap-scene.switch.failed', { tilemapSceneId, reason: 'developer-only', previousTilemapSceneId: previousTilemapScene?.id || null });
      return { ok: false, reason: 'developer-only', tilemapScene: null, previousTilemapScene };
    }
    game.tilemapScene = nextTilemapScene;
    resetRuntimeForTilemapScene();
    runtime.emit('tilemap-scene.switch', { from: previousTilemapScene?.id || null, to: nextTilemapScene.id });
    return { ok: true, reason: null, tilemapScene: nextTilemapScene, previousTilemapScene };
  }

  function restartTilemapScene() {
    const previousTilemapScene = game.tilemapScene;
    resetRuntimeForTilemapScene();
    runtime.emit('tilemap-scene.restart', { tilemapSceneId: game.tilemapScene?.id || null });
    return { ok: true, reason: null, tilemapScene: game.tilemapScene, previousTilemapScene };
  }

  function getSelectableTilemapScenes() {
    return getAllTilemapScenes().filter(tilemapScene => canAccessTilemapScene(game.settings, tilemapScene));
  }

  function getCurrentTilemapScene() {
    return game.tilemapScene;
  }

  function getNextTilemapScene() {
    const selectable = getSelectableTilemapScenes();
    const currentIndex = selectable.findIndex(tilemapScene => tilemapScene.id === game.tilemapScene?.id);
    return currentIndex >= 0 ? selectable[currentIndex + 1] ?? null : null;
  }

  function switchToNextTilemapScene() {
    const nextTilemapScene = getNextTilemapScene();
    if (!nextTilemapScene) {
      runtime.emit('tilemap-scene.switch.failed', { tilemapSceneId: null, reason: 'no-next-tilemap-scene', previousTilemapSceneId: game.tilemapScene?.id || null });
      return { ok: false, reason: 'no-next-tilemap-scene', tilemapScene: null, previousTilemapScene: game.tilemapScene };
    }
    return switchTilemapScene(nextTilemapScene.id);
  }

  return {
    switchTilemapScene,
    switchToNextTilemapScene,
    restartTilemapScene,
    getSelectableTilemapScenes,
    getAllTilemapScenes,
    getCurrentTilemapScene,
    getNextTilemapScene,
    canAccessTilemapScene: tilemapScene => canAccessTilemapScene(game.settings, tilemapScene)
  };
}
