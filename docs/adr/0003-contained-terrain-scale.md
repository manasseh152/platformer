# ADR 0003: Contained terrain scale and collision pipeline

## Status

Accepted.

## Context

Terrain needs a single source of truth for authoring, rendering, and collision. Visual terrain must never imply walkable or blocking space that is absent from collision. Debug overlays also need stable, named cell sizes so map review can compare authored solids, collision primitives, merged physics rects, and actor bodies without switching rendering systems.

## Decision

Use three explicit cell sizes:

| Constant | Size | Purpose |
| --- | ---: | --- |
| `CELL_SIZE.GRID` | 32px | gameplay placement grid for actors, goals, decor, backdrop, and hazards |
| `CELL_SIZE.BUILD` | 16px | terrain authoring and visual tile grid |
| `CELL_SIZE.TERRAIN_PRIMITIVE` | 8px | derived collision primitive grid |

Authored solid terrain uses one layer:

```js
gridLayer({
  id: 'buildTerrain',
  cellSize: CELL_SIZE.BUILD,
  symbols: { '#': solidTerrain },
  rows: [/* 16px cells */]
})
```

Tilemaps use:

```js
terrainRenderMode: 'contained-autotile'
```

Contained-autotile visuals render one 16px tile inside each solid `buildTerrain` cell. Visual terrain must stay inside the authored cell and therefore inside collision solids. Tile selection is deterministic from build-terrain neighbors for now; detail variation can be layered on later.

Collision derives from `buildTerrain`: each 16px solid build cell expands to four 8px terrain primitives, and physics rects are greedy-merged from those primitives.

```js
scene.collisionLayers = {
  terrainPrimitives,
  terrainRects
};

scene.renderLayers = {
  containedTerrainTiles
};
```

Collision query APIs read `scene.collisionLayers.terrainRects`.

## Consequences

- New maps use `buildTerrain` + `CELL_SIZE.BUILD` for solid terrain.
- Entity placement and non-terrain layers use `CELL_SIZE.GRID` unless a layer has a specific reason to use another supported cell size.
- Debug overlays show authored build cells, terrain primitives, merged terrain rects, and actor bodies independently.
- Terrain render components are marker-only: `{ type: 'render:terrain' }`.
- Terrain visuals are constrained to authored solid cells, making rendered terrain and collision easy to audit.
