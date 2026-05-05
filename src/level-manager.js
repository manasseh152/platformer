import { centerCameraOnPlayer } from './camera.js';
import { createEnemies, createPlayer, getSpawnPoint } from './levels/tilemap.js';
import { getAllLevels as getRegisteredLevels, getDefaultLevel, getLevelById } from './campaign/registry.js';
import { isVisibleToMode } from './categories/registry.js';
import { browserRuntime } from './runtime.js';

function syncActiveLevelDataset(game) {
  document.body.dataset.levelId = game.level?.id || getDefaultLevel().id;
}

function canAccessLevel(settings, targetLevel) {
  return Boolean(targetLevel) && isVisibleToMode(targetLevel, settings.developerMode);
}

export function resolveInitialLevel() {
  return getDefaultLevel();
}

export function getAllLevels() {
  return getRegisteredLevels();
}

export function createLevelManager(game, runtime = browserRuntime) {
  function resetRuntimeForLevel() {
    Object.assign(game.player, createPlayer(getSpawnPoint(game.level)));
    game.enemies.length = 0;
    game.enemies.push(...createEnemies(game.level));
    game.particles.length = 0;
    game.dust.length = 0;
    game.flags.won = false;
    centerCameraOnPlayer(game.camera, game.player, game.view);
    game.camera.shake = 0;
    syncActiveLevelDataset(game);
  }

  function switchLevel(levelId) {
    const previousLevel = game.level;
    const nextLevel = getLevelById(levelId);
    if (!nextLevel) {
      runtime.emit('level.switch.failed', { levelId, reason: 'missing-level', previousLevelId: previousLevel?.id || null });
      return { ok: false, reason: 'missing-level', level: null, previousLevel };
    }
    if (!canAccessLevel(game.settings, nextLevel)) {
      runtime.emit('level.switch.failed', { levelId, reason: 'developer-only', previousLevelId: previousLevel?.id || null });
      return { ok: false, reason: 'developer-only', level: null, previousLevel };
    }
    game.level = nextLevel;
    resetRuntimeForLevel();
    runtime.emit('level.switch', { from: previousLevel?.id || null, to: nextLevel.id });
    return { ok: true, reason: null, level: nextLevel, previousLevel };
  }

  function restartLevel() {
    const previousLevel = game.level;
    resetRuntimeForLevel();
    runtime.emit('level.restart', { levelId: game.level?.id || null });
    return { ok: true, reason: null, level: game.level, previousLevel };
  }

  function getSelectableLevels() {
    return getAllLevels().filter(level => canAccessLevel(game.settings, level));
  }

  function getCurrentLevel() {
    return game.level;
  }

  function getNextLevel() {
    const selectable = getSelectableLevels();
    const currentIndex = selectable.findIndex(level => level.id === game.level?.id);
    return currentIndex >= 0 ? selectable[currentIndex + 1] ?? null : null;
  }

  function switchToNextLevel() {
    const nextLevel = getNextLevel();
    if (!nextLevel) {
      runtime.emit('level.switch.failed', { levelId: null, reason: 'no-next-level', previousLevelId: game.level?.id || null });
      return { ok: false, reason: 'no-next-level', level: null, previousLevel: game.level };
    }
    return switchLevel(nextLevel.id);
  }

  return {
    switchLevel,
    switchToNextLevel,
    restartLevel,
    getSelectableLevels,
    getAllLevels,
    getCurrentLevel,
    getNextLevel,
    canAccessLevel: level => canAccessLevel(game.settings, level)
  };
}
