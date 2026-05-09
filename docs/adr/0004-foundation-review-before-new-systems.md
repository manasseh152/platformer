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
   - Implemented: legacy bind state, input hint presentation, and controller diagnostics now live in focused `src/app/input/` modules.
   - Implemented: world rendering imports input presentation directly, protected by a core-boundary test.
   - Implemented: removed the legacy `src/input.js` facade after repo-local consumers migrated.
   - Remaining follow-up: add characterization tests before changing actual bind/remap behavior.

3. **Decompose menu/settings/scenario browser ownership** — completed
   - Invariant: `src/menu.js` stops being the single owner of unrelated UI flows while preserving current DOM behavior.
   - Implemented: scenario browser rendering, local draft rows, tab persistence, selected-level summary updates, and scenario launch handling now live in `src/app/ui/scenario-browser.js`.
   - Implemented: settings now opens through the hub again with explicit back buttons for hub/category/level-select flows, restoring existing DOM characterization tests.
   - Implemented: settings tab navigation now lives in `src/app/ui/settings-navigation.js`.
   - Implemented: settings action handlers and bind-listening helpers now live in `src/app/ui/settings-actions.js`.
   - Implemented: menu shell, focus restoration, page transitions, pause/start/main-menu transitions, and menu chrome updates now live in `src/app/ui/menu-shell.js`.
   - `src/menu.js` remains the DOM event/input wiring facade for menu setup and semantic menu activation.
   - Do not migrate to scene-stack UI scenes until responsibilities are clear.

4. **Split world rendering from HUD/message DOM updates**
   - Invariant: canvas world rendering can evolve independently from DOM HUD, message, speedrun, and input-hint updates.
   - Likely target: split `src/render.js` into world renderer and HUD/message UI updater.
   - Rendering/tilemap changes require map render validation.

5. **Decompose tilemap compiler internals**
   - Invariant: tilemap parsing, terrain compile, collision derivation, render artifact derivation, and compatibility query helpers have focused ownership.
   - Likely target: split `src/core/tilemaps/tilemap.js` without changing authored map behavior.

6. **Extract editor command/persistence/status logic behind the browser shell**
   - Invariant: reusable editor logic is testable without living inside the DOM-heavy map editor shell.
   - Likely target: keep browser wiring in editor shell while extracting commands, status rules, preview payload creation, and persistence helpers.

7. **Clean up docs, terminology, and validation scripts as follow-through slices**
   - Invariant: pattern docs describe current intended shape, ADR conflicts are marked as historical/superseded, and validation commands are easy to run.
   - Likely target: stale terrain docs, duplicate ADR numbering note, internal terminology cleanup when touching related modules, and an optional aggregate `validate` script.

These slices are a starting order, not a permanent roadmap. Update `docs/patterns/foundation-review.md` when new evidence changes priority, scope, or ordering.

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
