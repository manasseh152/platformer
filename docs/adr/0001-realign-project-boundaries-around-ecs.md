# ADR 0001: Realign project boundaries around ECS-ish scene architecture

- Status: Accepted
- Date: 2026-05-06

## Context

The project currently has several generations of architecture living side by side. `src/core` contains both reusable primitives and product/content logic, while top-level `src/*.js` files still carry older level/app/runtime concepts. This makes it hard to improve the newer ECS-ish scene/object/component model because systems still depend on legacy level/tilemap helpers and mixed boundaries.

Examples of current boundary drift:

- Campaigns, gyms, zoos, scenarios, categories, and catalog registries live under `src/core`, even though they are app/content/catalog concepts.
- Tilemap scene definitions and compatibility `level` APIs coexist with newer scene/scenario terminology.
- Gameplay systems still use helper functions and tilemap/layer concepts where they should increasingly query scene objects/components.
- Browser/app code, runtime wrappers, settings, input, menu, render, and gameplay code are spread across top-level `src` files without a clear ownership model.

## Decision

We will migrate toward clear architectural boundaries while allowing commits to be large when they preserve one coherent invariant. We will not split the migration into tiny mechanical commits that leave the codebase in an illogical half-migrated state.

Target conceptual boundaries:

```txt
engine / core-ish
  Generic runtime, scene stack, scene/object/component primitives, queries, math, camera, viewport.

gameplay
  Platformer-specific gameplay session, rules, physics, player/enemy systems, goals, assembly.

content
  Authored campaigns, gyms, zoos, tilemap scene definitions, reusable authored objects.

catalog
  Generic catalog registry, categories, scenario entries, scenario service, URL launch helpers.

app / browser
  DOM composition, browser runtime adapters, input polling, settings persistence, menu, shell state.

render
  Canvas/WebGPU presentation, assets, draw systems.
```

## Commit sizing rule

A migration commit may be large if it can be summarized as one architectural invariant, for example:

- `core no longer contains catalog/content`
- `tilemap authored content lives in content`
- `the app launches scenarios, not levels`
- `gameplay collision queries scene components instead of layer symbols`

A commit is too mixed if it combines unrelated invariants, even if each individual file edit is small.

## Migration stages

### Stage 0: Document and enforce boundaries

- Keep this ADR as the migration tracker.
- Add/update boundary tests before or during code moves.
- Prefer docs that describe current intended shape over historical notes.

Progress: done. ADR created, docs index links it, and the existing `tests/core-boundary.spec.js` now passes with `src/core` free of catalog/content imports.

### Stage 1: Extract catalog/content/scenarios from `core`

Move content/catalog concepts out of `src/core`:

```txt
src/core/campaigns   -> src/content/campaigns
src/core/gyms        -> src/content/gyms
src/core/zoos        -> src/content/zoos
src/core/catalog     -> src/catalog
src/core/categories  -> src/catalog/categories
src/core/scenarios   -> src/catalog/scenarios
```

Update imports, docs, and boundary tests in the same commit.

Progress: done in `8908706`. Also moved the tilemap scene registry to `src/content/tilemaps/registry.js` so `src/core` does not import catalog modules. Full test suite passed: `75 passed`.

### Stage 2: Split authored tilemap content from tilemap/runtime helpers

Move authored definitions and reusable authored objects toward content:

```txt
src/core/tilemaps/definitions -> src/content/tilemaps/definitions
src/core/tilemaps/objects     -> src/content/tilemaps/objects.js
```

Keep the tilemap compiler/helper module in place temporarily if that reduces breakage. Decide later whether generic tilemap authoring belongs in `engine`, `content`, or `gameplay`.

Progress: done. Authored tilemap definitions and reusable tilemap objects now live under `src/content/tilemaps`; the tilemap registry imports content-local definitions, while `src/core/tilemaps/tilemap.js` remains as the temporary compiler/helper module with only core-local imports. Full test suite passed: `75 passed`.

### Stage 3: Rename/extract real generic core into engine

Move truly generic primitives when imports are stable:

```txt
src/core/scene          -> src/engine/scene
src/core/runtime.js     -> src/engine/runtime.js
src/core/scene-stack.js -> src/engine/scene-stack.js
src/core/viewport.js    -> src/engine/viewport.js
```

Camera may move to `engine` or `gameplay` depending on whether it remains generic or platformer-specific.

Progress: not started.

### Stage 4: Remove legacy `level` terminology and compatibility APIs

Replace level-centric flow with scenario/tilemap-scene terminology:

- `level-manager` becomes scenario/tilemap scene selection flow or disappears into scenario service/app shell.
- `tilemapLevelDefinition` aliases are removed.
- Gameplay session consistently receives a tilemap scene definition.
- User-facing UI may still say “Level Select” where appropriate, but internal code should use scenario/tilemap scene names.

Progress: not started.

### Stage 5: Migrate gameplay systems to scene object/component queries

Incrementally replace legacy helper/layer dependencies with ECS-ish queries:

- Spawn player/enemies from `spawner` components.
- Resolve collision from `collision:solid` scene objects.
- Resolve goals/finish gates from `transition` components.
- Render via `render:*` components where practical.
- Remove compatibility helpers as each responsibility migrates.

Progress: not started.

## Consequences

Positive:

- `core`/`engine` becomes reusable and easier to test.
- Campaigns, gyms, zoos, and scenarios become explicit content/catalog concepts.
- The ECS-ish model becomes the default integration point for gameplay/render systems.
- Future changes can be reviewed against clear boundaries.

Negative / risks:

- Some stages are intentionally larger and may touch many imports.
- During migration, temporary compatibility barrels or aliases may be needed to avoid breaking everything at once.
- Boundary tests must evolve with the migration, otherwise they can either block useful refactors or fail to catch drift.

## Tracking

Update the `Progress` line for each stage as work lands:

- `not started`
- `in progress`
- `done`
- `deferred`
