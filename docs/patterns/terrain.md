# Terrain pipeline

Terrain uses explicit cell sizes and separates authored terrain, visual terrain, and collision terrain.

Related:

- [Tilemaps](./tilemaps.md)
- [Developer toolbox patterns](./devtools.md)
- [ADR 0003](../adr/0003-contained-terrain-scale.md)

## Cell sizes

Import cell sizes from `src/core/constants.js`:

```js
export const CELL_SIZE = Object.freeze({
  GRID: 32,
  BUILD: 16,
  TERRAIN_PRIMITIVE: 8
});
```

Use names, not raw numbers, in tilemap definitions.

| Cell size | Meaning |
| --- | --- |
| `CELL_SIZE.GRID` | 32px macro gameplay/entity grid |
| `CELL_SIZE.BUILD` | 16px authored terrain and visual autotile grid |
| `CELL_SIZE.TERRAIN_PRIMITIVE` | 8px derived terrain collision primitive grid |

## Authoring new terrain

New terrain should be authored as `buildTerrain` at `CELL_SIZE.BUILD`:

```js
import { CELL_SIZE } from '../../../core/constants.js';
import { defineTilemap, gridLayer } from '../../../core/tilemaps/tilemap.js';
import { playerSpawner, solidTerrain } from '../objects.js';

export const exampleMap = defineTilemap({
  id: 'example-map',
  cols: 4,
  rows: 2,
  terrainRenderMode: 'contained-autotile',
  layers: [
    gridLayer({
      id: 'buildTerrain',
      cellSize: CELL_SIZE.BUILD,
      symbols: { '#': solidTerrain },
      rows: [
        '........',
        '..####..',
        '..####..',
        '########'
      ]
    }),
    gridLayer({
      id: 'entities',
      cellSize: CELL_SIZE.GRID,
      symbols: { P: playerSpawner },
      rows: [
        '.P..',
        '....'
      ]
    })
  ]
});
```

Layer dimensions derive from map `cols`/`rows` and each layer's `cellSize`:

```txt
layer columns = cols * CELL_SIZE.GRID / layer.cellSize
layer rows    = rows * CELL_SIZE.GRID / layer.cellSize
```

For example, a `24x12` map has:

- `entities`: `24x12` cells
- `buildTerrain`: `48x24` cells
- derived terrain primitives: `96x48` cells

## Contained-autotile rendering

`terrainRenderMode: 'contained-autotile'` means:

- Visual terrain is drawn from `renderLayers.containedTerrainTiles`.
- Each solid `buildTerrain` cell draws one contained 16px tile.
- Visual terrain must stay inside the build cell and therefore inside collision solids.
- Deterministic neighbor masks choose exposed edges/corners.
- Interior seams should be absent or subtle.

The current procedural terrain art is intentionally debug-like. It exists to validate scale, collision, and border continuity before custom PNG tiles are introduced.

## Collision derivation

Collision derives from `buildTerrain`:

```txt
one 16px # build cell => four 8px terrain primitives
```

Runtime collision data lives in `scene.collisionLayers`:

```js
scene.collisionLayers = {
  terrainPrimitives, // 8px cells for debug/inspection
  terrainRects       // greedy-merged physics rects
};
```

Physics and gameplay systems should use public collision query helpers such as `solidTileRectsOverlapping()` rather than reading render data directly.

## Legacy terrain

Legacy maps may still use `terrainRenderMode: 'legacy-dual-grid'` and `terrain` layers during migration. Legacy render and collision fallbacks must be marked in code with:

```js
/**
 * @deprecated TODO(new-terrain): explain the replacement and deletion condition.
 */
```

Do not add new features to the legacy Kenney/dual-grid terrain path.
