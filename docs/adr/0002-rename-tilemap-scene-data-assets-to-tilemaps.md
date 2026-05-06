# ADR 0002: Rename tilemap scene data assets to tilemaps

- Status: Accepted
- Date: 2026-05-06

## Context

The project now distinguishes runtime scenes, scenarios, gameplay sessions, and ECS-ish scene/object/component data. Documentation already says:

- Runtime **scenes** are lifecycle components in the scene stack.
- **Scenarios** are launchable catalog entries.
- **Tilemap scene definitions** are parsed tilemap data assets used by gameplay scenarios.
- Tilemaps are one authoring format that compiles grid layers into ECS-ish scene objects.

The name `defineTilemapScene()` and related identifiers blur those boundaries. They imply a tilemap is itself a runtime scene, when it is actually authored spatial data that can be compiled into scene-shaped ECS data and consumed by a gameplay runtime scene.

This ambiguity will get worse before the next terrain pass, because terrain layers are about to gain explicit resolution (`resolution: 2` for half-grid, later `4`, `8`, etc.), generated collision cells/rects, and development/debug tilesets. Those changes should land on the corrected domain language rather than expanding `tilemapScene` terminology.

## Decision

Before continuing the half-grid terrain/collision pass, migrate tilemap data asset terminology from **tilemap scene** to **tilemap**.

Target terminology:

```txt
Tilemap: authored spatial data asset, including grid layers, symbols, dimensions, theme, and generated artifacts.
Scene object/component model: normalized ECS-ish data shape used by systems.
Gameplay runtime scene: lifecycle code that simulates a gameplay session.
Scenario: catalog entry that launches runtime scenes and may reference a tilemap.
```

## Required migration scope

Implement the data-asset terminology rename:

- `defineTilemapScene()` -> `defineTilemap()`.
- `kind: 'tilemap-scene'` -> `kind: 'tilemap'`.
- Tilemap registry naming from `tilemapScenes` / `tilemap scene registry` toward `tilemaps` / `tilemap registry`.
- Scenario props from `tilemapSceneId` toward `tilemapId`.
- App/session state from `tilemapScene` toward `tilemap` where practical.
- Docs and tests updated to use tilemap terminology.

Runtime scene stack terminology must remain unchanged. The runtime `gameplay` scene is still a scene. Only tilemap data assets stop using `scene` in their name.

## Compatibility policy

Prefer a coherent migration over adding long-lived aliases. Temporary aliases are acceptable only inside the migration commit/session if they reduce churn, but the completed pass should not expose new code paths that require `tilemapScene` naming.

External/user-facing UI may still say “Level Select” where appropriate. Internal code should use scenario/tilemap terms.

## Out of scope

This ADR does not implement half-grid terrain. That work resumes after the terminology migration and should use the new names.

This ADR also does not require a full cleanup of all runtime gameplay implementation details if they are unrelated to tilemap data assets. However, any code touched for tilemap lookup, launch props, registries, or gameplay session inputs should move to `tilemap` naming.

## Consequences

Positive:

- Restores the intended distinction between runtime scenes and tilemap data assets.
- Prevents new terrain/collision APIs from being built on confusing terminology.
- Makes future docs easier: scenarios launch runtime scenes; gameplay consumes tilemaps.

Negative / risks:

- The rename will touch many files: content definitions, registry, scenario props, app/menu wiring, tests, and docs.
- Some compatibility names may be needed during the migration, but they should be removed before considering the pass complete.

## Follow-up terrain decisions preserved

After this ADR is implemented, continue the terrain pass with these already-agreed decisions:

- Use `#`/`.` for terrain occupancy.
- Terrain authoring can use explicit layer `resolution`, e.g. `resolution: 2` for half-grid.
- Scene/tilemap dimensions are explicit via `cols` and `rows`.
- `tileSize` should come from the project `TILE_SIZE` constant, not per-map authoring.
- Collision generation starts with AABB-only shapes.
- Keep both raw collision cells and greedy-merged collision rects.
- Use a 2D greedy AABB merge similar to `.temp/greedy-merge-aabbs-2d.ts`.
