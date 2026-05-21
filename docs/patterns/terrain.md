---
title: Solid layers
---

# Solid layers

The **Solid Layer** replaces legacy Terrain language for authored ground, walls, and other static solid surfaces. The current file path remains `terrain.md` temporarily for link stability.

Solid layers use explicit cell sizes and separate authored brush-grid cells, visual contained-autotile output, and merged solid collision artifacts.

## Cell sizes

| Constant | Size | Use |
| --- | ---: | --- |
| `CELL_SIZE.GRID` | 32px | gameplay placement grid |
| `CELL_SIZE.BUILD` | 16px | terrain authoring and visual autotile grid |
| `CELL_SIZE.TERRAIN_PRIMITIVE` | 8px | derived collision primitive grid |

## Authoring solid layers

Canonical v2 solid surfaces are authored with `solidLayer()` / `brushGridLayer()` at `CELL_SIZE.BUILD` using `BrushId | null` rows. Legacy `terrainLayer()` is still accepted as a compatibility alias for one migration slice:

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

`solidLayer()` creates a brush-grid layer with `id: 'solid'`, `type: 'brush-grid'`, `accepts: ['visual', 'solid']`, and `BrushId | null` cells. Use `null` for empty cells and stable brush IDs such as `grass`, `stone`, or `invisible-solid` for authored solid cells. `terrainLayer()` still creates legacy `terrain` inputs, which the compiler normalizes to the Solid Layer model.

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
scene.solid = {
  layerIds: ['solid'],
  cellSize: CELL_SIZE.BUILD,
  cells,
  cellMap
};

scene.collisionLayers = {
  solidPrimitives, // 8px cells for debug/inspection
  solidRects,      // greedy-merged physics rects

  // temporary compatibility aliases
  terrainPrimitives,
  terrainRects
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
