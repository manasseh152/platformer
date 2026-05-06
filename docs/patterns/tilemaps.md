# Tilemaps

Tilemaps are one authoring format for core scenes.

Related:

- [Scene model](./scene.md)
- [Scene components](./scene-components.md)
- [Terrain pipeline](./terrain.md)

Tilemaps are composable scene data, not hard-coded `terrainRows/objectRows/decorRows` blobs. `defineTilemap()` compiles grid layers into core scene objects and then delegates generic object/index work to the core scene model.

## Authoring API

Use explicit layer `cellSize` values from `CELL_SIZE`:

```js
import { CELL_SIZE } from '../../../core/constants.js';
import { defineTilemap, gridLayer } from '../tilemap.js';
import { finishGateObject, playerSpawner, slimeSpawner, solidTerrain } from '../objects.js';

export const movementGymMapDefinition = {
  cols: 8,
  rows: 3,
  terrainRenderMode: 'contained-autotile',
  layers: [
    gridLayer({
      id: 'buildTerrain',
      cellSize: CELL_SIZE.BUILD,
      symbols: { '#': solidTerrain },
      rows: [
        '################',
        '################',
        '##............##',
        '##............##',
        '################',
        '################'
      ]
    }),
    gridLayer({
      id: 'entities',
      cellSize: CELL_SIZE.GRID,
      symbols: {
        P: playerSpawner,
        E: slimeSpawner,
        G: finishGateObject
      },
      rows: [
        '........',
        '..P.EGGG',
        '........'
      ]
    })
  ]
};

export const movementGymMap = defineTilemap({
  id: 'movement-gym-map',
  name: 'Movement Gym Map',
  categories: ['movement'],
  visibility: 'developer',
  description: 'Movement validation fixture.',
  ...movementGymMapDefinition
});
```

## Cell sizes

Canonical cell sizes live in `src/core/constants.js`:

| Constant | Size | Meaning |
| --- | ---: | --- |
| `CELL_SIZE.GRID` | 32px | macro gameplay/entity grid |
| `CELL_SIZE.BUILD` | 16px | terrain authoring and visual autotile grid |
| `CELL_SIZE.TERRAIN_PRIMITIVE` | 8px | derived terrain collision primitive grid |

`gridLayer()` accepts only these values. Do not use raw numeric sizes in map definitions. The old public `resolution` field is removed for new code.

Layer dimensions must match map bounds:

```txt
layer columns = cols * CELL_SIZE.GRID / cellSize
layer rows    = rows * CELL_SIZE.GRID / cellSize
```

## Symbols

Current minimal vocabulary:

Build terrain layer:

| Symbol | Meaning |
| --- | --- |
| `.` | empty |
| `#` | solid terrain scene object |

Entities layer:

| Symbol | Meaning |
| --- | --- |
| `.` | empty |
| `P` | spawns player object |
| `E` | spawns slime object |
| `G` | finish-gate footprint cell |

Use `GGG` for a three-cell finish gate. One character represents one occupied cell at that layer's cell size.

## Object definitions

Layer symbols point to reusable object definitions. Avoid inline component lists in map files.

```js
import { defineObject } from '../../../engine/scene/objects.js';
import { renderTerrain, solid, spawner, terrain } from '../../../engine/scene/components.js';

export const solidTerrain = defineObject({
  id: 'solid-terrain',
  components: [solid(), terrain(), renderTerrain({ strategy: 'dual-grid' })]
});

export const playerSpawner = defineObject({
  id: 'player-spawner',
  components: [spawner(player)]
});
```

One concept is used for both static objects and spawnable runtime objects: `defineObject()`.

## Parser output

`defineTilemap()` validates and compiles layers into:

- `layers`: authoring grids and symbol mappings
- `objects`: one scene object per non-empty cell, plus authored scene objects
- `componentIndex`: cached lookup by component type
- `worldWidth/worldHeight`, `cols/rows`, `tileSize`/`gridSize`
- per-layer `cellSize` and per-object cell-sized transforms
- derived render artifacts in `renderLayers`
- derived collision artifacts in `collisionLayers` for contained terrain

Scene object shape:

```js
{
  id: 'buildTerrain:4,8',
  layerId: 'buildTerrain',
  symbol: '#',
  definitionId: 'solid-terrain',
  transform: { col: 4, row: 8, cellSize: 16, x: 64, y: 128, w: 16, h: 16 },
  components: [...]
}
```

Systems query components, not layer names or symbols:

```js
findObjectsWithComponent(scene, 'collision:solid');
findObjectsWithComponent(scene, 'spawner');
findObjectsWithComponent(scene, 'render:terrain');
```

## Terrain render modes

New maps should use:

```js
terrainRenderMode: 'contained-autotile'
```

Contained terrain reads `buildTerrain`, derives 8px collision primitives, greedy-merges physics rects, and draws 16px visual tiles inside their cells.

Legacy maps may temporarily use `terrainRenderMode: 'legacy-dual-grid'` and `terrain` layers. Legacy code should be marked with `@deprecated TODO(new-terrain)` and should not receive new features.

## Compatibility fields

Compatibility fields such as `renderLayers` and `tiles` exist for current renderer and gameplay helpers. New collision-aware systems should prefer public query helpers and `scene.collisionLayers` rather than reading render-layer collision data directly.

## Validation philosophy

Generic tilemap parsing should validate structure only:

- layers exist
- rows are rectangular
- `cols` and `rows` are explicit positive integers
- layer dimensions match `cols * CELL_SIZE.GRID / cellSize` and `rows * CELL_SIZE.GRID / cellSize`
- `cellSize` is one of the supported `CELL_SIZE` values
- non-empty symbols are defined

Gameplay requirements belong to gameplay assembly or editor checks, not the generic parser. Examples: “must have a player,” “spawn should stand on ground,” or “gate should be contiguous.”
