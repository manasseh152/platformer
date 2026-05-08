# ADR 0003: Core input system

## Status

Accepted

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
