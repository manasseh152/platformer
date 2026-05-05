import { createSceneLibrary, resolveSceneComposition } from './library.js';
import { createLevelScene } from './level-scene.js';

export function createDefaultSceneLibrary() {
  const library = createSceneLibrary();
  library.register({
    id: 'gameplay',
    kind: 'base',
    create: (app, props = {}) => createLevelScene(app, props)
  });
  library.register({
    id: 'level',
    kind: 'base',
    create: (app, props = {}) => createLevelScene(app, props)
  });
  library.resolveSceneComposition = resolveSceneComposition;
  return library;
}
