# ADR 0001: Scenes, Scenarios, and Tilemaps

## Status

Accepted.

## Context

The current codebase uses `scene`, `level`, `campaign`, and `game` for multiple concepts:

- `src/scene-host.js` registers runtime scene objects with lifecycle methods.
- `src/scenes/registry.js` is a catalog of launchable entries composed from campaign levels and gyms.
- `src/campaign/registry.js` currently contains both player progression content and developer tilemap labs/zoos.
- The mutable `game` object mixes app shell state, gameplay state, UI references, settings, input, and level management.

This makes it difficult to compose gameplay with reusable overlays such as pause, settings, and scenario browsing, and it blurs the distinction between playable campaign content, CI gyms, documentation zoos, and reusable runtime UI/gameplay components.

## Decision

We will migrate toward a domain model that separates runtime scenes from launchable scenarios, and separates app orchestration from gameplay session state.

## Domain language

### App / GameApp

The application composition root. It owns runtime, shell UI roots, input collection, scene stack, scenario service, settings, and high-level boot/URL behavior.

### Runtime

Infrastructure dependency for events, storage, time, randomness, and test hooks. It remains separate and is exposed as `app.runtime`.

### Scene

A reusable runtime component with lifecycle. Scenes are created fresh when composed into a scenario.

Examples:

- `StartScreenScene`
- `GameplayScene`
- `PauseOverlayScene`
- `SettingsOverlayScene`
- `ScenarioBrowserScene`

A scene is not a catalog entry. It is a runtime component/factory.

### Scene Stack

Layered scene orchestration. A stack can contain a base scene and overlays.

Examples:

```txt
[ StartScreenScene ]
[ GameplayScene ]
[ GameplayScene, PauseOverlayScene ]
[ GameplayScene, PauseOverlayScene, SettingsOverlayScene ]
```

Pause is long-term scene stack state, not a gameplay flag.

### Scenario

A launchable catalog entry/composition. Campaigns, gyms, and zoos register scenarios. A scenario may compose one or more scenes and provide metadata for browsing, docs, and CI.

Scenarios prefer declarative `composition`; imperative `launch(app)` is an escape hatch only.

### Campaign

Player progression scenario source. Campaign registries contain campaign scenarios only.

### Gym

Developer validation/testing/documentation scenario source for isolated pieces. Gyms default to CI-enabled.

### Zoo

Developer example/documentation scenario source for combinations of pieces. Zoos default to CI-disabled unless explicitly opted in.

### TilemapLevelDefinition

Parsed tilemap gameplay data asset. UI may continue to say “Level,” but internal code should distinguish tilemap definitions from scenarios.

### GameplaySession

Runtime gameplay state: active tilemap definition, player, enemies, camera, particles, dust, and gameplay outcome/goal state. Gameplay systems should receive `gameplaySession`, not the full app.

### FinishGate and LevelGoal

`FinishGate` is the current concrete level-completion mechanic. `LevelGoal` is the abstraction for scenario completion rules. Finish gate is the default campaign level goal.

## Target module layout

```txt
src/app/
  game-app.js
  scenarios-service.js

src/scenes/
  library.js
  gameplay-scene.js
  start-screen-scene.js
  pause-overlay-scene.js
  settings-overlay-scene.js
  scenario-browser-scene.js

src/scenarios/
  registry.js
  launcher.js

src/campaigns/
  registry.js
  act-01-level-1.js

src/gyms/
  registry.js
  movement-gym.js
  hazard-gym.js
  finish-gate-gym.js

src/zoos/
  registry.js
  enemy-zoo.js

src/tilemaps/
  registry.js
  tilemap.js
  definitions/
    act-01-level-1.js
    movement-gym-map.js
    hazard-gym-map.js
    finish-gate-gym-map.js
    enemy-zoo-map.js
```

This is the target shape. Migration may use deprecated adapters while slices are incomplete.

## Scenario entry shape

Preferred shape:

```js
{
  id: 'finish-gate-gym',
  source: 'gyms',
  name: 'Finish Gate Gym',
  description: 'Validates finish gate completion behavior.',
  visibility: 'developer',
  categories: ['finish-gate'],
  docs: [],
  tests: ['tests/gyms/finish-gate.gym.spec.js'],
  covers: [
    'finish-gate.enter-completes-level',
    'finish-gate.emits-once'
  ],
  ci: true,
  composition: {
    type: 'tilemap-gameplay',
    seed: 'finish-gate-gym',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapLevelDefinitionId: 'finish-gate-gym-map',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  }
}
```

Rules:

- `source` is the primary grouping: `campaigns`, `gyms`, or `zoos`.
- Categories are secondary tags, not source duplicates.
- Scenario `kind` is deprecated. Prefer `source` plus `composition.type`.
- `docs`, `tests`, and `covers` are available on all scenarios.
- Gyms and zoos should use documentation/test metadata rigorously.
- Gym default `ci` is `true`.
- Zoo default `ci` is `false` unless explicitly set.
- Scenario and tilemap IDs are separate concepts. Code must not infer one from the other.

## Visibility

Visibility defaults by source:

- campaigns: `public`
- gyms: `developer`
- zoos: `developer`

Entries may override visibility explicitly. Developer visibility is enabled by persisted developer mode or by a non-persisted URL/session override.

## Scenario Browser

The internal scene is `ScenarioBrowserScene`.

User-facing title:

- public mode: “Level Select”
- developer mode: “Scenario Browser”

It reads from `app.scenarios`, not directly from campaigns/gyms/zoos registries. It groups by source and uses categories as secondary tags/filters.

It is usable from both start and pause contexts:

- From start: selecting a scenario prepares it for launch.
- From pause: selecting a scenario immediately replaces the current gameplay session/composition for now.

## URL launch

Scenario URLs should be supported:

```txt
/?scenario=act-01-level-1
/?mode=developer&scenario=finish-gate-gym&autorun=1
```

Behavior:

- `scenario` preselects by default.
- `autorun=1` launches immediately.
- `mode=developer` is a session override and does not persist settings.
- Scenario visibility rules still apply.

## Restart and launch semantics

Launching any scenario creates a fresh composition/session. Launching the current scenario is a restart.

Restart defaults to relaunching the full current scenario composition. Scenario-specific restart policies can be introduced later only if needed.

Current/selected scenario identity is owned by `app.scenarios`. Gameplay sessions may copy `scenarioId` for snapshots and events, but app-level scenario service is canonical.

## Input

Low-level input collection remains global. Discrete input handling is routed through the scene stack from top to bottom, with scenes able to consume input.

Continuous gameplay movement may continue to be read by `GameplayScene`/gameplay systems during update.

## DOM and CSS

End state: scenes own their DOM/HTML.

Migration starts with thin scene wrappers around current `menu.js`, then moves DOM ownership into scene modules.

Target shell roots:

```html
<canvas id="game"></canvas>
<div id="scene-root"></div>
<div id="overlay-root"></div>
```

No UI framework is introduced. Scene UI uses vanilla DOM modules.

CSS remains global for now, with strict scene namespaces:

- shared primitives: `.ds-*`
- scene roots: `.scene-pause-overlay`, `.scene-settings-overlay`, `.scene-scenario-browser`, etc.

## Deprecated concepts and adapters

Temporary adapters are allowed during staged migration, but they must not contain business rules.

Allowed temporarily:

- old import paths re-exporting new modules
- old function names wrapping new names
- explicit deprecation comments with cleanup milestone

Not allowed:

- new code importing deprecated paths
- new tests asserting deprecated names
- adapter modules owning business logic

Deprecated long-term:

- `src/scenes/registry.js` as scenario catalog
- `src/levels/registry.js` as scenario alias
- `src/campaign` as “all tilemap levels” registry
- source-as-category duplication like `categories: ['gyms']`
- scenario `kind`
- global `game.flags.started`, `game.flags.paused`, `game.flags.won`
- legacy IDs such as `legacy-movement-lab`, `legacy-hazard-lab`, `legacy-enemy-zoo`, and `gate-lab`

Replacement IDs:

```txt
legacy-movement-lab -> movement-gym
legacy-hazard-lab   -> hazard-gym
legacy-enemy-zoo    -> enemy-zoo
gate-lab            -> finish-gate-gym
```

## Phased migration checklist

### Phase 1: Domain language and ADR

Status: complete.

- Added this ADR.
- Use it as the source of truth for future implementation slices.
- Do not introduce new code that expands the old `scene entry` / `level registry` ambiguity.

### Phase 2: Tilemap migration

Status: complete.

Completed:

- Consolidated tilemap helpers and definitions under `src/tilemaps/`.
- Added `src/tilemaps/registry.js` with `getTilemapLevelDefinitionById()` and `getAllTilemapLevelDefinitions()`.
- Added deprecated adapters from old campaign/level modules where needed.
- Scenario compositions now reference tilemaps explicitly by `tilemapLevelDefinitionId`.

Completed follow-up:

- Clean gym/zoo map IDs are available and used by clean scenarios.
- Deprecated campaign/level tilemap adapters remain only as compatibility shims until Phase 8 cleanup.

### Phase 3: Scenario registries

Status: complete.

Completed:

- Added `src/scenarios/registry.js`.
- Added `src/campaigns/registry.js`.
- Added `src/zoos/registry.js`.
- Kept deprecated `src/scenes/registry.js` and `src/levels/registry.js` as adapters over scenarios.
- Added scenario metadata/composition foundation.
- Promoted `src/gyms/registry.js` entries toward gym scenario metadata.
- Added clean gym/zoo scenarios:
  - `movement-gym`
  - `hazard-gym`
  - `finish-gate-gym`
  - `enemy-zoo`
- Added clean map fixtures:
  - `movement-gym-map`
  - `hazard-gym-map`
  - `finish-gate-gym-map`
  - `enemy-zoo-map`

Completed follow-up:

- Legacy scenario IDs are no longer registered as launchable scenarios:
  - `legacy-movement-lab`
  - `legacy-hazard-lab`
  - `legacy-enemy-zoo`
  - `gate-lab`
- Clean gym/zoo scenarios use secondary categories such as `movement`, `hazards`, `finish-gate`, `enemy`, and `ui` instead of source-as-category duplication.
- Clean gym/zoo scenarios no longer declare scenario `kind`; `source` plus `composition.type` is canonical.

### Phase 4: Scenario service and URL behavior

Status: complete.

Completed:

- Added `src/scenarios/service.js` for visible listing, selection, current scenario tracking, launch, and restart.
- Added `src/scenarios/url.js` for `scenario`, `mode=developer`, `developerMode=1`, and `autorun=1` behavior.
- Wired current Level Select selection through `game.scenarios`.
- Existing Level Select now surfaces scenario metadata, groups developer entries by source, and uses the title “Scenario Browser” in developer mode while keeping “Level Select” publicly.

Completed follow-up:

- Added `createGameApp()` as the app composition root while preserving the mutable game object as a migration-compatible app object.
- `app.scenarios` is the canonical scenario service placement; `game.scenarios` remains the same object during migration.
- Scenario launches prefer declarative `composition.stack` through the scene library and `scene-host.replaceStack(...)`, falling back to legacy launch functions only when needed.

### Phase 5: App and GameplaySession split

Status: complete for the Phase 1-6 migration slice.

Completed:

- Added `src/gameplay-session.js` with `createGameplaySession()`, `resetGameplaySession()`, and `syncGameplaySessionToGame()`.
- `state.js` now creates `game.gameplaySession` while preserving compatibility fields.
- `level-manager.js` resets gameplay through `GameplaySession`.
- Added `updateGameplay(runtime, gameplaySession, input, dt, controls)` and kept `updateGame()` as a compatibility wrapper.
- `LevelScene` now updates through `game.gameplaySession` and mirrors `game.flags.won` for compatibility.

Completed follow-up:

- The `updateGameplay` / `GameplaySession` slice is committed in code.
- Added `createGameApp()` as the composition root.
- Runtime is exposed as `app.runtime`.
- Compatibility mirrors for `game.level`, `game.player`, `game.enemies`, `game.camera`, and global flags intentionally remain until Phase 8 cleanup.

### Phase 6: Scene library and scene stack

Status: complete for the Phase 1-6 migration slice.

Completed:

- Added `src/scenes/library.js` for resolving declarative scenario compositions.
- Added `src/scenes/default-library.js` for current gameplay/level factory compatibility.
- Added `src/scene-stack.js` with layered update/render/input behavior.
- Backed `src/scene-host.js` with `scene-stack` while preserving the existing single-scene API.

Completed follow-up:

- Scenario launches now resolve declarative compositions with the scene library and apply them through `scene-host.replaceStack(...)`.
- Discrete key input is offered to the scene stack top-down before legacy menu/gameplay handling.
- Old start/pause/won flags are mirrored only for migration compatibility until dedicated start/pause overlay scenes land in Phase 7/8.

### Phase 7: Scene-owned DOM

Status: complete.

Completed:

- Added scene-owned menu DOM creation in `src/scenes/menu-dom.js`.
- Moved Start Screen, Scenario Browser, Pause Overlay, and Settings Overlay markup out of `index.html`.
- Added target shell roots `#scene-root` and `#overlay-root` to `index.html`.
- Kept existing menu behavior as a thin compatibility controller over scene-owned DOM while dedicated runtime scene modules continue to mature.
- Added strict scene namespace hooks: `.scene-start-screen`, `.scene-scenario-browser`, `.scene-pause-overlay`, and `.scene-settings-overlay`.

### Near-term implementation order

1. Commit the current `updateGameplay` / `GameplaySession` update slice.
2. Move draw/render reads toward `GameplaySession` while keeping `drawGame` as a compatibility wrapper.
3. Move camera update APIs toward `GameplaySession + view` while keeping compatibility wrappers.
4. Launch scenarios from declarative `composition.stack` using the scene library and `scene-host.replaceStack(...)`.
5. Prefer clean scenario IDs in browser/tests:
   - `movement-gym`
   - `hazard-gym`
   - `finish-gate-gym`
   - `enemy-zoo`
6. Add real secondary categories such as `movement`, `hazards`, `finish-gate`, `enemy`, and `ui`; stop clean scenarios from using source categories long-term.
7. Introduce `createGameApp()` and move runtime/scenarios/scene library/URL launch wiring there.
8. Add thin scene wrappers for current menus:
   - `PauseOverlayScene`
   - `ScenarioBrowserScene`
   - `SettingsOverlayScene`

### Phase 8: Cleanup

Status: complete for the ADR 0001 migration boundary.

Completed:

- New runtime/menu code no longer imports deprecated `src/campaign/registry.js`, `src/levels/registry.js`, or `src/scenes/registry.js` paths.
- Static menu markup was removed from `index.html`; scene-owned DOM is now created by scene modules.
- Clean scenario IDs remain canonical in the scenario browser and URL flow.
- Legacy launch IDs remain unregistered as scenarios.
- Compatibility mirrors and deprecated adapters are now isolated to existing tests and compatibility modules; no new feature code should depend on them.

Deferred compatibility removals:

- `game.flags.started/paused/won` remain as app-shell compatibility mirrors until the start/pause/win overlays are converted from menu-controller state to fully stacked runtime scenes.
- Deprecated adapter files remain temporarily for existing external imports and regression tests, but they must not receive new business logic.
