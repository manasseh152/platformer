import { updateCamera } from '../core/camera.js';
import { updateGameplay } from '../core/physics.js';
import { renderGameplayFrame } from '../render/gameplay-render-pipeline.js';
import { isPaused, isStarted, isWon } from '../app/app-state.js';
import { resetGameplaySession, syncGameplaySessionToGame } from '../core/gameplay-session.js';
import { createGymMachineRunner } from '../core/gyms/machine-runner.js';

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
  function resetSceneSession() {
    if (props.tilemap) {
      resetGameplaySession(game.gameplaySession, props.tilemap, { view: game.view, scenarioId: props.scenarioId ?? props.tilemap.id, goal: props.goal });
      syncGameplaySessionToGame(game, game.gameplaySession);
      if (typeof document !== 'undefined' && document.body?.dataset) document.body.dataset.tilemapId = props.tilemap.id;
    } else if (props.tilemapId) {
      if (game.tilemap?.id !== props.tilemapId) game.tilemaps.switchTilemap(props.tilemapId);
      resetGameplaySession(game.gameplaySession, game.tilemap, { view: game.view, scenarioId: props.scenarioId ?? props.tilemapId, goal: props.goal });
      syncGameplaySessionToGame(game, game.gameplaySession);
      if (typeof document !== 'undefined' && document.body?.dataset) document.body.dataset.tilemapId = game.tilemap?.id || props.tilemapId;
    }
  }

  resetSceneSession();

  game.gym = props.gym ? createGymMachineRunner({
    id: props.gym.id,
    name: props.gym.name,
    machines: props.gym.machines,
    machinePolicy: props.gym.machinePolicy,
    getSession: () => game.gameplaySession,
    resetWorld: resetSceneSession
  }) : null;

  return {
    id: 'gameplay',
    kind: 'gameplay',
    update(runtime, dt) {
      game.gym?.beforeGameplayUpdate(runtime, dt);
      const input = game.gym?.hasActiveInputAuthority?.() ? game.gym.scriptedInput : (game.inputRuntime || game.input);
      updateGameplay(runtime, game.gameplaySession, input, dt, { resetGame: game.resetGame });
      game.gym?.afterGameplayUpdate(runtime, dt);
      updateCamera(game, dt);
    },
    render(runtime) {
      renderGameplayFrame(runtime, game);
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
        gym: game.gym?.snapshot?.() ?? null,
        menu: {
          page: game.menu.page,
          origin: game.menu.origin
        }
      };
    }
  };
}
