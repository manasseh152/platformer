---
title: Asset creator source
---

# Asset creator source

Living brief for artists/designers creating or replacing game assets. It mirrors the code-owned facts a creator needs without requiring them to read the whole codebase.

Related technical docs: [asset handoff pattern](./patterns/asset-creator.md), [terrain](./patterns/terrain.md), [tilemaps](./patterns/tilemaps.md), [rendering](./patterns/rendering.md).

## Quick brief

- Style: cozy medieval chibi platformer, readable silhouettes, crisp pixel art.
- Native game view: `320×180` logical pixels.
- Default world view: `640×360` world pixels because camera zoom is `0.5`.
- Gameplay grid: `32×32` world pixels.
- Terrain art grid: `16×16` world pixels, contained inside each cell.
- Collision primitive grid: `8×8` world pixels, derived from terrain.
- Current terrain kinds: `grass`, `dirt`, `stone`, `invisible`.
- Every imported pack needs source/license files beside the copied assets.

## Code references for developers

When this brief and code disagree, code is the source of truth and this file should be updated.

| Need | Code/doc source |
| --- | --- |
| Scale constants | `src/core/constants.js` |
| Browser image IDs/load map | `src/render/assets/browser-assets.js` |
| Kenney Pixel Platformer manifest | `src/assets/kenney-pixel-platformer-manifest.js` |
| Authored tilemap examples | `src/content/tilemaps/**`, `src/content/gyms/**` |
| Tilemap API | `docs/patterns/tilemaps.md` |
| Terrain containment/collision | `docs/patterns/terrain.md` |
| Render packet/asset backend decisions | `docs/adr/0006-render-pipeline-packets-and-backends.md` |

Minimal terrain authoring shape creators may see in implementation notes:

```js
terrainLayer({
  cellSize: CELL_SIZE.BUILD, // 16px
  rows: [
    [null, K.GRASS, K.GRASS],
    [K.STONE, K.STONE, K.STONE]
  ]
})
```

Minimal object-grid shape creators may see in map briefs:

```txt
P = player spawn, E = slime, GGG = three-cell finish gate
. = empty 32px gameplay cell
```

## Current game scale

| Field | Current value |
| --- | --- |
| Camera canvas | `320×180` logical pixels |
| Default camera zoom | `0.5` world-to-screen scale |
| Default world view | `640×360` world pixels |
| Gameplay/entity grid | `32×32` world pixels |
| Terrain authoring/visual grid | `16×16` world pixels |
| Collision primitive grid | `8×8` world pixels |
| Player collision body | `28×40` world pixels |
| Player draw box | `30×42`, offset `-1,-2` from body |
| Slime collision/draw box | `32×24` world pixels |
| Attack slash hitbox | `42×24`, offset `+22,+8` |

Author assets to this gameplay scale. If source art uses another native tile size, document its scale mapping in the manifest/brief before shipping it.

## Visual direction

- Cozy medieval dungeon/platformer with chibi proportions.
- Pixel art should stay crisp at integer scale and avoid subpixel-dependent details.
- Gameplay readability beats texture detail: collision silhouettes, hazards, exits, and interactables must read instantly.
- Foreground interactables should contrast against contained terrain and dark ambient lighting.
- UI/input glyphs may be SVG when resolution-independent presentation is required.

## Runtime asset locations

| Location | Purpose |
| --- | --- |
| `src/assets/**` | Bundled game art imported by Vite/runtime modules. |
| `public/assets/**` | Static browser assets addressed by URL, such as input prompt SVGs. |
| `src/render/assets/browser-assets.js` | Browser image loader and compatibility asset map. |
| `src/assets/kenney-pixel-platformer-manifest.js` | Kenney Pixel Platformer source tile manifest. |
| `src/content/**` | Authored tilemaps, object prefabs, scenario metadata, and asset usage context. |

## Current runtime image IDs

These IDs are referenced by code. Rename only when updating the asset registry and consumers in the same change.

| ID/path | Current source | Use |
| --- | --- | --- |
| `stoneFill` | `src/assets/kenney-medieval/stone-fill.png` | Stone terrain fill/detail. |
| `stoneTop` | `src/assets/kenney-medieval/stone-top.png` | Stone terrain top edge/detail. |
| `stoneBlock` | `src/assets/kenney-medieval/stone-block.png` | Stone block tile/detail. |
| `spikes` | `src/assets/kenney-medieval/spikes.png` | Hazard spikes. |
| `gate`, `gateLeft`, `gateCenter`, `gateRight` | `src/assets/kenney-medieval/gate*.png` | Finish gate visuals; support `GGG` placement. |
| `torch` | `src/assets/kenney-medieval/torch.png` | Torch prop/light anchor. |
| `bannerRed`, `bannerGreen`, `flag` | `src/assets/kenney-medieval/*` | Decorative props. |
| `pixelPlatformer.themes.grass.terrain.*` | `src/assets/kenney-pixel-platformer/Tiles/tile_*.png` | Grass terrain source sprites. |
| `pixelPlatformer.themes.grass.hazards.spikes` | `tile_0068.png` | Grass-theme spike source sprite. |
| `public/assets/kenney-input-prompts/**` | Kenney Input Prompts SVG subset | Control/input hint icons. |

## Terrain asset rules

- Terrain tiles are authored and drawn in `16×16` cells.
- A visible terrain tile must stay inside its `16×16` cell. No intentional overhangs in terrain tiles.
- Overhanging details such as grass blades, foliage, chains, ropes, trees, particles, and animated props belong in separate render/object layers.
- Terrain variants must preserve the same collision semantics as the cell they represent.
- Cosmetic variation must be deterministic from tile identity, never runtime randomness.
- `invisible` terrain is solid but not visible; do not make art for it unless debugging.

## Object and character rules

- Keep important gameplay silhouettes inside the collision/draw boxes listed above.
- Hazards need a visible danger shape inside their damaging footprint.
- Finish-gate art should support a three-cell-wide placement (`GGG`) and read as the level exit.
- If an asset animates, specify frame size, frame order, frame duration, loop mode, and anchor point before implementation.
- If an asset casts or motivates light, specify intended color, radius, intensity, and owning object.

## Delivery checklist

1. Add files under `src/assets/<pack-or-feature>/` or `public/assets/<pack-or-feature>/`.
2. Add/update `SOURCE.md` and license text for copied third-party work.
3. Add/update the manifest or registry (`browser-assets.js`, pack manifest, or future atlas metadata).
4. Update this file with IDs, sizes, anchors, animation notes, and usage context.
5. Update tilemaps/objects/scenarios that consume the asset.
6. For visual/tilemap/rendering changes, generate or validate a full-map review PNG.
