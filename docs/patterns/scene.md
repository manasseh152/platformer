# Scene model

Generic scene/object/component primitives live in `src/core/scene`. Tilemaps are one authoring format that compiles grid layers into core scene objects.

## Core APIs

```js
import { defineScene } from '../../src/core/scene/scene.js';
import { sceneObject, defineObject } from '../../src/core/scene/objects.js';
import { findObjectsWithComponent } from '../../src/core/scene/queries.js';
```

`defineObject()` defines reusable object definitions. `sceneObject()` defines an object instance in a scene. `defineScene()` normalizes objects and builds `componentIndex`.

Object IDs share one scene namespace; duplicate IDs are rejected.

```js
defineScene({
  id: 'scene-id',
  kind: 'tilemap-scene',
  worldWidth: 960,
  worldHeight: 540,
  objects: [
    sceneObject({
      id: 'far-sky',
      transform: { x: 0, y: 0, w: 960, h: 540 },
      components: []
    })
  ]
});
```

Systems query components, not layer names or symbols:

```js
findObjectsWithComponent(scene, 'collision:solid');
findObjectsWithComponent(scene, 'spawner');
findObjectsWithComponent(scene, 'render:layer');
```
