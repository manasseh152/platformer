/**
 * Application-layer tilemap orchestration adapter.
 * Intentionally outside `src/core`: mutates the app game object, emits app events,
 * and mirrors active tilemap identity to browser DOM state.
 */
import { resetGameplaySession, syncGameplaySessionToGame } from '#/core/gameplay-session.js';
import { getAllTilemaps as getRegisteredTilemaps, getDefaultTilemap, getTilemapById } from '#/content/tilemaps/registry.js';
import { isVisibleToMode } from '#/catalog/categories/registry.js';
import { browserRuntime } from '../runtime/browser-runtime.js';
import { isStarted } from '../app-state.js';
import { prepareSpeedRunAttempt } from '../speedrun/speedrun.js';

function syncActiveTilemapDataset(game) {
  const id = game.tilemap?.id || getDefaultTilemap().id;
  document.body.dataset.tilemapId = id;
}

function canAccessTilemap(settings, tilemap, session = null) {
  return Boolean(tilemap) && isVisibleToMode(tilemap, Boolean(settings.developerMode || session?.developerModeOverride));
}

export function resolveInitialTilemap() {
  return getDefaultTilemap();
}

export function getAllTilemaps() {
  return getRegisteredTilemaps();
}

export function createTilemapManager(game, runtime = browserRuntime) {
  function resetRuntimeForTilemap() {
    resetGameplaySession(game.gameplaySession, game.tilemap, {
      view: game.view,
      scenarioId: game.scenarios?.current?.id ?? game.tilemap?.id ?? null
    });
    syncGameplaySessionToGame(game, game.gameplaySession);
    syncActiveTilemapDataset(game);
  }

  function switchTilemap(tilemapId) {
    const previousTilemap = game.tilemap;
    const nextTilemap = getTilemapById(tilemapId);
    if (!nextTilemap) {
      runtime.emit('tilemap.switch.failed', { tilemapId, reason: 'missing-tilemap', previousTilemapId: previousTilemap?.id || null });
      return { ok: false, reason: 'missing-tilemap', tilemap: null, previousTilemap };
    }
    if (!canAccessTilemap(game.settings, nextTilemap, game.session)) {
      runtime.emit('tilemap.switch.failed', { tilemapId, reason: 'developer-only', previousTilemapId: previousTilemap?.id || null });
      return { ok: false, reason: 'developer-only', tilemap: null, previousTilemap };
    }
    game.tilemap = nextTilemap;
    resetRuntimeForTilemap();
    if (isStarted(game)) prepareSpeedRunAttempt(game);
    runtime.emit('tilemap.switch', { from: previousTilemap?.id || null, to: nextTilemap.id });
    return { ok: true, reason: null, tilemap: nextTilemap, previousTilemap };
  }

  function restartTilemap() {
    const previousTilemap = game.tilemap;
    resetRuntimeForTilemap();
    runtime.emit('tilemap.restart', { tilemapId: game.tilemap?.id || null });
    return { ok: true, reason: null, tilemap: game.tilemap, previousTilemap };
  }

  function getSelectableTilemaps() {
    return getAllTilemaps().filter(tilemap => canAccessTilemap(game.settings, tilemap, game.session));
  }

  function getCurrentTilemap() {
    return game.tilemap;
  }

  function getNextTilemap() {
    const selectable = getSelectableTilemaps();
    const currentIndex = selectable.findIndex(tilemap => tilemap.id === game.tilemap?.id);
    return currentIndex >= 0 ? selectable[currentIndex + 1] ?? null : null;
  }

  function switchToNextTilemap() {
    const nextTilemap = getNextTilemap();
    if (!nextTilemap) {
      runtime.emit('tilemap.switch.failed', { tilemapId: null, reason: 'no-next-tilemap', previousTilemapId: game.tilemap?.id || null });
      return { ok: false, reason: 'no-next-tilemap', tilemap: null, previousTilemap: game.tilemap };
    }
    return switchTilemap(nextTilemap.id);
  }

  return {
    switchTilemap,
    switchToNextTilemap,
    restartTilemap,
    getSelectableTilemaps,
    getAllTilemaps,
    getCurrentTilemap,
    getNextTilemap,
    canAccessTilemap: tilemap => canAccessTilemap(game.settings, tilemap, game.session)
  };
}
