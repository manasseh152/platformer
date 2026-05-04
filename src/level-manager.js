import { centerCameraOnPlayer } from './camera.js';
import { createEnemies, createPlayer, getLevelById, getSpawnPoint, level as mainLevel, levels as levelRegistry } from './level.js';

const MAIN_LEVEL_ID = 'main';

function syncActiveLevelDataset(game) {
  document.body.dataset.levelId = game.level?.id || MAIN_LEVEL_ID;
}

function canAccessLevel(settings, targetLevel) {
  return Boolean(targetLevel) && (!targetLevel.developerOnly || settings.developerMode);
}

export function resolveInitialLevel(settings, search = location.search) {
  const requested = new URLSearchParams(search).get('level') || MAIN_LEVEL_ID;
  const candidate = getLevelById(requested) || mainLevel;
  return canAccessLevel(settings, candidate) ? candidate : mainLevel;
}

export function getAllLevels() {
  return Object.values(levelRegistry);
}

export function createLevelManager(game) {
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
    if (!nextLevel) return { ok: false, reason: 'missing-level', level: null, previousLevel };
    if (!canAccessLevel(game.settings, nextLevel)) return { ok: false, reason: 'developer-only', level: null, previousLevel };
    game.level = nextLevel;
    resetRuntimeForLevel();
    return { ok: true, reason: null, level: nextLevel, previousLevel };
  }

  function restartLevel() {
    const previousLevel = game.level;
    resetRuntimeForLevel();
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
    if (!nextLevel) return { ok: false, reason: 'no-next-level', level: null, previousLevel: game.level };
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
