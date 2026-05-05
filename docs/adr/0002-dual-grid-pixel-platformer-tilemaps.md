# ADR 0002: Dual-grid Pixel Platformer tilemaps

## Status
Accepted

## Context
The current tilemap system uses a single ASCII grid for collision and rendering with 70px cells. Kenney Pixel Platformer is CC0 and uses 18×18 pixel tiles. We want richer Pixel Platformer terrain without upscaling assets and without making collision depend on visual autotile details.

## Decision
- Keep collision/gameplay cell-based.
- Add render-only dual-grid terrain generated from semantic terrain cells.
- Use `tileSize = 36` for logical gameplay cells and `artTileSize = 18` for source art.
- One logical terrain cell renders as a `2×2` group of 18px art tiles.
- Keep ASCII semantic authoring (`#`, `=`, `^`, object/decor layers) with per-map metadata (`theme`, `tileSize`, `artTileSize`).
- Precompute `renderLayers.terrainVisuals` during `parseTilemap()`.
- Use a rule-based subtile selector first, behind a semantic manifest for `kenney-pixel-platformer:grass`.
- Vendor the full Kenney Pixel Platformer asset pack with source/license metadata.
- Convert all current tilemap definitions to basic 36px maps in the first slice.
- Keep old medieval assets temporarily for gate/decor fallbacks.
- Defer player/enemy art replacement and map editor upgrades.

## Consequences
- Gameplay constants and spawn/hazard sizes must derive from `level.tileSize`.
- Render code draws precomputed terrain visuals instead of hand-shading every terrain cell.
- Future asset packs can vary `artTileSize` and themes without changing collision.
