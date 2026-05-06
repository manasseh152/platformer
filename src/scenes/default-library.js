import { createSceneLibrary, resolveSceneComposition } from './library.js';
import { createGameplayScene } from './gameplay-scene.js';

export function createDefaultSceneLibrary() {
  const library = createSceneLibrary();
  library.register({
    id: 'gameplay',
    kind: 'base',
    create: (app, props = {}) => createGameplayScene(app, props)
  });
  library.resolveSceneComposition = resolveSceneComposition;
  return library;
}
