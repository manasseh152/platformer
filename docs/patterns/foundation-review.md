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

Validated for the first foundation slice on 2026-05-08:

```sh
bun run build
bunx playwright test tests/core-boundary.spec.js tests/map-editor.spec.js tests/tilemap.spec.js --project=chromium
```

The targeted scenario-browser slice also passed except `tests/scenario-browser.spec.js:23`, which currently times out waiting for legacy `#settingsCategoryBackButton` after the Advanced settings page renders an Esc Back shortcut instead.

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
| Game UI | `src/menu.js`, `src/settings-ui.js`, `src/scenes/menu-dom.js`, `styles/main.css` | Start/pause/settings/scenario browser/HUD/devtools shell | Current largest UI hotspot. |
| Editor UI/tool | `src/editor/**`, `styles/map-editor.css` | Browser map editor shell, commands, viewport, persistence UI | Shared draft/data logic should move out of editor. |
| Rendering | `src/render.js`, `src/render/**`, `src/rendering/**`, `src/gpu/**` | World drawing, render helpers, future renderer backends | World rendering and DOM HUD updates should separate. |
| Devtools | `src/devtools/**` | Developer-only toolbox/overlays | Keep gated and out of core gameplay logic. |

## Findings

### P1 / High — App UI ownership is unclear

Evidence:

- `src/menu.js` owns pause/start flow, scenario browser, settings page routing, focus, persistence actions, speedrun actions, controller selection, and event wiring.
- Docs describe scene-owned DOM and scene stack concepts, but only gameplay is a registered runtime scene today.
- `src/scenes/menu-dom.js` creates start/pause/settings/scenario browser markup, while behavior lives in `src/menu.js`.

Direction:

- First decompose `menu.js` into cohesive modules while preserving DOM behavior.
- Do not immediately migrate UI into scene-stack scenes.
- After decomposition, evaluate migrating one overlay/page at a time if scene ownership simplifies lifecycle/input.

### P1 / High — Input domain and input presentation are still blurred

Evidence:

- Semantic core input exists under `src/core/input/**`.
- `src/input.js` still exports legacy bind rows/state, controller diagnostics helpers, hint rendering, and transitional settings helpers.
- `src/render.js` imports `renderGameplayHints` from `src/input.js`, coupling rendering to input UI helpers.

Direction:

- Separate input presentation/hints/remap UI from legacy compatibility state.
- Keep semantic input as the source of truth.
- Remove legacy helpers only after menu/settings/editor users migrate.

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

### P1 / High — Rendering boundary mixes world drawing and DOM HUD/UI

Evidence:

- `src/render.js` draws world elements and also updates DOM state such as HUD level name, messages, body classes, speedrun HUD, hearts, and input hints.
- `src/render.js -> src/input.js` is a suspicious dependency edge.

Direction:

- Split world/camera rendering from HUD/message DOM updates.
- Keep debug overlays in `src/devtools/debug-render.js` but call them from world renderer.
- Before shaders/WebGPU work, represent renderable concepts as data/plans where useful.

### P1 / Medium — Tilemap compiler module is central but too broad

Evidence:

- `src/core/tilemaps/tilemap.js` handles grid parsing, terrain validation, terrain normalization, collision derivation, render artifact derivation, scene compilation, decor helpers, and compatibility gameplay helpers.
- It is imported by many modules by design, but has multiple reasons to change.

Direction:

- Decompose when touching tilemap foundations:
  - definition/parser/compiler;
  - terrain compile;
  - collision derivation;
  - tilemap queries/compatibility helpers.
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
| Legacy bind state/helpers in `src/input.js` | Delete after migration | Settings/menu/editor users read semantic input directly or through presentation helpers. |
| `src/editor/tilemap-draft.js` compatibility facade | Delete after migration | Editor imports `src/core/tilemaps/draft.js` and `src/content/tilemaps/draft-compiler.js` directly. |
| `game.player`, `game.enemies`, `game.camera` mirrors | Delete after migration | Callers use `game.gameplaySession.*`. |
| Tilemap compatibility helpers in `src/core/tilemaps/tilemap.js` | Decompose/migrate | Render/snapshot/tests use scene queries or focused tilemap query modules. |
| Internal `level` terminology | Opportunistic cleanup | Rename when touching nearby code; user-facing “Level Select” may stay. |
| Stale terrain docs | Fix soon | Update pattern doc to current `terrainLayer` model. |

## Test gaps to track

Existing tests cover many broad flows: core boundaries, core input, settings, game smoke, scenario browser, map editor, speedrun, devtools, tilemaps, rendering helpers.

Before risky refactors, add characterization tests for:

- menu back/focus behavior if changing focus/page routing;
- settings bind/remap behavior if changing input presentation;
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

Known validation note: `tests/scenario-browser.spec.js:23` currently fails independently because it waits for `#settingsCategoryBackButton`, while the rendered Advanced settings page exposes the newer `Esc Back` shortcut.

## Recommended next implementation slice

### Slice 2: Untangle input presentation from legacy input state

Why next:

- It removes a repeated coupling point between semantic input, settings/remap UI, controller diagnostics, and render-time input hints.
- It should eliminate the suspicious `src/render.js -> src/input.js` dependency before rendering/HUD decomposition.
- Characterization tests can bound current bind/remap behavior before moving code.

Likely files:

- `src/input.js`
- `src/app/input/**`
- `src/core/input/**`
- `src/render.js`
- `src/menu.js`
- settings/input tests

Validation:

```sh
bunx playwright test tests/core-input.spec.js tests/settings.spec.js tests/game-smoke.spec.js --project=chromium
bun run build
bunx playwright test --project=chromium
```

## Candidate later slices

1. Decompose `src/menu.js` into scenario browser, settings navigation/actions, menu shell/focus modules.
2. Split `src/render.js` into world renderer and HUD/message DOM updater.
3. Decompose tilemap compiler internals.
4. Extract editor command/persistence/status logic behind a browser shell.
5. Extract shared CSS tokens/primitives if both game and editor continue to duplicate them.
6. Update stale terrain docs and mark superseded ADR details.
7. Add a `validate` package script once the desired full validation gate is stable.

## Keep-up-to-date rule

When a foundation slice lands:

- remove or update obsolete findings;
- update priority/confidence if risk changes;
- move completed slices out of the recommendation list;
- add new evidence from tests/import analysis/docs;
- update related pattern docs in the same commit as behavior changes.
