# ADR 0004: Foundation review before adding new systems

- Status: Accepted
- Date: 2026-05-08

## Context

The project has working gameplay, editor, input, tilemap, rendering, and UI systems, but several areas feel harder to change than they should. Some code is transitional after earlier migrations, some responsibilities are mixed, and some reusable concepts live under feature-specific modules.

Before adding new systems, UI frameworks, shader pipelines, or large gameplay features, we need a read-only foundation review that identifies what is actually wrong and how to fix it safely.

The goal is not to rewrite the project or make every file small. The goal is to make future feature work easier by improving ownership, reuse, testability, terminology, and validation.

## Decision

Before starting major new systems, perform and maintain a foundation review documented in `docs/patterns/foundation-review.md`.

The review must be evidence-based and repo-local. If a question can be answered by inspecting code, tests, docs, imports, or validation output, inspect those instead of guessing.

The review should cover at least:

- UI/menu/settings/devtools foundations.
- Controls/input foundations.
- Tilemap/runtime/editor/local-draft foundations.
- Gameplay/core/engine boundaries.
- Rendering/graphics/WebGPU/shader readiness.
- Map editor architecture.
- Runtime/storage/events seams.
- CSS/design-system primitives.
- Tests, docs, scripts, and repo hygiene.

The review output is a current pattern/working-plan document, not an implementation commit. Refactors happen later as independently safe slices.

## Principles

- Maintainability and reuse are the primary goals.
- Performance, shaders, visual upgrades, and framework adoption are secondary unless the review proves they solve real foundation problems.
- Keep vanilla DOM/CSS as the default. Do not add a UI framework just to reorganize existing responsibilities.
- Keep the ECS-ish scene/object/component model and continue incremental adoption.
- Keep `engine` conservative and generic.
- Treat game runtime UI and editor UI as separate products that share only proven low-level foundations.
- Large cohesive files are acceptable during discovery/prototyping. Split stable or repeated hotspots by responsibility, not by line-count limit.
- Prefer incremental vertical slices over broad cleanup phases. Big changes are allowed only when tests/build/docs bound the risk.
- Migrate then remove. Delete immediately only when evidence proves a path has no active consumers.

## Review output requirements

The maintained review document must include:

- Goals and non-goals.
- Current architecture map.
- Findings grouped by root boundary failure, not just symptoms.
- Priority and confidence labels.
- Reuse opportunities.
- Compatibility helpers and removal candidates.
- Test gaps and characterization-test needs.
- Concrete issue-ready refactor slices.
- A recommended first implementation slice.
- Validation commands and rollback strategy.
- “Do not change yet” recommendations.

## Priority and confidence labels

Priority:

- `P0`: blocks safe feature work or causes active breakage.
- `P1`: should fix soon; repeated friction, wrong dependency direction, or reuse blocker.
- `P2`: cleanup/opportunistic hygiene.

Confidence:

- `High`: supported by docs/tests/imports/code evidence.
- `Medium`: likely from code shape but needs deeper implementation read.
- `Low`: suspicion only; investigate before planning changes.

## Validation bar for later refactor slices

Every implementation slice after the review should keep the project working and be validated by tests appropriate to its risk.

Minimum final gate for normal foundation slices:

```sh
bun run build
bunx playwright test --project=chromium
```

For visual/tilemap/rendering changes, also produce or validate a full-map artifact:

```sh
bun run validate:map-render
```

For risky behavior-preserving refactors, add characterization tests before moving logic unless existing tests already protect the behavior.

## Initial implementation slices

Foundation work should proceed as independently safe slices, not as one giant refactor. A slice may be large when it preserves one clear architectural invariant and is bounded by tests, build validation, and docs updates.

Initial slice order:

1. **Move shared tilemap draft logic out of editor**
   - Invariant: runtime/catalog code no longer imports editor modules for local draft normalization, validation, or compilation.
   - Likely target: split pure draft helpers into `src/core/tilemaps/` and Chibi symbol compilation into `src/content/tilemaps/`.
   - Validate with scenario browser, map editor, tilemap tests, full build, and full Playwright before completion.

2. **Untangle input presentation from legacy input state** — completed
   - Invariant: semantic core input remains the source of truth, while hints/remap/controller presentation are separated from transitional legacy bind state.
   - Implemented: input hint presentation, semantic settings-row projection, input UI state, and controller diagnostics now live in focused `src/app/input/` modules.
   - Implemented: world rendering imports input presentation directly, protected by a core-boundary test.
   - Implemented: removed the legacy `src/input.js` facade and later deleted `src/app/input/legacy-bind-state.js`; settings/remap rows now commit directly to `settings.input.bindings`.

3. **Decompose menu/settings/scenario browser ownership** — completed
   - Invariant: `src/app/ui/menu/**` stops being the single owner of unrelated UI flows while preserving current DOM behavior.
   - Implemented: scenario browser rendering, local draft rows, tab persistence, selected-level summary updates, and scenario launch handling now live in `src/app/ui/scenario-browser.js`.
   - Implemented: settings now opens through the hub again with explicit back buttons for hub/category/level-select flows, restoring existing DOM characterization tests.
   - Implemented: settings tab navigation now lives in `src/app/ui/settings/settings-navigation.js`.
   - Implemented: settings action handlers and bind-listening helpers now live in `src/app/ui/settings/settings-actions.js`.
   - Implemented: menu shell, focus restoration, page transitions, pause/start/main-menu transitions, and menu chrome updates now live in `src/app/ui/menu/menu-shell.js`.
   - `src/app/ui/menu/**` remains the DOM event/input wiring facade for menu setup and semantic menu activation.
   - Do not migrate to scene-stack UI scenes until responsibilities are clear.

4. **Split world rendering from HUD/message DOM updates** — completed
   - Invariant: canvas world rendering can evolve independently from DOM HUD, message, speedrun, and input-hint updates.
   - Implemented: gameplay and map snapshots now render through packet extractors plus native-frame/presentation backends; the legacy direct Canvas2D world renderer was deleted after imports migrated.
   - Implemented: HUD level name, messages, speedrun HUD, hearts, body classes, and input hints now live in `src/app/ui/gameplay-hud.js`.
   - Implemented: the old `src/render.js` facade was later deleted after gameplay callers moved to focused packet pipeline/HUD modules.
   - Rendering/tilemap changes require map render validation.

5. **Decompose tilemap compiler internals** — completed
   - Invariant: tilemap parsing, terrain compile, collision derivation, render artifact derivation, and compatibility query helpers have focused ownership.
   - Implemented: `src/core/tilemaps/tilemap.js` is now a compatibility facade over focused layer, compiler, terrain model, collision, render artifact, and query modules.
   - Implemented: authored map behavior and public imports are preserved; tilemap/core-boundary tests and map-render validation passed.

6. **Extract editor command/persistence/status logic behind the browser shell** — completed
   - Invariant: reusable editor logic is testable without living inside the DOM-heavy map editor shell.
   - Implemented: share/export module generation, imported-draft validation, preview payload creation, preference persistence helpers, and local-save status rules now live in `src/editor/map-editor-commands.js`.
   - `src/editor/map-editor.js` remains the browser shell for DOM wiring, canvas interactions, viewport, history integration, and storage side effects.

7. **Clean up docs and terminology conflicts** — completed
   - Invariant: pattern docs describe current intended shape, and ADR conflicts are marked as historical/superseded without rewriting decision history.
   - Implemented: terrain and tilemap pattern docs now describe current `terrainLayer()` authoring; archived `buildTerrain` references are limited to compatibility/migration notes.
   - Implemented: conflicting terrain ADR authoring details and duplicate `0003` numbering are marked as historical.

8. **Update settings-tab UI validation and remove stale settings-hub expectations** — completed
   - Invariant: start/pause Settings opens the new settings tab system directly, with Controls as the default tab and explicit tab navigation for Gameplay, Accessibility, Graphics, and Advanced.
   - Implemented: `tests/game-smoke.spec.js`, `tests/scenario-browser.spec.js`, `tests/devtools-toolbox.spec.js`, and `tests/gyms/ui-navigation.gym.spec.js` now use role=`tab` settings categories and expect `settings-category` directly instead of the removed settings hub.
   - Implemented: `docs/patterns/settings-and-ui.md` now describes the current tab-based settings page model.
   - Validation passed:
     ```sh
     bun run build
     bunx playwright test tests/settings.spec.js tests/game-smoke.spec.js tests/scenario-browser.spec.js tests/devtools-toolbox.spec.js --project=chromium
     bunx playwright test tests/gyms/ui-navigation.gym.spec.js --project=chromium
     ```

9. **Stabilize input-hint scheme behavior and commit/validate pending input changes** — completed
   - Invariant: input hints follow the explicit UI input scheme when one is provided, without regressing last-active-source behavior where it is still desired.
   - Implemented: repo-local pending input-hint changes were validated as intentional/current behavior; no uncommitted input changes remain.
   - Implemented: `tests/core-input.spec.js` covers explicit `wasd`, `arrows`, and `gamepad` input-scheme hint selection, including Xbox icon presentation.
   - Validation passed:
     ```sh
     bun run build
     bunx playwright test tests/core-input.spec.js tests/game-smoke.spec.js --project=chromium
     ```

10. **Migrate known legacy physics tests to semantic core input runtime** — completed
   - Invariant: physics/gameplay tests exercise `updateGameplay` through the same semantic core input runtime required by production gameplay.
   - Implemented: repo-local inspection confirmed `tests/physics.spec.js` creates a `createInputRuntime(gameInputProfile)` semantic input runtime for `updateGameplay` tests.
   - Implemented: focused physics/update-gameplay validation passes with the current semantic input runtime coverage.
   - Validation passed:
     ```sh
     bunx playwright test tests/physics.spec.js tests/update-gameplay.spec.js --project=chromium
     ```

11. **Add a stable aggregate validation script** — completed
   - Invariant: future agents and humans can run one documented command for the expected foundation gate.
   - Implemented: `package.json` now exposes `bun run validate:foundation`.
   - Implemented: the aggregate gate runs build, the Chromium Playwright suite, and map-render validation.
   - Validation passed:
     ```sh
     bun run validate:foundation
     ```

These slices are a starting order, not a permanent roadmap. Update `docs/patterns/foundation-review.md` when new evidence changes priority, scope, ordering, or validation status.

## Consequences

Positive:

- New feature work starts from shared understanding of current problems.
- Refactors are prioritized by actual friction and boundary failures.
- The project avoids premature framework/WebGPU rewrites.
- Reuse is extracted from proven shared needs, not speculation.
- The review can spawn ADRs, issues, and safe implementation slices.

Negative / risks:

- The review adds documentation work before feature work.
- Some stale docs or transitional code may be uncomfortable to leave until their slice.
- Maintaining the review requires discipline when architecture changes.

## Keep-up-to-date rule

`docs/patterns/foundation-review.md` is a living current-state review. Update it whenever a foundation slice lands, when a finding becomes obsolete, or when new evidence changes priority/confidence.

ADRs remain decision history. Pattern docs describe current intended shape.
