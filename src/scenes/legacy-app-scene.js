import { updateCamera } from '../camera.js';
import { updateGame } from '../physics.js';
import { drawGame } from '../render.js';

export function createLegacyAppScene(game) {
  return {
    id: 'legacy-app',
    kind: 'legacy',
    update(runtime, dt) {
      updateGame(runtime, game, dt);
      updateCamera(game, dt);
    },
    render(runtime) {
      drawGame(runtime, game);
    },
    snapshot() {
      return {
        id: 'legacy-app',
        kind: 'legacy'
      };
    },
    dehydrate() {
      return {
        sceneId: 'legacy-app',
        levelId: game.level?.id || 'main',
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
