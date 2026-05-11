# ADR 0003: Core input system

## Status

Accepted

> Numbering note (2026-05-09): this repository also has `0003-contained-terrain-scale.md`; both ADRs predate the numbering cleanup and remain as historical records.

## Context

Keyboard and controller handling currently spans browser adapters, menu code, settings UI, and duplicated `src/input.js` / `src/core/input.js` helpers. The game also needs the tilemap editor to share the same patterns for user input, hints, configuration, and future controller selection.

The current string-bind model (`KeyA`, `PadButton0`, `PadAxis0-`) is hard to test, hard to extend to analog values, and does not model controller assignment or future multiplayer cleanly.

## Decision

Create a reusable, testable `src/core/input/` system. Core input is pure domain logic and must not touch DOM, `navigator`, `localStorage`, browser events, or game/editor globals.

Core input owns:

- structured controls and bindings
- semantic action ids, e.g. `player.moveX`, `menu.accept`, `system.pause`
- action kinds: button and analog axis actions
- input contexts with priority
- frame lifecycle, pressed/released transitions, and source-edge consumption
- slot/device assignment, initially `player1`
- selected controller runtime id/fingerprint model
- binding validation, conflict helpers, and bind-capture primitives
- input settings normalization/migration as pure functions

Browser/app/editor adapters own:

- DOM keyboard/pointer/wheel events
- Gamepad API polling
- `preventDefault()` calls, guided by profile metadata
- localStorage persistence
- menu/editor/game behavior
- rendering hints, keycaps, controller icons, and settings DOM

## Profiles

Core provides primitives. Product-specific defaults live in explicit profiles, not hardcoded in the engine.

The game profile defines gameplay, menu, system, and devtools actions. The editor profile will define editor-specific shortcuts and pointer semantics. Both share the same input settings object and namespaced action ids.

Profiles may include UI grouping metadata for settings/hints, but core does not render UI.

## Bindings

New bindings are structured objects, for example:

```js
{ deviceType: 'keyboard', control: 'key', code: 'Space' }
{ deviceType: 'gamepad', control: 'button', index: 0 }
{ deviceType: 'gamepad', control: 'axis', index: 0 }
{ deviceType: 'gamepad', control: 'axisDirection', index: 0, direction: -1, threshold: 0.35 }
```

Semantic axis actions such as `player.moveX` replace separate persisted `left` / `right` actions. Settings UI may still show virtual rows like “Move Left” and “Move Right”, but persistence stores only the semantic action.

Modifier combos are first-class keyboard bindings. Standalone modifier keys and modified combos are allowed only when action metadata permits them.

## Analog and digital input

Core supports analog values and digital fallback. Keyboard keys and D-pad buttons can contribute `-1` or `+1` to axis actions. Sticks contribute continuous values after deadzone processing.

Initial deadzone is a global gamepad default. The data model allows future per-controller and per-binding overrides, but UI remains minimal until needed.

## Contexts and consumption

Input contexts are prioritized. Typical order:

1. bind capture
2. global/devtools
3. menu
4. gameplay/editor

When a high-priority context consumes an action press, core consumes the source input edge, not merely the action name. This allows the same physical key to mean `menu.accept` and `player.jump` without double-triggering when the menu is active.

## Slots and controller selection

Use slots immediately, even with one player:

```js
player1: {
  devices: {
    keyboard: { enabled: true },
    gamepad: { enabled: true, selectedFingerprint: null, selectedRuntimeId: null }
  }
}
```

Controller enable/disable gates gamepad input but preserves selected controller and presentation preferences. Keyboard is model-enabled but not user-toggleable in normal UI. Settings normalization prevents accidental no-input lockout by re-enabling keyboard if all devices are disabled.

Controller identity separates runtime id from persistent fingerprint:

- runtime id: current browser/gamepad session id, e.g. `gamepad:0`
- fingerprint: best-effort persistent identity from browser metadata

Gameplay should not silently switch to another controller after disconnect. Reselection is explicit.

## Presentation and icon packs

Core/profile expose structured control descriptors and action labels only. UI presentation is outside core and may choose text, keycaps, or controller icon packs.

Controller icon selection should support this precedence:

1. per-controller fingerprint override
2. global gamepad icon pack preference
3. auto-detected controller family
4. generic fallback

Kenney-style input prompt assets can be added behind this presenter abstraction later.

## Settings migration

Settings move toward a unified `settings.input` object. Old v1 `keyboardBinds` and `gamepadBinds` migrate at the settings boundary into structured semantic bindings.

Normalization is pure and returns structured warnings for recoverable cleanup:

- unknown actions stripped
- malformed known bindings reset per action
- no enabled devices corrected by re-enabling keyboard

Startup load is forgiving. Raw JSON replacement can be stricter for root types/enums while still reporting recoverable input warnings.

Unknown input actions are stripped; no long-lived legacy compatibility API is kept.

## Implementation plan

Use tracer-bullet slices:

1. Add this ADR, pure `src/core/input/` primitives, game profile, settings migration, and core tests.
2. Wire gameplay to semantic actions.
3. Wire menu/navigation to normalized `menu.*` actions and extract a small reusable UI navigation helper.
4. Wire settings/bind capture/persistence to structured input settings.
5. Wire editor keyboard shortcuts and limited pointer descriptors to the same system.
6. Migrate devtools shortcuts into profile actions unless complexity spikes.
7. Delete old duplicated input paths once tests cover the migration.

## Slice 1 implementation notes

The first slice establishes the pure core foundation without wiring it into the browser runtime yet.

Added modules:

- `src/core/input/runtime.js`: frame lifecycle, normalized events/snapshots, action queries, source-edge consumption, last active source tracking, and selected gamepad runtime gating.
- `src/core/input/settings.js`: unified input settings defaults, v1 string-bind migration, structured binding validation, safe slot/device normalization, and structured warnings.
- `src/core/input/utils.js`: control identity, binding identity, analog deadzone normalization, and physical binding comparison helpers.
- `src/core/input/index.js`: public exports for the new core input package.
- `src/app/input/game-input-profile.js`: game-owned profile with gameplay/menu/system/devtools semantic actions, defaults, contexts, and settings UI grouping metadata.
- `tests/core-input.spec.js`: core behavior coverage for keyboard, gamepad, axis/deadzone, digital fallback, source-edge consumption, v1 migration, normalization warnings, no-input lockout prevention, and last-used display group.

Validation command for this slice:

```sh
bunx playwright test tests/core-boundary.spec.js tests/core-input.spec.js --project=chromium
```

At this point the existing game/editor runtime still uses the old input path. The next slice should wire gameplay to the new semantic actions without adding a long-lived legacy compatibility layer.

## Slice 2 implementation notes

Gameplay is now wired to the new semantic core input runtime while menu/settings/editor continue to use the old path during migration.

Added/changed modules:

- `src/app/input/browser-input-adapter.js`: browser-owned adapter that queues DOM keyboard events, polls Gamepad API snapshots, and feeds normalized events/snapshots into `createInputRuntime` at frame boundaries.
- `src/app/game-state.js` / `src/app/settings/settings.js`: create and refresh `game.inputRuntime` from normalized/migrated app settings so existing v1 gameplay binds still route through semantic actions.
- `src/main.js`: queues keyboard events for the new runtime, begins/ends core input frames, and checks semantic `system.pause` for gameplay pause.
- `src/scenes/gameplay-scene.js` / `src/core/physics.js`: gameplay updates query `player.moveX`, `player.jump`, `player.dash`, `player.attack`, and `system.restart` when passed a core input runtime, while preserving old tests during the transition.
- `tests/update-gameplay.spec.js`: covers gameplay movement/jump through `createInputRuntime` semantic actions.

Validation command for this slice:

```sh
bunx playwright test tests/core-boundary.spec.js tests/core-input.spec.js tests/update-gameplay.spec.js tests/game-smoke.spec.js --project=chromium
```

## Slice 3 implementation notes

Menu navigation now uses the semantic core input route while settings/editor binding flows remain on the old path during migration.

Added/changed modules:

- `src/ui/navigation.js`: reusable DOM focus helpers for visible focusables, current/fallback focus, linear movement, and horizontal button-group movement.
- `src/app/ui/menu/**`: routes active menu input through `menu.navigateX`, `menu.navigateY`, `menu.accept`, and `menu.back`; keeps page-specific back/activation behavior in menu code and retains the old gamepad fallback for transitional settings/bind paths.
- `src/main.js`: lets queued keyboard events reach the core input frame before menu activation/back handling so keyboard and controller menu actions share the same semantic route where practical.
- `src/core/input/runtime.js`: detects semantic press/release transitions after deadzone processing, so analog stick menu navigation fires when crossing the effective action threshold, not only when the raw axis leaves zero.
- `tests/core-input.spec.js`: covers effective deadzone threshold press behavior for axis actions.

Validation command for this slice:

```sh
bunx playwright test tests/core-boundary.spec.js tests/core-input.spec.js tests/game-smoke.spec.js --project=chromium
```

## Slice 4 implementation notes

Unified input settings are now the app-level persisted source of truth while the visible Keyboard/Controller pages continue to use transitional legacy row state.

Added/changed modules:

- `src/app/settings/settings.js`: normalizes persisted app settings to `schemaVersion: 2` with `settings.input`, migrates old v1 `keyboardBinds` / `gamepadBinds` / `controllerEnabled` on load/save, derives temporary legacy UI rows from structured bindings, and syncs remap UI edits back into semantic action bindings without persisting old bind fields.
- `src/app/input/browser-input-adapter.js`: creates runtimes directly from `settings.input` instead of overlaying old `controllerEnabled`.
- `src/main.js`, `src/app/ui/menu/**`, `src/app/testing/gym.js`: read controller enabled state from `settings.input.slots.player1.devices.gamepad.enabled` for events/status while preserving current UI behavior.
- `tests/settings.spec.js`: covers v1-to-v2 persistence and transitional UI sync preserving both sides of `player.moveX`.
- `tests/game-smoke.spec.js`: verifies advanced settings JSON now dumps structured `input.bindings` rather than old `keyboardBinds` / `gamepadBinds`.

Validation command for this slice:

```sh
bunx playwright test tests/settings.spec.js tests/core-boundary.spec.js tests/core-input.spec.js tests/update-gameplay.spec.js tests/game-smoke.spec.js --project=chromium
```

## Slice 5 implementation notes

Bind-capture primitives and explicit controller selection are now available in the core input route, with a small Controller settings UI selector layered on top.

Added/changed modules:

- `src/core/input/capture.js`: pure bind-capture helpers for keyboard events and gamepad button/axis snapshots, duplicate/conflict checks, cancellation, and immutable captured-binding application.
- `src/core/input/runtime.js`: exposes connected device snapshots, explicit gamepad selection by slot, selected runtime/fingerprint persistence, and selected-controller routing that avoids silent switching to a different controller after disconnect.
- `src/app/ui/settings/settings-view.js` / `src/app/ui/menu/**`: add a Controller settings selector for connected gamepads and persist the selected runtime/fingerprint separately from controller enable/disable.
- `tests/core-input.spec.js`: covers bind capture, duplicate prevention, controller selection, and no-silent-switch routing after disconnect.

Validation command for this slice:

```sh
bunx playwright test tests/core-boundary.spec.js tests/core-input.spec.js tests/settings.spec.js tests/update-gameplay.spec.js tests/game-smoke.spec.js --project=chromium
```

## Slice 6 implementation notes

Input hints now use a reusable app-side presentation layer that derives controls from semantic action ids and normalized structured bindings instead of static `wasd` / `arrows` / `gamepad` tables.

Added/changed modules and assets:

- `src/app/input/input-hints.js`: control label and hint-part helpers for semantic actions, display-group-aware binding selection, text fallback, and a first Xbox icon-pack mapping hook.
- `src/input.js`: renders `[data-input-hint]` elements from semantic action ids (`menu.accept`, `menu.back`, `menu.settings`, etc.), actual bindings, last active source/display group, and optional icon-pack assets.
- `src/core/input/runtime.js`: records last active source when press/release transition queries match, so hints can follow controller/menu button usage as well as continuous gameplay values.
- `src/app/ui/menu/**`: routes `menu.settings` through the menu semantic input path and lets clickable back/settings hints invoke the same menu action handler.
- `public/assets/kenney-input-prompts/`: first minimal Kenney Input Prompts runtime asset subset with CC0 license/source attribution.
- `tests/core-input.spec.js`: covers semantic hint derivation, keyboard display groups, last-active gamepad source selection, and Xbox icon presenter fallback.

Validation command for this slice:

```sh
bunx playwright test tests/core-input.spec.js tests/game-smoke.spec.js --project=chromium
bun run build
```

## Slice 7 implementation notes

Devtools shortcuts now route through the semantic `global` input context instead of a raw Backquote keydown path.

Added/changed modules:

- `src/devtools/toolbox-dom.js`: exposes `handleDevToolsInput()` for `devtools.toggle` and `devtools.pause`, while keeping developer-mode/gameplay eligibility and panel behavior in devtools code.
- `src/main.js`: processes the `global` route after the core input frame begins, consumes handled devtools source edges, and only lets lower-priority gameplay pause see `KeyP` when devtools did not handle it.
- `tests/core-input.spec.js`: covers `devtools.pause` consuming the shared `KeyP` source edge before `system.pause` can double-trigger.

Validation command for this slice:

```sh
bunx playwright test tests/devtools-toolbox.spec.js tests/core-input.spec.js tests/game-smoke.spec.js --project=chromium
```

## Slice 8 implementation notes

Editor keyboard shortcuts now use the semantic core input route while pointer painting, wheel zoom, pinch zoom, and spatial canvas behavior remain owned by editor code.

Added/changed modules:

- `src/app/input/game-input-profile.js`: adds `editor` context actions for pan modifier, save, preview, undo, and redo, including primary-modifier keyboard combo bindings.
- `src/core/input/runtime.js`: honors keyboard modifier requirements for combo bindings and skips modifier combos in semantic down/up fallback checks that do not carry event modifier metadata.
- `src/editor/map-editor.js`: creates a browser input adapter/runtime from normalized app settings and routes Space pan, Ctrl/Cmd+S, Ctrl/Cmd+Enter, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl/Cmd+Y through `editor.*` actions.
- `tests/core-input.spec.js`: covers keyboard combo modifier matching.
- `tests/map-editor.spec.js`: covers editor undo/redo keyboard shortcuts through the semantic route.

Validation command for this slice:

```sh
bunx playwright test tests/core-boundary.spec.js tests/core-input.spec.js tests/map-editor.spec.js tests/game-smoke.spec.js --project=chromium
```

## Slice 9 implementation notes

Cleanup started by removing the duplicate core legacy input module and the remaining gameplay fallback to string-bind helpers.

Added/changed modules and docs:

- Deleted `src/core/input.js`; core input imports now resolve through `src/core/input/` modules only.
- `src/core/physics.js`: requires a semantic core input runtime for gameplay updates instead of accepting old `left` / `jump` string-bind state.
- `src/main.js`: gameplay pause now reads only semantic `system.pause`; the old `hasPressed(input, 'pause')` fallback is gone.
- `src/core/settings.js`: no longer imports legacy bind defaults; it only normalizes non-input core settings used by core/domain tests.
- `src/app/settings/settings.js`: imports shared cloning from `src/core/input/utils.js` rather than the deleted legacy module.
- `docs/patterns/settings-and-ui.md`: documents `schemaVersion: 2`, `settings.input` ownership, semantic binding persistence, and controller selection conventions.
- `tests/update-gameplay.spec.js`: old gameplay fallback tests now use `createInputRuntime` semantic controls.

Validation command for this slice:

```sh
bunx playwright test tests/core-boundary.spec.js tests/update-gameplay.spec.js tests/speedrun.spec.js --project=chromium
```

## Next slices

1. **Wire gameplay to new core input** _(implemented in slice 2)_
   - Add a browser adapter that feeds normalized keyboard events and gamepad snapshots into `createInputRuntime`.
   - Update gameplay/physics to query semantic actions such as `player.moveX`, `player.jump`, `player.dash`, `player.attack`, `system.pause`, and `system.restart`.
   - Preserve current gameplay behavior with tests before expanding settings/menu scope.

2. **Wire menu input and extract UI navigation helper** _(implemented in slice 3)_
   - Replace raw gamepad menu checks with `menu.navigateX`, `menu.navigateY`, `menu.accept`, and `menu.back` routes.
   - Let keyboard and controller navigation share the same normalized menu action path where practical.
   - Extract generic focus movement/activation helpers into `src/ui/navigation.js`; keep page-specific behavior in menu code.

3. **Integrate unified input settings persistence** _(implemented in slice 4)_
   - Move app settings toward `settings.input` as the persisted source of truth.
   - Migrate old `keyboardBinds` / `gamepadBinds` on load.
   - Keep the visible Keyboard/Controller settings pages mostly unchanged while editing structured semantic bindings internally.

4. **Bind capture and controller selection** _(implemented in slice 5)_
   - Replace current remap state with core bind-capture primitives.
   - Add selected-controller behavior in Controller settings while keeping controller enable/disable separate from selection.
   - Add direct tests for controller remapping, duplicate prevention, cancel behavior, and selected controller routing.

5. **Input hints and presentation layer** _(implemented in slice 6)_
   - Add reusable control presentation/keycap helpers outside core.
   - Implement the first icon-pack presenter from `.temp/kenney_input-prompts_1.5`, copying only the needed runtime assets into the app asset tree and preserving license attribution.
   - Derive hints from actual bindings and last active source/display group instead of hardcoded `wasd` / `arrows` / `gamepad` checks.
   - Render each action hint as its own pill/badge built from structured hint parts, not as one grouped/static hint string shared by all usages.
   - Support optional clickable hints for UI/system actions such as back and settings; clicking a hint dispatches the same semantic action path as the bound input instead of bypassing input/menu logic.
   - Let usage sites request hints by semantic action id plus optional presentation tokens while keeping fallback text available.
   - Lay the abstraction for controller icon packs and per-controller/global overrides, with text fallback first.

6. **Devtools migration** _(implemented in slice 7)_
   - Route Backquote and devtools pause through the `global` input context and profile actions.
   - Keep developer-mode gating and panel behavior in devtools code.
   - Test that devtools shortcuts do not double-trigger pause/menu actions.

7. **Editor integration** _(implemented in slice 8)_
   - Use core input for editor keyboard shortcuts such as pan modifier, save, preview, undo, and redo.
   - Introduce limited pointer/wheel descriptors only where useful; keep paint strokes, pinch zoom, and spatial editor behavior in editor code.

8. **Cleanup and documentation** _(started in slice 9)_
   - Delete or fold the duplicated old `src/core/input.js` and thin/remove old `src/input.js` once runtime migration is complete.
   - Remove old string-bind code paths.
   - Update `docs/patterns/settings-and-ui.md` to describe the new input settings ownership and UI conventions.
