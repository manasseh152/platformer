# Foundation review pattern

This document is the living foundation review for the project. Keep it current when architecture, ownership, tests, or priorities change.

Related decision: [ADR 0004](../adr/0004-foundation-review-before-new-systems.md).

## Goal

Before adding major new systems, identify what is messy, why it is messy, and how to fix it safely.

Primary success criterion: future features should be easier to build because systems have clearer ownership, better reuse seams, stronger validation, and less transitional compatibility code.

## Non-goals

- Do not add a UI framework by default.
- Do not migrate wholesale to WebGPU/shaders before render boundaries are clear.
- Do not replace the ECS-ish scene/object/component model.
- Do not move platformer-specific code into `engine` just because it is reused.
- Do not split files solely because they are large.
- Do not delete compatibility helpers before active consumers are migrated.

## Audit principles

- Use code/docs/tests/import evidence, not vibes.
- Group findings by root boundary failure, not just symptoms.
- Large cohesive files are acceptable during feature discovery. Once stable or repeatedly edited, split by responsibility.
- Game runtime UI and editor UI are separate products. Share only low-level foundations with proven shared needs.
- Extract shared modules when there are at least two real consumers, or one imminent consumer with matching needs.
- Prefer neutral shared modules over feature-to-feature dependencies, such as runtime catalog code importing editor UI/tool modules.
- Migrate then remove. Delete immediately only when imports/tests/usage prove it is safe.

## Current green baseline

Validated for the tilemap compiler decomposition slice on 2026-05-09:

```sh
bun run build
bunx playwright test tests/tilemap.spec.js tests/core-boundary.spec.js --project=chromium
bun run validate:map-render
```

Full suite note: `bunx playwright test --project=chromium` still has known unrelated legacy/intermittent failures documented under earlier slices.

Before implementation slices, run the full suite:

```sh
bunx playwright test --project=chromium
```

For visual/tilemap/rendering slices, also run:

```sh
bun run validate:map-render
```

## Priority and confidence labels

Priority:

- `P0`: blocks safe feature work or causes active breakage.
- `P1`: should fix soon; repeated friction, wrong dependency direction, or reuse blocker.
- `P2`: cleanup/opportunistic hygiene.

Confidence:

- `High`: supported by docs/tests/imports/code evidence.
- `Medium`: likely from code shape but needs deeper implementation read.
- `Low`: suspicion only; investigate before planning changes.

## Architecture map

| Area | Current files | Intended ownership | Notes |
| --- | --- | --- | --- |
| Engine primitives | `src/engine/**` | Generic runtime/scene/viewport primitives | Keep conservative and browser-global free. |
| Core gameplay/domain | `src/core/**` | Platformer rules, camera, physics, input domain, tilemap compiler, pure tilemap draft schema/helpers | May depend on `engine`, not app/content/editor/browser. |
| Content | `src/content/**` | Authored campaigns, gyms, zoos, tilemaps, reusable authored objects, Chibi tilemap draft compilation | Should not depend on app/editor/UI. |
| Catalog | `src/catalog/**` | Scenario/category registries, scenario service, local-draft catalog integration | Does not import editor modules; protected by boundary test. |
| App/browser shell | top-level app modules, `src/app/**` | DOM, settings persistence, browser adapters, composition root | May compose all layers, but should pass smaller contexts over time. |
| Game UI | `src/menu.js`, `src/app/ui/**`, `src/settings-ui.js`, `src/scenes/menu-dom.js`, `styles/main.css` | Start/pause/settings/scenario browser/HUD/devtools shell | `src/menu.js` remains the shell/focus/event hotspot while scenario browser, settings navigation, and settings actions are focused modules. |
| Editor UI/tool | `src/editor/**`, `styles/map-editor.css` | Browser map editor shell, commands, viewport, persistence UI | Shared draft/data logic should move out of editor. |
| Rendering | `src/render.js`, `src/render/**`, `src/rendering/**`, `src/gpu/**` | World drawing, render helpers, future renderer backends | `src/render/world-renderer.js` owns canvas drawing; `src/render.js` remains the presentation facade. |
| Devtools | `src/devtools/**` | Developer-only toolbox/overlays | Keep gated and out of core gameplay logic. |

## Findings

### P1 / High — App UI ownership is unclear

Evidence:

- `src/menu.js` remains the menu setup, semantic-action, input-routing, and broad DOM event wiring facade.
- Scenario browser rendering/launch handling has been extracted to `src/app/ui/scenario-browser.js`.
- Settings category tab switching has been extracted to `src/app/ui/settings-navigation.js`.
- Settings actions, bind-listening, controller selection, raw settings, motion/GPU/developer toggles, and speedrun setting actions have been extracted to `src/app/ui/settings-actions.js`.
- Menu shell/focus, page transitions, menu chrome updates, pause/start flow, and main-menu return flow now live in `src/app/ui/menu-shell.js`.
- Docs describe scene-owned DOM and scene stack concepts, but only gameplay is a registered runtime scene today.
- `src/scenes/menu-dom.js` creates start/pause/settings/scenario browser markup, while behavior is split across `src/menu.js` and `src/app/ui/**` modules.

Direction:

- Keep `src/menu.js` as the compatibility facade until callers can depend on focused UI modules directly.
- Do not immediately migrate UI into scene-stack scenes.
- After decomposition, evaluate migrating one overlay/page at a time if scene ownership simplifies lifecycle/input.

### Partially completed — Input presentation is separated from legacy input state

Evidence:

- Semantic core input exists under `src/core/input/**` and remains the source of truth for runtime actions.
- Transitional bind state now lives in `src/app/input/legacy-bind-state.js`.
- DOM hint/scheme rendering now lives in `src/app/input/input-presentation.js`.
- Browser gamepad polling, controller diagnostics, and bind-status UI helpers now live in `src/app/input/controller-diagnostics.js`.
- Gameplay HUD/input hint presentation is now isolated in `src/app/ui/gameplay-hud.js`.
- `tests/core-boundary.spec.js` asserts the world renderer does not import HUD/input presentation modules or the legacy input facade.

Follow-up:

- The legacy `src/input.js` facade was removed after all repo-local imports moved to focused modules.
- Menu/settings code still uses transitional bind concepts and should migrate gradually when the settings UI is decomposed.
- Add characterization tests before changing actual bind/remap behavior.

### Completed — Catalog local drafts no longer depend on editor draft logic

Evidence:

- Pure draft schema/normalization/layer/entity helpers now live in `src/core/tilemaps/draft.js`.
- Chibi content symbol mapping and draft compilation now live in `src/content/tilemaps/draft-compiler.js`.
- `src/catalog/local-drafts/storage.js` and `src/tilemap-preview.js` import the shared modules directly instead of `src/editor/tilemap-draft.js`.
- `tests/core-boundary.spec.js` now asserts catalog modules do not import editor modules.

Follow-up:

- `src/editor/tilemap-draft.js` remains a compatibility re-export for editor callers and can be removed once editor imports move to the shared modules directly.

### P1 / High — Mutable `game` object is a broad compatibility context

Evidence:

- `src/state.js` creates `game` with runtime, UI, presenter, GPU, app state, gameplay session, mirrored player/enemy/camera fields, legacy input, semantic input runtime, settings, speedrun, devtools, scenarios, scene library, menu, and clock.
- It also writes `document.body.dataset.tilemapId`.

Direction:

- Keep `game` as app composition root for now.
- Stop passing full `game` into code that only needs a smaller slice.
- Introduce smaller contexts over time: gameplay, UI, render, editor.
- Remove mirrored gameplay fields only after callers use `game.gameplaySession` consistently.

### Completed — World rendering is separated from DOM HUD/UI updates

Evidence:

- `src/render/world-renderer.js` owns canvas world drawing, camera snap/subpixel calculations, tilemap/decor/actor drawing, and devtools debug overlays.
- `src/app/ui/gameplay-hud.js` owns HUD level name, messages, speedrun HUD, hearts, body classes, and input hint presentation.
- `src/render.js` remains a small presentation facade that coordinates world drawing, HUD presentation, and presenter output.
- `tests/core-boundary.spec.js` asserts the world renderer does not import HUD/input presentation modules or the legacy input facade.

Follow-up:

- Before shaders/WebGPU work, represent renderable concepts as data/plans where useful.
- Add characterization tests before changing HUD/message focus or speedrun display behavior.

### Completed — Tilemap compiler internals have focused ownership

Evidence:

- `src/core/tilemaps/tilemap.js` is now a compatibility facade that preserves public imports.
- `src/core/tilemaps/layers.js` owns grid layer parsing and layer constants.
- `src/core/tilemaps/compiler.js` owns tilemap definition validation and scene compilation.
- `src/core/tilemaps/terrain-model.js` owns terrain normalization and terrain-cell lookup.
- `src/core/tilemaps/collision.js` owns terrain collision primitive/rect derivation.
- `src/core/tilemaps/render-artifacts.js` owns contained-terrain render artifact derivation.
- `src/core/tilemaps/queries.js` owns compatibility gameplay/render query helpers.

Follow-up:

- Keep the facade until consumers can move opportunistically to focused modules.
- Continue using ECS-ish scene objects/components as the integration point.

### P1 / High — Current docs contain stale terrain contradictions

Evidence:

- `src/core/tilemaps/tilemap.js` rejects `buildTerrain` and requires modern `terrainLayer` with id `terrain`.
- `docs/patterns/tilemaps.md` describes the modern terrain layer.
- `docs/patterns/terrain.md` still says authored terrain uses `buildTerrain` and that `terrain` is unsupported.
- ADR numbering also has duplicate `0003` files.

Direction:

- Pattern docs must describe current intended shape.
- ADRs may remain historical, but add superseded/updated notes when they conflict with current patterns.
- Fix `docs/patterns/terrain.md` during the tilemap/terrain slice or a docs hygiene slice.

### P2 / High — CSS design primitives are duplicated between game and editor

Evidence:

- `styles/main.css` defines tokens and `.ds-*` primitives.
- `styles/map-editor.css` duplicates many token/button/focus primitives.

Direction:

- Extract shared low-level tokens/primitives only when both UIs need them.
- Keep game runtime UI and editor layout styles separate.
- Possible future files: `styles/tokens.css`, `styles/primitives.css`.

### P2 / Medium — Runtime event contracts are undocumented

Evidence:

- Events include `game.start`, `game.pause`, `game.reset`, `game.next-level`, `tilemap.switch`, `settings.change`, `scene.stack.*`, `gpu.presenter-enabled`, and others.
- Some names still use user-facing/legacy terminology.

Direction:

- Document event names if automation/playbooks begin depending on them.
- Rename only when touching related flows and tests can cover it.

### P2 / Medium — Browser globals are localized enough, but editor shell could be cleaner

Evidence:

- Core/engine boundary tests forbid browser globals and currently pass.
- Browser globals are expected in app/editor modules.
- `src/editor/map-editor.js` directly uses `document`, `window`, `localStorage`, `Date.now`, and `Math.random`.

Direction:

- Do not treat browser globals in browser shell files as defects.
- Extract pure editor commands/status/serialization logic behind an editor context when it improves tests/reuse.

## Compatibility helpers and removal candidates

| Candidate | Status | Removal condition |
| --- | --- | --- |
| Legacy bind state/helpers from former `src/input.js` | Deleted/focused | Transitional bind helpers now live in `src/app/input/legacy-bind-state.js`; remove individual helpers as menu/settings migrate to semantic input. |
| `src/editor/tilemap-draft.js` compatibility facade | Delete after migration | Editor imports `src/core/tilemaps/draft.js` and `src/content/tilemaps/draft-compiler.js` directly. |
| `game.player`, `game.enemies`, `game.camera` mirrors | Delete after migration | Callers use `game.gameplaySession.*`. |
| Tilemap compatibility facade in `src/core/tilemaps/tilemap.js` | Keep/migrate opportunistically | Consumers import focused modules directly when touching related code. |
| Internal `level` terminology | Opportunistic cleanup | Rename when touching nearby code; user-facing “Level Select” may stay. |
| Stale terrain docs | Fix soon | Update pattern doc to current `terrainLayer` model. |

## Test gaps to track

Existing tests cover many broad flows: core boundaries, core input, settings, game smoke, scenario browser, map editor, speedrun, devtools, tilemaps, rendering helpers.

Before risky refactors, add characterization tests for:

- physics/gameplay input behavior when migrating old physics tests from legacy bind state to core input runtime; 
- menu back/focus behavior if changing focus/page routing;
- settings bind/remap behavior if changing input presentation or settings action dispatch;
- editor save/preview/import/export if moving persistence logic;
- local draft validation if moving draft compiler modules;
- HUD/message behavior if splitting `src/render.js`;
- map render visual output if changing terrain/rendering.

## Completed implementation slices

### Slice 1: Move shared tilemap draft logic out of editor

Completed on 2026-05-08.

Changed files:

- `src/core/tilemaps/draft.js`
- `src/content/tilemaps/draft-compiler.js`
- `src/editor/tilemap-draft.js`
- `src/catalog/local-drafts/storage.js`
- `src/tilemap-preview.js`
- `tests/core-boundary.spec.js`

Validation:

```sh
bun run build
bunx playwright test tests/core-boundary.spec.js tests/map-editor.spec.js tests/tilemap.spec.js --project=chromium
```

### Slice 2: Untangle input presentation from legacy input state

Completed on 2026-05-08.

Changed files:

- `src/app/input/legacy-bind-state.js`
- `src/app/input/input-presentation.js`
- `src/app/input/controller-diagnostics.js`
- removed `src/input.js`
- `src/main.js`
- `src/menu.js`
- `src/render.js`
- `src/settings.js`
- `src/settings-ui.js`
- `src/state.js`
- `tests/core-boundary.spec.js`
- `tests/settings.spec.js`
- `tests/physics.spec.js`

Validation:

```sh
bun run build
bunx playwright test tests/core-boundary.spec.js tests/settings.spec.js --project=chromium
bunx playwright test tests/game-smoke.spec.js --project=chromium
```

Known validation note: `tests/physics.spec.js` still has existing failures around tests passing legacy input state directly to `updateGameplay`, which now requires a core input runtime. Defer fixing those tests to a dedicated follow-up slice that migrates physics test helpers to semantic/core input runtime events.

### Slice 3: Decompose menu/settings/scenario browser ownership

Partially completed on 2026-05-09.

Changed files:

- `src/app/ui/scenario-browser.js`
- `src/menu.js`
- `src/scenes/menu-dom.js`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Scenario browser tab/render/local-draft/launch behavior moved out of `src/menu.js`.
- Settings and level-select back controls are explicit DOM controls again instead of only command-bar hint metadata.
- Start settings opens the settings hub, and category back returns to the hub.
- Developer-mode toggle preserves focus on the toggled row after rerender.

Validation:

```sh
bun run build
bunx playwright test tests/scenario-browser.spec.js tests/settings.spec.js tests/game-smoke.spec.js --project=chromium
bunx playwright test tests/gyms/ui-navigation.gym.spec.js --project=chromium
```

Full-suite note: `bunx playwright test --project=chromium` passed UI/navigation coverage and still fails only the known legacy `tests/physics.spec.js` helpers that pass old input state directly to `updateGameplay`.

## Completed and in-progress implementation slices

### Slice 4: Continue menu/settings ownership decomposition

Completed on 2026-05-09.

Changed files:

- `src/app/ui/settings-navigation.js`
- `src/menu.js`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Settings category tab switching moved out of `src/menu.js` into `src/app/ui/settings-navigation.js`.
- At the time of this slice, menu kept ownership of focus callbacks and chrome updates while delegating category validation and tab movement; later Slice 6 moved that shell ownership too.

Validation:

```sh
bun run build
bunx playwright test tests/settings.spec.js --project=chromium
```

### Slice 5: Extract remaining settings actions from menu

Completed on 2026-05-09.

Changed files:

- `src/app/ui/settings-actions.js`
- `src/menu.js`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Settings bind-listening, bind commits, resets, controller enable/select, motion/GPU/developer toggles, speedrun setting actions, and raw settings dump/replace actions moved out of `src/menu.js`.
- `src/menu.js` now routes settings/scenario clicks and passes shell callbacks for chrome, focus, and transitions.

Validation:

```sh
bun run build
bunx playwright test tests/settings.spec.js --project=chromium
```

Known validation note: the broader `tests/settings.spec.js tests/game-smoke.spec.js tests/devtools-toolbox.spec.js` gate still had the same two UI-navigation/devtools failures documented before this extraction.

### Slice 6: Extract menu shell/focus and page transition ownership

Completed on 2026-05-09.

Changed files:

- `src/app/ui/menu-shell.js`
- `src/menu.js`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Menu chrome updates, active-root selection, focus restoration/reveal behavior, settings tab focus callbacks, page transitions, settings/level-select open/close flow, pause/start, and main-menu return flow moved out of `src/menu.js` into `src/app/ui/menu-shell.js`.
- `src/menu.js` remains the compatibility facade for setup, semantic menu activation, input routing, and delegated settings/scenario click routing.

Validation:

```sh
bun run build
bunx playwright test tests/settings.spec.js tests/game-smoke.spec.js tests/devtools-toolbox.spec.js tests/gyms/ui-navigation.gym.spec.js --project=chromium
```

Known validation note: this gate still has the existing two `tests/devtools-toolbox.spec.js` failures where the toolbox panel does not open for two devtools checks. A later parallel rerun without devtools also exposed the existing/intermittent controller diagonal focus check in `tests/game-smoke.spec.js`; the same test passes when run alone.

### Slice 7: Split world rendering from HUD/message DOM updates

Completed on 2026-05-09.

Changed files:

- `src/render/world-renderer.js`
- `src/app/ui/gameplay-hud.js`
- `src/render.js`
- `tests/core-boundary.spec.js`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Canvas world drawing, camera snap/subpixel calculations, tilemap/decor/actor drawing, and debug overlays moved out of `src/render.js` into `src/render/world-renderer.js`.
- HUD level name, message modal state, speedrun HUD, hearts, body classes, and gameplay input hints moved into `src/app/ui/gameplay-hud.js`.
- `src/render.js` remains a compatibility/presentation facade that preserves draw order and existing exports for map snapshots.
- Boundary coverage now asserts the world renderer does not import HUD/input presentation modules or the removed legacy input facade.

Validation:

```sh
bun run build
bunx playwright test tests/game-smoke.spec.js tests/speedrun-ui.spec.js tests/core-boundary.spec.js --project=chromium
bun run validate:map-render
```

Known validation note: `bun run validate:map-render` rendered `.temp/full-map.png`; Vite also reported port 4174 already in use because an existing dev server was present.

## Completed implementation slices continued

### Slice 8: Decompose tilemap compiler internals

Completed on 2026-05-09.

Changed files:

- `src/core/tilemaps/tilemap.js`
- `src/core/tilemaps/layers.js`
- `src/core/tilemaps/compiler.js`
- `src/core/tilemaps/terrain-model.js`
- `src/core/tilemaps/collision.js`
- `src/core/tilemaps/render-artifacts.js`
- `src/core/tilemaps/queries.js`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Grid layer parsing, tilemap compilation, terrain normalization, terrain collision derivation, contained-terrain render artifacts, and compatibility query helpers now have focused modules.
- `src/core/tilemaps/tilemap.js` remains a public compatibility facade to preserve existing imports.

Validation:

```sh
bun run build
bunx playwright test tests/tilemap.spec.js tests/core-boundary.spec.js --project=chromium
bun run validate:map-render
```

Known validation note: `bun run validate:map-render` rendered `.temp/full-map.png`; Vite also reported port 4174 already in use because an existing dev server was present.

## Recommended next implementation slice

### Slice 9: Extract editor command/persistence/status logic behind the browser shell

Why next:

- Tilemap/compiler internals are now clearer, so the map editor can move toward shared, testable command/status/preview/persistence logic without increasing core/editor coupling.
- `src/editor/map-editor.js` is still DOM-heavy and directly owns commands, status rules, preview payload creation, and persistence helpers.

Likely files:

- `src/editor/map-editor.js`
- new focused editor modules under `src/editor/**`
- map-editor tests

Validation:

```sh
bun run build
bunx playwright test tests/map-editor.spec.js tests/tilemap.spec.js --project=chromium
```

## Candidate later slices

1. Extract editor command/persistence/status logic behind a browser shell.
2. Extract shared CSS tokens/primitives if both game and editor continue to duplicate them.
3. Update stale terrain docs and mark superseded ADR details.
4. Add a `validate` package script once the desired full validation gate is stable.

## Keep-up-to-date rule

When a foundation slice lands:

- remove or update obsolete findings;
- update priority/confidence if risk changes;
- move completed slices out of the recommendation list;
- add new evidence from tests/import analysis/docs;
- update related pattern docs in the same commit as behavior changes.
