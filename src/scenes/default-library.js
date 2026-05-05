import { createSceneLibrary } from './library.js';
import { createLevelScene } from './level-scene.js';

export function createDefaultSceneLibrary() {
  const library = createSceneLibrary();
  library.register({
    id: 'gameplay',
    kind: 'base',
    create: app => createLevelScene(app)
  });
  // Compatibility alias for current executable gyms. The level scene is still registered as `level` in scene-host.
  library.register({
    id: 'level',
    kind: 'base',
    create: app => createLevelScene(app)
  });
  return library;
}
