---
title: Tilemaps
---

# Tilemaps

Shared domain language lives in [`../../CONTEXT.md`](../../CONTEXT.md). A tilemap is an authored spatial layout made from tile layers and placed assets for a gameplay scenario.

Related:

- [Scene model](./scene.md)
- [Scene components](./scene-components.md)
- [Terrain pipeline](./terrain.md)

`defineTilemap()` compiles explicit layers into the runtime data needed by gameplay, terrain/collision artifacts, and generic object/component indexes.

## Authoring API

Use explicit layer `cellSize` values from `CELL_SIZE`:

```js
import { CELL_SIZE } from '../../../core/constants.js';
import { defineTilemap, gridLayer } from '../../../core/tilemaps/tilemap.js';
import { TERRAIN_KIND as K, terrainLayer } from '../../../core/tilemaps/terrain-layer.js';
import { finishGateObject, playerSpawner, slimeSpawner } from '../objects.js';

export const movementGymMap = defineTilemap({
  id: 'movement-gym-map',
  name: 'Movement Gym Map',
  cols: 8,
  rows: 3,
  terrainRenderMode: 'contained-autotile',
  categories: ['movement'],
  visibility: 'developer',
  description: 'Movement validation fixture.',
  layers: [
    terrainLayer({
      cellSize: CELL_SIZE.BUILD,
      rows: [
        [K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS],
        [K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS],
        [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
        [K.GRASS, K.GRASS, null, null, null, null, null, null, null, null, null, null, null, null, K.GRASS, K.GRASS],
        [K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS],
        [K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS, K.GRASS]
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
});
```

## Cell sizes

Canonical cell sizes live in `src/core/constants.js`:

| Constant | Size | Meaning |
| --- | ---: | --- |
| `CELL_SIZE.GRID` | 32px | gameplay placement grid |
| `CELL_SIZE.BUILD` | 16px | terrain authoring and visual autotile grid |
| `CELL_SIZE.TERRAIN_PRIMITIVE` | 8px | derived terrain collision primitive grid |

`gridLayer()` accepts only supported `CELL_SIZE` values. `terrainLayer()` currently requires `CELL_SIZE.BUILD`.

Layer dimensions must match map bounds:

```txt
layer columns = cols * CELL_SIZE.GRID / cellSize
layer rows    = rows * CELL_SIZE.GRID / cellSize
```

## Terrain layer

Every tilemap must have exactly one terrain layer created with `terrainLayer()`.

- The layer id is always `terrain`.
- The layer type is always `terrain`.
- Empty terrain cells are `null`.
- Solid terrain uses `TERRAIN_KIND` values such as `GRASS`, `DIRT`, `STONE`, or `INVISIBLE`.
- The archived `buildTerrain` string-grid layer is rejected in authored tilemaps.

Contained terrain reads `terrain`, derives 8px collision primitives, greedy-merges physics rects, and draws visible 16px terrain tiles inside their cells.

## Placed asset grid layers

Placed asset layers use symbols mapped to reusable placement definitions.

| Symbol | Meaning |
| --- | --- |
| `.` | empty |
| `P` | player start marker |
| `E` | enemy spawn marker |
| `G` | finish-gate footprint cell |

Use `GGG` for a three-cell finish gate. One character represents one occupied cell at that layer's cell size.

## Reusable placement definitions

Layer symbols point to reusable placement definitions. Avoid inline component lists in map files.

```js
import { defineObject } from '../../../engine/scene/objects.js';
import { spawner } from '../../../engine/scene/components.js';

export const playerSpawner = defineObject({
  id: 'player-spawner',
  components: [spawner(player)]
});
```

Terrain is not authored as a symbol grid anymore; use `terrainLayer()` for terrain cells.

`defineObject()` is the implementation API that turns reusable placement definitions into runtime scene objects; it is not domain language.

## Parser output

`defineTilemap()` validates and compiles layers into:

- `layers`: authoring grids, including the required `terrain` layer
- `terrain`: normalized terrain cells and lookup map
- `objects`: one runtime scene object per non-empty placed-asset grid cell, plus authored scene objects
- `componentIndex`: cached lookup by component type
- `worldWidth/worldHeight`, `cols/rows`, `tileSize`/`gridSize`
- per-layer `cellSize` and per-object cell-sized transforms
- derived render artifacts in `renderLayers.containedTerrainTiles`
- derived collision artifacts in `collisionLayers`

Terrain cell shape:

```js
{
  layer: 'terrain',
  col: 4,
  row: 8,
  x: 64,
  y: 128,
  w: 16,
  h: 16,
  kind: 'grass'
}
```

Runtime scene object shape:

```js
{
  id: 'entities:4,1',
  layerId: 'entities',
  symbol: 'P',
  definitionId: 'player-spawner',
  transform: { col: 4, row: 1, cellSize: 32, x: 128, y: 32, w: 32, h: 32 },
  components: [...]
}
```

Systems query components or tilemap query helpers, not terrain implementation details:

```js
findObjectsWithComponent(scene, 'spawner');
solidTileRectsOverlapping(scene, rect);
terrainCellAt(scene, col, row);
```

## Terrain mode

Tilemaps use:

```js
terrainRenderMode: 'contained-autotile'
```

This is currently the only supported terrain render mode.

## Compatibility fields

`renderLayers`, `tiles`, and the public `src/core/tilemaps/tilemap.js` facade exist for current renderer/gameplay imports. New code may import focused modules directly when that improves ownership, but broad churn is not required.

Legacy editor/local-draft inputs can still be normalized from archived `buildTerrain` data at storage boundaries. Active authored content should use `terrainLayer()`.

## Validation philosophy

Generic tilemap parsing validates structure only:

- layers exist
- exactly one `terrainLayer()` layer exists
- rows are rectangular
- `cols` and `rows` are explicit positive integers
- layer dimensions match `cols * CELL_SIZE.GRID / cellSize` and `rows * CELL_SIZE.GRID / cellSize`
- `cellSize` is one of the supported `CELL_SIZE` values
- non-empty placed-asset grid symbols are defined
- terrain kinds are known
- archived `buildTerrain` layers are rejected

Gameplay requirements belong to gameplay assembly or editor checks, not the generic parser. Examples: “must have a player,” “spawn should stand on ground,” or “gate should be contiguous.”
