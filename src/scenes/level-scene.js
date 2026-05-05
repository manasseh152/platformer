import { updateCamera } from '../camera.js';
import { updateGame } from '../physics.js';
import { drawGame } from '../render.js';

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

export function createLevelScene(game) {
  return {
    id: 'level',
    kind: 'level',
    update(runtime, dt) {
      updateGame(runtime, game, dt);
      updateCamera(game, dt);
    },
    render(runtime) {
      drawGame(runtime, game);
    },
    snapshot() {
      return {
        id: 'level',
        kind: 'level',
        levelId: game.level?.id || 'act-01-level-1',
        player: snapshotPlayer(game.player),
        camera: snapshotCamera(game.camera)
      };
    },
    dehydrate() {
      return {
        sceneId: 'level',
        levelId: game.level?.id || 'act-01-level-1',
        flags: {
          started: Boolean(game.flags.started),
          paused: Boolean(game.flags.paused),
          won: Boolean(game.flags.won)
        },
        menu: {
          page: game.menu.page,
          origin: game.menu.origin
        }
      };
    }
  };
}
