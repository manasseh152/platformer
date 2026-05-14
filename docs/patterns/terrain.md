---
title: Terrain pipeline
---

# Terrain pipeline

Terrain uses explicit cell sizes and separates authored terrain, visual terrain, and collision terrain.

## Cell sizes

| Constant | Size | Use |
| --- | ---: | --- |
| `CELL_SIZE.GRID` | 32px | gameplay placement grid |
| `CELL_SIZE.BUILD` | 16px | terrain authoring and visual autotile grid |
| `CELL_SIZE.TERRAIN_PRIMITIVE` | 8px | derived collision primitive grid |

## Authoring terrain

Solid terrain is authored with `terrainLayer()` at `CELL_SIZE.BUILD`:

```js
import { CELL_SIZE } from '../../core/constants.js';
import { TERRAIN_KIND as K, terrainLayer } from '../../core/tilemaps/terrain-layer.js';

terrainLayer({
  cellSize: CELL_SIZE.BUILD,
  rows: [
    [null, null, null, null],
    [null, K.GRASS, K.GRASS, null]
  ]
})
```

`terrainLayer()` always creates a layer with `id: 'terrain'` and `type: 'terrain'`. Use `null` for empty cells and `TERRAIN_KIND` values for terrain cells.

Current terrain kinds:

| Kind | Solid | Visible | Connects to |
| --- | --- | --- | --- |
| `TERRAIN_KIND.GRASS` | yes | yes | grass |
| `TERRAIN_KIND.DIRT` | yes | yes | dirt |
| `TERRAIN_KIND.STONE` | yes | yes | stone |
| `TERRAIN_KIND.INVISIBLE` | yes | no | none |

Tilemaps declare the terrain mode:

```js
terrainRenderMode: 'contained-autotile'
```

`defineTilemap()` requires exactly one `terrainLayer()` layer. The archived `buildTerrain` string-grid layer is rejected by authored tilemap validation; legacy local drafts may still be normalized into the current terrain layer shape at editor/storage boundaries.

## Rendering

Contained terrain reads `renderLayers.containedTerrainTiles`.

Each visible terrain cell produces one 16px visual tile:

```js
{
  layer: 'terrain',
  x, y, w: 16, h: 16,
  col, row,
  kind,    // terrain kind, such as 'grass'
  rawMask, // raw visible-neighbor adjacency for same/connectable terrain kinds
  mask     // normalized visual 8-neighbor adjacency
}
```

The visual tile stays inside its terrain cell. Contained terrain is a strict visual/collision audit layer: every contained-terrain pixel is clipped to its authored 16×16 `terrain` cell. Visuals that intentionally overhang, animate beyond the cell, or are authored/generated independently (grass details, foliage, ropes, chains, trees, etc.) must live in separate render layers, not contained terrain.

`rawMask` stores raw 8-neighbor visual connectivity for terrain kinds that connect to the source kind. `mask` is the cleaned visual mask used by the renderer. Cardinal bits (`N`, `E`, `S`, `W`) are preserved exactly. Diagonal bits are kept only when both adjacent cardinals are present:

```js
NE = rawNE && N && E
SE = rawSE && S && E
SW = rawSW && S && W
NW = rawNW && N && W
```

This removes diagonal-only visual connections while preserving authored truth for debugging.

Contained-terrain selection is deterministic and non-WFC. Rendering composes bounded primitives in a fixed order: base fill, exposed edge strips, outer corners, inner-corner notches, then future details. Edge/corner topology comes from the cleaned `mask`; optional cosmetic variation must be derived from stable tile identity, never runtime randomness or draw order.

## Collision

Collision derives from solid terrain cells:

```text
one 16px terrain cell => four 8px terrain primitives
```

The compiled tilemap exposes:

```js
scene.terrain = {
  layerId: 'terrain',
  cellSize: CELL_SIZE.BUILD,
  cells,
  cellMap
};

scene.collisionLayers = {
  terrainPrimitives, // 8px cells for debug/inspection
  terrainRects       // greedy-merged physics rects
};
```

Physics and gameplay queries use `collisionLayers.terrainRects` or the public tilemap query helpers.

## Debugging

Current terrain/physics overlays:

- show authored terrain cells
- show collision cells
- show collision rects
- show physics body rects

These overlays are additive and can be combined to compare authored terrain, derived collision, merged physics shapes, and actor bodies.
