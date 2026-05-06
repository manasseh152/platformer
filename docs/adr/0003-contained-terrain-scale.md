# ADR 0003: Contained terrain scale and collision pipeline

## Status

Accepted.

## Context

The project previously used a 36px full tile, 18px art tile, and Kenney dual-grid terrain assets. That made the terrain pipeline hard to reason about during development:

- `TILE_SIZE` described gameplay grid size, not visual tile size.
- `artTileSize` was also a tile size, but with different semantics.
- Layer `resolution` described cells per full tile indirectly.
- The offset dual-grid renderer could draw terrain outside collision rects, which is misleading for platformer development.
- Collision debugging needs to be clearer than asset-driven terrain rendering.

We want a minimal custom terrain path where collision is the source of truth, visual terrain stays contained inside solids, and tile/cell terminology maps to concrete sizes.

## Decision

Use three named cell sizes:

```js
CELL_SIZE = {
  GRID: 32,
  BUILD: 16,
  TERRAIN_PRIMITIVE: 8
}
```

Meanings:

- `CELL_SIZE.GRID` is the macro gameplay/entity authoring grid.
- `CELL_SIZE.BUILD` is the normal terrain authoring and visual autotile grid.
- `CELL_SIZE.TERRAIN_PRIMITIVE` is the derived terrain collision primitive grid.

New tilemap layers use `cellSize` from `CELL_SIZE`; the public `resolution` API is removed for new code.

Normal new terrain authoring uses a `buildTerrain` layer at 16px cells. Each `#` in `buildTerrain` expands to a solid `2x2` block of 8px terrain primitives. Greedy-merged collision rects are derived from those 8px primitives.

New terrain rendering uses explicit mode:

```js
terrainRenderMode: 'contained-autotile'
```

Contained-autotile visuals render one 16px tile inside each solid `buildTerrain` cell. Visual terrain must not protrude outside collision solids. Tile selection is deterministic from build-terrain neighbors for now; WFC/detail variation can be layered on later.

New collision data lives in:

```js
scene.collisionLayers = {
  terrainPrimitives,
  terrainRects
}
```

Collision query APIs should read `scene.collisionLayers` first. Legacy `renderLayers` collision fallback is temporary and must be marked with `TODO(new-terrain)` deprecation comments.

## Consequences

- The global gameplay grid changes from 36px to 32px.
- Actor body sizes and spawn offsets must be scaled to the 32px grid.
- New maps should use `buildTerrain` + `cellSize: CELL_SIZE.BUILD` for terrain and `entities` + `cellSize: CELL_SIZE.GRID` for entity placement.
- Existing `terrain` layers and legacy Kenney/dual-grid render data remain temporary migration paths only.
- Debug overlays should distinguish:
  - 16px build terrain cells
  - 8px collision primitive cells
  - greedy-merged collision rects
  - actor physics body rects
- Raw terrain debug render is legacy-only and should not be part of the contained-autotile workflow.

## Migration rule

Migrate one tracer map at a time. A migrated map should declare `terrainRenderMode: 'contained-autotile'`, rename terrain authoring to `buildTerrain`, use `CELL_SIZE.BUILD`, and rely on `collisionLayers` for terrain collision.
