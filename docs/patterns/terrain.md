# Terrain pipeline

Terrain uses explicit cell sizes and separates authored terrain, visual terrain, and collision terrain.

## Cell sizes

| Constant | Size | Use |
| --- | ---: | --- |
| `CELL_SIZE.GRID` | 32px | gameplay placement grid |
| `CELL_SIZE.BUILD` | 16px | authored terrain and visual autotile grid |
| `CELL_SIZE.TERRAIN_PRIMITIVE` | 8px | derived collision primitive grid |

## Authoring terrain

Solid terrain is authored as `buildTerrain` at `CELL_SIZE.BUILD`:

```js
gridLayer({
  id: 'buildTerrain',
  cellSize: CELL_SIZE.BUILD,
  symbols: { '#': solidTerrain },
  rows: [
    '................',
    '....########....'
  ]
})
```

Use `#` for solid build cells and `.` for empty cells.

Tilemaps declare the terrain mode:

```js
terrainRenderMode: 'contained-autotile'
```

`defineTilemap()` validates that authored solid terrain uses `buildTerrain`; a `terrain` layer is not supported.

## Rendering

Contained terrain reads `renderLayers.containedTerrainTiles`.

Each solid `buildTerrain` cell produces one 16px visual tile:

```js
{
  layer: 'buildTerrain',
  x, y, w: 16, h: 16,
  col, row,
  rawMask, // raw authored 8-neighbor adjacency
  mask     // normalized visual 8-neighbor adjacency
}
```

The visual tile stays inside its build cell. Contained terrain is a strict visual/collision audit layer: every contained-terrain pixel is clipped to its authored 16×16 `buildTerrain` cell. Visuals that intentionally overhang, animate beyond the cell, or are authored/generated independently (grass, foliage, ropes, chains, trees, etc.) must live in separate render layers, not contained terrain.

`rawMask` stores authored 8-neighbor adjacency. `mask` is the cleaned visual mask used by the renderer. Cardinal bits (`N`, `E`, `S`, `W`) are preserved exactly. Diagonal bits are kept only when both adjacent cardinals are present:

```js
NE = rawNE && N && E
SE = rawSE && S && E
SW = rawSW && S && W
NW = rawNW && N && W
```

This removes diagonal-only visual connections while preserving authored truth for debugging.

Contained-terrain selection is deterministic and non-WFC. Rendering composes bounded primitives in a fixed order: base fill, exposed edge strips, outer corners, inner-corner notches, then future details. Edge/corner topology comes from the cleaned `mask`; optional cosmetic variation must be derived from stable tile identity, never runtime randomness or draw order.

## Collision

Collision derives from `buildTerrain`:

```text
one 16px # build cell => four 8px terrain primitives
```

The compiled tilemap exposes:

```js
scene.collisionLayers = {
  terrainPrimitives, // 8px cells for debug/inspection
  terrainRects       // greedy-merged physics rects
};
```

Physics and gameplay queries use `collisionLayers.terrainRects`.

## Debugging

Current terrain/physics overlays:

- show build terrain cells
- show collision cells
- show collision rects
- show physics body rects

These overlays are additive and can be combined to compare authored terrain, derived collision, merged physics shapes, and actor bodies.
