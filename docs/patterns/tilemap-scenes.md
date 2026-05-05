# Tilemap scenes

Tilemaps are composable scene data, not hard-coded `terrainRows/objectRows/decorRows` blobs.

## Authoring API

Use one canonical pattern:

```js
import { defineTilemapScene, gridLayer } from '../tilemap.js';
import { finishGateObject, playerSpawner, slimeSpawner, solidTerrain } from '../objects.js';

export const movementGymMapDefinition = {
  tileSize: 36,
  artTileSize: 18,
  theme: 'kenney-pixel-platformer:grass',
  layers: [
    gridLayer({
      id: 'terrain',
      symbols: { '#': solidTerrain },
      rows: [
        '########',
        '#......#',
        '########'
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

export const movementGymMap = defineTilemapScene({
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

Removed from the core model for now: spikes, platforms, block variants, decor, backdrop, and `<G>` gate side markers.

Use `GGG` for a three-cell finish gate. One character should represent one occupied grid cell.

## Object definitions

Layer symbols point to reusable object definitions. Avoid inline component lists in map files.

```js
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

A `spawner(otherObject)` component means “instantiate that object at this placement during gameplay scene assembly.” Static terrain does not need to spawn anything; it is already a scene object.

## Parser output

`defineTilemapScene()` validates and compiles layers into:

- `layers`: authoring grids and symbol mappings
- `objects`: one scene object per non-empty cell
- `componentIndex`: cached lookup by component type
- `worldWidth/worldHeight`, `cols/rows`, `tileSize`
- derived render/collision artifacts

Scene object shape:

```js
{
  id: 'terrain:4,8',
  layerId: 'terrain',
  symbol: '#',
  definitionId: 'solid-terrain',
  transform: { col: 4, row: 8, x: 144, y: 288, w: 36, h: 36 },
  components: [...]
}
```

Systems query components, not layer names or symbols:

```js
findObjectsWithComponent(scene, 'collision:solid')
findObjectsWithComponent(scene, 'spawner')
findObjectsWithComponent(scene, 'render:terrain')
```

## Dual-grid rendering

Map symbols express semantic occupancy, not final art tiles.

`#` means “solid terrain.” The renderer derives terrain primitives from neighboring solid terrain cells. Dual-grid should remain a render/collision strategy over scene objects, not a special authored layer format.

Current rule:

- authored grid remains normal
- solid terrain objects are indexed
- dual-grid primitives are derived from neighbor masks
- collision rects are derived from the same terrain occupancy

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
- layers share dimensions
- non-empty symbols are defined

Gameplay requirements belong to gameplay assembly or editor checks, not the generic parser. Examples: “must have a player,” “spawn should stand on ground,” or “gate should be contiguous.”
