import { createGame } from '../state.js';

/**
 * Application composition root.
 *
 * During migration this returns the mutable compatibility game object, with
 * app-level services exposed under their target names (`runtime`, `scenarios`,
 * `sceneLibrary`). Gameplay state remains in `app.gameplaySession`.
 */
export function createGameApp(ui, runtime) {
  const app = createGame(ui, runtime);
  app.app = app;
  return app;
}
