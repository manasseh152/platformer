# Tilemaps

Tilemaps are one authoring format for core scenes.

Related:

- [Scene model](./scene.md)
- [Scene components](./scene-components.md)

Tilemaps are composable scene data, not hard-coded `terrainRows/objectRows/decorRows` blobs. `defineTilemap()` compiles grid layers into core scene objects and then delegates generic object/index work to the core scene model.

## Authoring API

Use one canonical pattern:

```js
import { defineTilemap, gridLayer } from '../tilemap.js';
import { finishGateObject, playerSpawner, slimeSpawner, solidTerrain } from '../objects.js';

export const movementGymMapDefinition = {
  cols: 8,
  rows: 3,
  artTileSize: 18,
  theme: 'kenney-pixel-platformer:grass',
  layers: [
    gridLayer({
      id: 'terrain',
      resolution: 2,
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

## Symbols

Current minimal vocabulary:

Terrain layer:

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

Use `GGG` for a three-cell finish gate. One character represents one occupied cell at that layer's resolution.

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
- `worldWidth/worldHeight`, `cols/rows`, `tileSize`
- layer `resolution` and per-object cell-sized transforms
- derived tilemap render/collision artifacts

Scene object shape:

```js
{
  id: 'terrain:4,8',
  layerId: 'terrain',
  symbol: '#',
  definitionId: 'solid-terrain',
  transform: { col: 4, row: 8, resolution: 1, x: 144, y: 288, w: 36, h: 36 },
  components: [...]
}
```

Systems query components, not layer names or symbols:

```js
findObjectsWithComponent(scene, 'collision:solid');
findObjectsWithComponent(scene, 'spawner');
findObjectsWithComponent(scene, 'render:terrain');
```

## Compatibility fields

Compatibility fields such as `renderLayers` and `tiles` exist for the current renderer and gameplay helpers. New systems should query scene objects/components through `src/engine/scene` instead.

## Dimensions and layer resolution

Tilemaps declare base full-grid dimensions explicitly:

```js
defineTilemap({
  cols: 20,
  rows: 10,
  layers: [/* ... */]
});
```

`tileSize` comes from the project `TILE_SIZE` constant. Authored tilemaps should not set per-map `tileSize`.

Each grid layer may declare `resolution`, meaning cells per full tile along each axis:

| Resolution | Meaning | Cell size with `TILE_SIZE = 36` |
| --- | --- | --- |
| `1` | full grid | 36px |
| `2` | half grid | 18px |
| `4` | quarter grid | 9px |

`resolution` defaults to `1`. Layer dimensions must match the tilemap bounds:

```txt
layer columns = cols * resolution
layer rows    = rows * resolution
cellSize      = TILE_SIZE / resolution
```

## Dual-grid rendering

Map symbols express semantic occupancy, not final art tiles.

`#` means “solid terrain.” The renderer derives terrain primitives from neighboring solid terrain cells. Dual-grid should remain a render/collision strategy over scene objects, not a special authored layer format.

Longer-term direction:

```js
solidTerrain = defineObject({
  id: 'solid-terrain',
  components: [solid(), terrain({ material: 'grass' })]
});
```

A terrain render system chooses `dual-grid` for grass terrain. Objects say what they are; systems choose how to render them.

## Validation philosophy

Generic tilemap parsing should validate structure only:

- layers exist
- rows are rectangular
- `cols` and `rows` are explicit positive integers
- layer dimensions match `cols * resolution` and `rows * resolution`
- each layer `resolution` divides `TILE_SIZE`
- non-empty symbols are defined

Gameplay requirements belong to gameplay assembly or editor checks, not the generic parser. Examples: “must have a player,” “spawn should stand on ground,” or “gate should be contiguous.”
