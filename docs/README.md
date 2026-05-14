# Project docs

This directory is the project handbook. It documents **current working patterns** for developers and the **asset handoff source** for artists/designers.

## Start here

| You need to... | Read |
| --- | --- |
| Create or replace art | [`asset-creator-source.md`](./asset-creator-source.md) |
| Add gameplay/content maps | [`patterns/tilemaps.md`](./patterns/tilemaps.md), [`patterns/terrain.md`](./patterns/terrain.md), [`patterns/scenes-and-scenarios.md`](./patterns/scenes-and-scenarios.md) |
| Change rendering/assets | [`patterns/rendering.md`](./patterns/rendering.md), [`adr/0005-render-pipeline-packets-and-backends.md`](./adr/0005-render-pipeline-packets-and-backends.md), [`adr/0009-render-backend-maturity-and-parity-gates.md`](./adr/0009-render-backend-maturity-and-parity-gates.md) |
| Change UI/settings/menus | [`patterns/settings-and-ui.md`](./patterns/settings-and-ui.md), [`patterns/map-editor.md`](./patterns/map-editor.md) |
| Add developer validation content | [`patterns/gyms.md`](./patterns/gyms.md), [`patterns/devtools.md`](./patterns/devtools.md) |
| Move files or add modules | [`patterns/source-layout.md`](./patterns/source-layout.md) |
| Check refactor priorities before new systems | [`patterns/foundation-review.md`](./patterns/foundation-review.md) |

## Audience contract

- **Developers** should get ownership boundaries, import patterns, APIs, validation commands, and links to the code that owns the truth.
- **Asset creators** should not need to read implementation internals. They should get scale, constraints, IDs/paths, anchors, animation requirements, license expectations, and review artifacts.
- When asset work depends on code, prefer linking the relevant pattern/doc section or a small code block instead of duplicating large technical details in an art brief.

## Source-of-truth map

| Truth | Primary source | Mirrored for creators? |
| --- | --- | --- |
| Camera/grid/body/hitbox numbers | `src/core/constants.js` | Yes, in [`asset-creator-source.md`](./asset-creator-source.md) |
| Authored tilemap shape | `src/core/tilemaps/**`, `src/content/tilemaps/**` | Linked from asset source; details in [`patterns/tilemaps.md`](./patterns/tilemaps.md) |
| Terrain containment/collision rules | `src/core/tilemaps/terrain-*.js`, [`patterns/terrain.md`](./patterns/terrain.md) | Yes, summarized in asset source |
| Runtime asset IDs/loaders | `src/render/assets/**`, `src/assets/**`, `public/assets/**` | Yes, in asset source |
| Scenario/catalog behavior | `src/catalog/**`, `src/content/**` | No, developer docs only unless it changes asset use |
| Historical architecture decisions | `docs/adr/**` | No; ADRs are references, not artist handoff docs |

## Pattern docs

Pattern docs describe the current intended shape:

- [`patterns/source-layout.md`](./patterns/source-layout.md) — source root policy, folder ownership, and import rules.
- [`patterns/scenes-and-scenarios.md`](./patterns/scenes-and-scenarios.md) — runtime scenes, launchable scenarios, gyms, zoos, and app/session boundaries.
- [`patterns/tilemaps.md`](./patterns/tilemaps.md) — composable tilemap authoring with objects, layers, and components.
- [`patterns/terrain.md`](./patterns/terrain.md) — contained terrain authoring, render, and collision derivation pipeline.
- [`patterns/rendering.md`](./patterns/rendering.md) — render helpers and renderer migration boundaries.
- [`patterns/settings-and-ui.md`](./patterns/settings-and-ui.md) — settings/menu UI state, persistence, and motion rules.
- [`patterns/map-editor.md`](./patterns/map-editor.md) — browser map editor UX, save, preview, and local draft conventions.
- [`patterns/devtools.md`](./patterns/devtools.md) — Developer Mode toolbox registry, runtime UI, debug overlays, and playbook boundaries.
- [`patterns/gyms.md`](./patterns/gyms.md) — machine-based in-engine validation scenarios.
- [`patterns/speedrun.md`](./patterns/speedrun.md) — Speed Run Mode timing, local records, attempt lifecycle, and UI rules.
- [`patterns/asset-creator.md`](./patterns/asset-creator.md) — how to maintain the artist/designer handoff source.
- [`patterns/foundation-review.md`](./patterns/foundation-review.md) — living foundation audit before major systems.

## ADRs

ADRs record important decisions and migration history. Prefer pattern docs for day-to-day implementation. Read ADRs when changing the decision area:

- `0001` ECS/project boundary realignment.
- `0002` tilemap terminology migration.
- `0003-contained-terrain-scale` contained terrain scale and collision pipeline.
- `0003-core-input-system` core input system. The duplicate `0003` numbering is historical.
- `0004` foundation review gate.
- `0005` render pipeline packets/backends.
- `0006` machine-based gyms.
- `0007` deferred 2D lighting primitives.
- `0008` layered menu navigation and reusable UI primitives.
- `0009` render backend maturity and parity gates.

## Maintenance rules

- Update docs in the same change as code/assets when behavior, scale, IDs, file ownership, or workflow changes.
- Keep docs current-state focused. Move historical context to ADRs or issues.
- Do not leave stale TODOs in docs; document only current constraints or accepted next slices.
- Link to deeper docs/code instead of copying the same rule into many places.
- For visual, tilemap, or render changes, produce or validate a full-map PNG review artifact.

Useful validation:

```sh
bun run build
bunx playwright test --project=chromium
bun run validate:map-render
bun run validate:foundation
```
