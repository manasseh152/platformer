import { updateCamera } from '../core/camera.js';
import { updateGameplay } from '../core/physics.js';
import { drawGame } from '../render.js';
import { isPaused, isStarted, isWon } from '../app/app-state.js';
import { resetGameplaySession, syncGameplaySessionToGame } from '../core/gameplay-session.js';

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

export function createGameplayScene(game, props = {}) {
  if (props.tilemap) {
    resetGameplaySession(game.gameplaySession, props.tilemap, { view: game.view, scenarioId: props.scenarioId ?? props.tilemap.id, goal: props.goal });
    syncGameplaySessionToGame(game, game.gameplaySession);
    if (typeof document !== 'undefined' && document.body?.dataset) document.body.dataset.tilemapId = props.tilemap.id;
  } else if (props.tilemapId && game.tilemaps?.current?.id !== props.tilemapId) {
    game.tilemaps.switchTilemap(props.tilemapId);
  }

  return {
    id: 'gameplay',
    kind: 'gameplay',
    update(runtime, dt) {
      updateGameplay(runtime, game.gameplaySession, game.inputRuntime || game.input, dt, { resetGame: game.resetGame });
      updateCamera(game, dt);
    },
    render(runtime) {
      drawGame(runtime, game);
    },
    snapshot() {
      return {
        id: 'gameplay',
        kind: 'gameplay',
        tilemapId: game.gameplaySession?.tilemap?.id || game.tilemap?.id || 'act-01-level-1',
        player: snapshotPlayer(game.gameplaySession?.player || game.player),
        camera: snapshotCamera(game.gameplaySession?.camera || game.camera)
      };
    },
    dehydrate() {
      return {
        sceneId: 'gameplay',
        tilemapId: game.tilemap?.id || 'act-01-level-1',
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
