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

Validated for the aggregate foundation gate on 2026-05-10:

```sh
bun run validate:foundation
```

This command runs build, the Chromium Playwright suite, and map-render validation. The latest focused foundation validation passed build, 173 Chromium tests, and rendered `.temp/full-map.png`; Vite also reported port 4174 already in use during map rendering because an existing server was present.

Before implementation slices, run the aggregate gate unless the slice has a narrower documented validation plan:

```sh
bun run validate:foundation
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
| Game UI | `src/app/ui/menu/**`, `src/app/ui/**`, `src/app/ui/settings/settings-view.js`, `src/scenes/menu-dom.js`, `styles/main.game.css` | Start/pause/settings/scenario browser/HUD/devtools shell | Imports shared UI tokens/primitives from `styles/ui-*.css`; `src/app/ui/menu/**` remains the shell/focus/event hotspot while scenario browser, settings navigation, and settings actions are focused modules. |
| Editor UI/tool | `src/editor/**`, `styles/main.editor.css` | Browser map editor shell, command/status/payload helpers, viewport, persistence UI | Imports shared UI tokens/primitives from `styles/ui-*.css`; `src/editor/map-editor.js` owns DOM/canvas wiring; `src/editor/map-editor-commands.js` owns reusable draft commands/status/payload helpers. |
| Rendering | `src/render/**`, `src/rendering/**`, `src/gpu/**` | Packet extraction, native-frame backends, presentation backends, render helpers | Gameplay and map snapshots render through packet extractors/backends; the old `src/render.js` facade and direct world renderer have been deleted. |
| Devtools | `src/devtools/**` | Developer-only toolbox/overlays | Keep gated and out of core gameplay logic. |

## Findings

### P1 / High — App UI ownership is unclear

Evidence:

- `src/app/ui/menu/**` remains the menu setup, semantic-action, input-routing, and broad DOM event wiring facade.
- Scenario browser rendering/launch handling has been extracted to `src/app/ui/scenario-browser.js`.
- Settings category tab switching has been extracted to `src/app/ui/settings/settings-navigation.js`.
- Settings actions, bind-listening, controller selection, raw settings, motion/GPU/developer toggles, and speedrun setting actions have been extracted to `src/app/ui/settings/settings-actions.js`.
- Menu shell/focus, page transitions, menu chrome updates, pause/start flow, and main-menu return flow now live in `src/app/ui/menu/menu-shell.js`.
- Docs describe scene-owned DOM and scene stack concepts, but only gameplay is a registered runtime scene today.
- `src/scenes/menu-dom.js` creates start/pause/settings/scenario browser markup, while behavior is split across `src/app/ui/menu/**` and `src/app/ui/**` modules.

Direction:

- Keep `src/app/ui/menu/**` as the compatibility facade until callers can depend on focused UI modules directly.
- Do not immediately migrate UI into scene-stack scenes.
- After decomposition, evaluate migrating one overlay/page at a time if scene ownership simplifies lifecycle/input.

### Completed — Input presentation and remap UI use semantic input state

Evidence:

- Semantic core input exists under `src/core/input/**` and remains the source of truth for runtime actions.
- Semantic settings-row projection lives in `src/app/input/semantic-bind-rows.js`; the old `src/app/input/legacy-bind-state.js` module was deleted.
- DOM hint/scheme rendering now lives in `src/app/input/input-presentation.js`.
- Browser gamepad polling, controller diagnostics, and bind-status UI helpers now live in `src/app/input/controller-diagnostics.js`.
- Gameplay HUD/input hint presentation is now isolated in `src/app/ui/gameplay-hud.js`.
- `tests/core-boundary.spec.js` asserts the world renderer does not import HUD/input presentation modules or the legacy input facade.
- Keyboard/controller settings rows render and commit directly through `settings.input.bindings`.

### Completed — Catalog local drafts no longer depend on editor draft logic

Evidence:

- Pure draft schema/normalization/layer/entity helpers now live in `src/core/tilemaps/draft.js`.
- Chibi content symbol mapping and draft compilation now live in `src/content/tilemaps/draft-compiler.js`.
- `src/catalog/local-drafts/storage.js` and `src/app/tilemaps/tilemap-preview.js` import the shared modules directly instead of `src/editor/tilemap-draft.js`.
- `tests/core-boundary.spec.js` now asserts catalog modules do not import editor modules.

Follow-up:

- `src/editor/tilemap-draft.js` remains a compatibility re-export for editor callers and can be removed once editor imports move to the shared modules directly.

### P1 / High — Mutable `game` object is a broad compatibility context

Evidence:

- `src/app/game-state.js` creates `game` with runtime, UI, presenter, GPU, app state, gameplay session, mirrored player/enemy/camera fields, legacy input, semantic input runtime, settings, speedrun, devtools, scenarios, scene library, menu, and clock.
- It also writes `document.body.dataset.tilemapId`.

Direction:

- Keep `game` as app composition root for now.
- Stop passing full `game` into code that only needs a smaller slice.
- Introduce smaller contexts over time: gameplay, UI, render, editor.
- Remove mirrored gameplay fields only after callers use `game.gameplaySession` consistently.

### Completed — World rendering is packetized and separated from DOM HUD/UI updates

Evidence:

- Gameplay and map snapshots now render through packet extractors and `NativeFrameBackend` modules rather than the deleted legacy direct Canvas2D world renderer.
- `src/app/ui/gameplay-hud.js` owns HUD level name, messages, speedrun HUD, hearts, body classes, and input hint presentation.
- The old `src/render.js` facade was deleted after gameplay callers moved to the pipeline directly.
- `tests/core-boundary.spec.js` asserts deleted legacy render facades have no production call path.

Follow-up:

- Keep extracting render-facing read models/adapters where that reduces mutable `game` coupling.
- Keep app presentation composition in `src/app/presentation/**`; the old root `src/presenter.js` compatibility facade has been removed.
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

### Completed — Terrain docs now match current terrainLayer authoring

Evidence:

- `src/core/tilemaps/tilemap.js` rejects `buildTerrain` and requires modern `terrainLayer()` with id `terrain`.
- `docs/patterns/terrain.md` and `docs/patterns/tilemaps.md` now describe `terrainLayer()`, terrain kinds, `null` empty cells, and archived `buildTerrain` compatibility only at draft/storage boundaries.
- `docs/adr/0003-contained-terrain-scale.md` is marked as historical where it references the old `buildTerrain` authoring API.
- Duplicate ADR `0003` numbering is documented as historical in both affected ADRs.

Follow-up:

- Keep pattern docs current when terrain kinds, render artifacts, or editor export format change.

### P2 / High — CSS design primitives are duplicated between game and editor

Evidence:

- `styles/ui-tokens.css` defines shared semantic dark-theme tokens.
- `styles/ui-primitives.css` defines shared `.ds-*` primitives and base focus/button behavior.
- `styles/main.game.css` and `styles/main.editor.css` own product-specific composition.

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

### Partially completed — Browser globals are localized enough, but editor shell could be cleaner

Evidence:

- Core/engine boundary tests forbid browser globals and currently pass.
- Browser globals are expected in app/editor modules.
- `src/editor/map-editor.js` still directly uses `document`, `window`, `localStorage`, `Date.now`, and `Math.random` for browser shell duties.
- Share/export module generation, import validation, preview payload creation, preference helpers, and local-save status rules now live in `src/editor/map-editor-commands.js`.

Direction:

- Do not treat browser globals in browser shell files as defects.
- Keep extracting pure editor command/status/persistence decisions behind focused modules when it improves tests/reuse.

## Compatibility helpers and removal candidates

| Candidate | Status | Removal condition |
| --- | --- | --- |
| Legacy bind state/helpers from former `src/input.js` | Completed | `src/input.js` and `src/app/input/legacy-bind-state.js` are deleted; settings/remap rows use semantic `settings.input.bindings`. |
| `src/editor/tilemap-draft.js` compatibility facade | Delete after migration | Editor imports `src/core/tilemaps/draft.js` and `src/content/tilemaps/draft-compiler.js` directly. |
| `game.player`, `game.enemies`, `game.camera` mirrors | Delete after migration | Callers use `game.gameplaySession.*`. |
| Tilemap compatibility facade in `src/core/tilemaps/tilemap.js` | Keep/migrate opportunistically | Consumers import focused modules directly when touching related code. |
| Internal `level` terminology | Opportunistic cleanup | Rename when touching nearby code; user-facing “Level Select” may stay. |
| Stale terrain docs | Completed | Pattern docs now describe current `terrainLayer()` model; ADR conflicts are marked historical. |

## Test gaps to track

Existing tests cover many broad flows: core boundaries, core input, settings, game smoke, scenario browser, map editor, speedrun, devtools, tilemaps, rendering helpers.

Before risky refactors, add characterization tests for:

- menu back/focus behavior if changing focus/page routing;
- settings bind/remap behavior if changing input presentation or settings action dispatch;
- editor save/preview/import/export when changing command payloads or browser storage side effects;
- local draft validation if moving draft compiler modules;
- HUD/message behavior if changing gameplay HUD presentation;
- map render visual output if changing terrain/rendering.

## Completed implementation slices

### Slice 1: Move shared tilemap draft logic out of editor

Completed on 2026-05-08.

Changed files:

- `src/core/tilemaps/draft.js`
- `src/content/tilemaps/draft-compiler.js`
- `src/editor/tilemap-draft.js`
- `src/catalog/local-drafts/storage.js`
- `src/app/tilemaps/tilemap-preview.js`
- `tests/core-boundary.spec.js`

Validation:

```sh
bun run build
bunx playwright test tests/core-boundary.spec.js tests/map-editor.spec.js tests/tilemap.spec.js --project=chromium
```

### Slice 2: Untangle input presentation from legacy input state

Completed on 2026-05-08.

Changed files:

- `src/app/input/semantic-bind-rows.js`
- `src/app/input/input-ui-state.js`
- `src/app/input/input-presentation.js`
- `src/app/input/controller-diagnostics.js`
- removed `src/input.js`
- `src/main.js`
- `src/app/ui/menu/**`
- removed `src/render.js` later during render packet migration
- `src/app/settings/settings.js`
- `src/app/ui/settings/settings-view.js`
- `src/app/game-state.js`
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
- `src/app/ui/menu/**`
- `src/scenes/menu-dom.js`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Scenario browser tab/render/local-draft/launch behavior moved out of `src/app/ui/menu/**`.
- Settings and level-select back controls were restored at this stage instead of only command-bar hint metadata; later settings-tab work removed the settings hub again.
- At this stage, start settings opened the settings hub and category back returned to the hub; current behavior is direct `settings-category` tab navigation.
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

- `src/app/ui/settings/settings-navigation.js`
- `src/app/ui/menu/**`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Settings category tab switching moved out of `src/app/ui/menu/**` into `src/app/ui/settings/settings-navigation.js`.
- At the time of this slice, menu kept ownership of focus callbacks and chrome updates while delegating category validation and tab movement; later Slice 6 moved that shell ownership too.

Validation:

```sh
bun run build
bunx playwright test tests/settings.spec.js --project=chromium
```

### Slice 5: Extract remaining settings actions from menu

Completed on 2026-05-09.

Changed files:

- `src/app/ui/settings/settings-actions.js`
- `src/app/ui/menu/**`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Settings bind-listening, bind commits, resets, controller enable/select, motion/GPU/developer toggles, speedrun setting actions, and raw settings dump/replace actions moved out of `src/app/ui/menu/**`.
- `src/app/ui/menu/**` now routes settings/scenario clicks and passes shell callbacks for chrome, focus, and transitions.

Validation:

```sh
bun run build
bunx playwright test tests/settings.spec.js --project=chromium
```

Known validation note: the broader `tests/settings.spec.js tests/game-smoke.spec.js tests/devtools-toolbox.spec.js` gate still had the same two UI-navigation/devtools failures documented before this extraction.

### Slice 6: Extract menu shell/focus and page transition ownership

Completed on 2026-05-09.

Changed files:

- `src/app/ui/menu/menu-shell.js`
- `src/app/ui/menu/**`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Menu chrome updates, active-root selection, focus restoration/reveal behavior, settings tab focus callbacks, page transitions, settings/level-select open/close flow, pause/start, and main-menu return flow moved out of `src/app/ui/menu/**` into `src/app/ui/menu/menu-shell.js`.
- `src/app/ui/menu/**` remains the compatibility facade for setup, semantic menu activation, input routing, and delegated settings/scenario click routing.

Validation:

```sh
bun run build
bunx playwright test tests/settings.spec.js tests/game-smoke.spec.js tests/devtools-toolbox.spec.js tests/gyms/ui-navigation.gym.spec.js --project=chromium
```

Known validation note: this gate still has the existing two `tests/devtools-toolbox.spec.js` failures where the toolbox panel does not open for two devtools checks. A later parallel rerun without devtools also exposed the existing/intermittent controller diagonal focus check in `tests/game-smoke.spec.js`; the same test passes when run alone.

### Slice 7: Split world rendering from HUD/message DOM updates

Completed on 2026-05-09.

Changed files at the time:

- `src/app/ui/gameplay-hud.js`
- `src/render.js`
- `tests/core-boundary.spec.js`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented at the time:

- Canvas world drawing, camera snap/subpixel calculations, tilemap/decor/actor drawing, and debug overlays were first moved out of `src/render.js` into a focused renderer module. That transitional direct Canvas2D renderer has since been superseded by the packet pipeline and deleted.
- HUD level name, message modal state, speedrun HUD, hearts, body classes, and gameplay input hints moved into `src/app/ui/gameplay-hud.js`.
- The later packet-pipeline migration deleted the old `src/render.js` facade after direct callers moved to focused pipeline/HUD modules.
- Boundary coverage now asserts the deleted legacy render facades have no production call path.

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

### Slice 9: Extract editor command/persistence/status logic behind the browser shell

Completed on 2026-05-09.

Changed files:

- `src/editor/map-editor-commands.js`
- `src/editor/map-editor.js`
- `tests/core-boundary.spec.js`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`
- `docs/patterns/map-editor.md`

Implemented:

- Share/export module generation, share import validation, preview payload construction, preference storage helpers, and local-save status rules moved out of the DOM-heavy map editor shell.
- `src/editor/map-editor.js` remains responsible for DOM/canvas wiring, viewport/history orchestration, localStorage side effects, and popup/download effects.
- Boundary coverage asserts the reusable editor command helpers do not reference browser globals directly.

Validation:

```sh
bun run build
bunx playwright test tests/map-editor.spec.js tests/tilemap.spec.js tests/core-boundary.spec.js --project=chromium
```

### Slice 10: Clean up stale terrain docs and ADR terminology conflicts

Completed on 2026-05-09.

Changed files:

- `docs/patterns/terrain.md`
- `docs/patterns/tilemaps.md`
- `docs/patterns/devtools.md`
- `docs/patterns/rendering.md`
- `docs/adr/0003-contained-terrain-scale.md`
- `docs/adr/0003-core-input-system.md`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Current pattern docs now describe `terrainLayer()` with `id: 'terrain'`, terrain kind arrays, `null` empty cells, and archived `buildTerrain` support only as boundary migration behavior.
- Contained-terrain ADR conflicts are marked historical without rewriting the original decision record.
- Duplicate `0003` ADR numbering is explicitly documented as historical.

Validation:

```sh
bun run build
bunx playwright test tests/tilemap.spec.js --project=chromium
```

### Slice 11: Update settings-tab UI validation and remove stale settings-hub expectations

Completed on 2026-05-09.

Changed files:

- `tests/game-smoke.spec.js`
- `tests/scenario-browser.spec.js`
- `tests/devtools-toolbox.spec.js`
- `tests/gyms/ui-navigation.gym.spec.js`
- `docs/patterns/settings-and-ui.md`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Browser tests now expect start/pause Settings to open `settings-category` directly with Controls selected.
- Developer Mode setup in scenario-browser and devtools tests now uses the Advanced settings tab instead of stale hub category cards.
- Settings pattern docs describe the current tab-based page model and removed settings hub expectations.

Validation:

```sh
bun run build
bunx playwright test tests/settings.spec.js tests/game-smoke.spec.js tests/scenario-browser.spec.js tests/devtools-toolbox.spec.js --project=chromium
bunx playwright test tests/gyms/ui-navigation.gym.spec.js --project=chromium
```

### Slice 12: Stabilize input-hint scheme behavior and commit/validate pending input changes

Completed on 2026-05-10.

Changed files:

- `src/app/input/input-hints.js`
- `tests/core-input.spec.js`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Repo-local pending input-hint changes were validated as intentional/current behavior; no uncommitted input changes remain.
- Input hints prefer an explicit UI `inputScheme` when provided (`wasd`, `arrows`, or `gamepad`) instead of being overridden by last-active-source state.
- Core input coverage asserts explicit keyboard/gamepad scheme selection, axis-scale hint filtering, and Xbox icon presentation.

Validation:

```sh
bun run build
bunx playwright test tests/core-input.spec.js tests/game-smoke.spec.js --project=chromium
```

### Slice 13: Migrate known legacy physics tests to semantic core input runtime

Completed on 2026-05-10.

Changed files:

- `tests/physics.spec.js`
- `tests/update-gameplay.spec.js`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Repo-local inspection confirmed physics gameplay tests create a `createInputRuntime(gameInputProfile)` semantic input runtime before calling `updateGameplay`.
- Focused validation confirmed `tests/physics.spec.js` and `tests/update-gameplay.spec.js` pass together under Chromium.
- The earlier stale-test concern is resolved; no production gameplay changes were needed.

Validation:

```sh
bunx playwright test tests/physics.spec.js tests/update-gameplay.spec.js --project=chromium
```

### Slice 14: Decide and add a stable aggregate validation script

Completed on 2026-05-10.

Changed files:

- `package.json`
- `docs/adr/0004-foundation-review-before-new-systems.md`
- `docs/patterns/foundation-review.md`

Implemented:

- Added `bun run validate:foundation` as the stable handoff gate.
- The aggregate command runs `bun run build`, `bunx playwright test --project=chromium`, and `bun run validate:map-render`.
- Full Chromium suite now passes as part of the aggregate gate.

Validation:

```sh
bun run validate:foundation
```

Known validation note: map-render validation rendered `.temp/full-map.png`; Vite also reported port 4174 already in use because an existing dev server was present.

## Required next implementation slices

No required foundation-review slices remain from ADR 0004's initial implementation list. Keep this section updated if new evidence adds required handoff work.

## Candidate later slices

1. Extract shared CSS tokens/primitives if both game and editor continue to duplicate them.
2. Continue opportunistic editor shell decomposition if map-editor changes expose more pure command/status seams.

## Keep-up-to-date rule

When a foundation slice lands:

- remove or update obsolete findings;
- update priority/confidence if risk changes;
- move completed slices out of the recommendation list;
- add new evidence from tests/import analysis/docs;
- update related pattern docs in the same commit as behavior changes.
