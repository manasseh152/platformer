import { updateCamera } from '../camera.js';
import { updateGameplay } from '../physics.js';
import { drawGame } from '../render.js';
import { isPaused, isStarted, isWon } from '../app/app-state.js';

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function snapshotPlayer(player) {
  if (!player) return null;
  return {
    x: round(player.x),
    y: round(player.y),
    vx: round(player.vx),
    vy: round(player.vy),
    hp: player.hp,
    dead: Boolean(player.dead),
    grounded: Boolean(player.grounded)
  };
}

function snapshotCamera(camera) {
  if (!camera) return null;
  return {
    x: round(camera.x),
    y: round(camera.y),
    shake: round(camera.shake)
  };
}

export function createLevelScene(game, props = {}) {
  if (props.tilemapLevelDefinitionId && game.levels?.current?.id !== props.tilemapLevelDefinitionId) {
    game.levels.switchLevel(props.tilemapLevelDefinitionId);
  }

  return {
    id: 'level',
    kind: 'level',
    update(runtime, dt) {
      updateGameplay(runtime, game.gameplaySession, game.input, dt, { resetGame: game.resetGame });
      updateCamera(game, dt);
    },
    render(runtime) {
      drawGame(runtime, game);
    },
    snapshot() {
      return {
        id: 'level',
        kind: 'level',
        levelId: game.gameplaySession?.tilemapLevelDefinition?.id || game.level?.id || 'act-01-level-1',
        player: snapshotPlayer(game.gameplaySession?.player || game.player),
        camera: snapshotCamera(game.gameplaySession?.camera || game.camera)
      };
    },
    dehydrate() {
      return {
        sceneId: 'level',
        levelId: game.level?.id || 'act-01-level-1',
        flags: {
          started: isStarted(game),
          paused: isPaused(game),
          won: isWon(game)
        },
        menu: {
          page: game.menu.page,
          origin: game.menu.origin
        }
      };
    }
  };
}
