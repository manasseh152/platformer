---
title: Input patterns
---

# Input patterns

Shared domain language lives in [`../../CONTEXT.md`](../../CONTEXT.md). This pattern doc covers semantic input, browser adapters, controller identity, settings persistence, and input presentation for the game runtime and Map Editor.

## Core input

Core input lives under `src/core/input/**` and is pure logic. It must not touch DOM, `navigator`, `localStorage`, browser events, game globals, or editor globals.

Core owns:

- structured controls and bindings
- semantic action ids, such as `player.moveX`, `menu.accept`, and `system.pause`
- button and analog axis action kinds
- input contexts with priority
- frame lifecycle, pressed/released transitions, and source-edge consumption
- player/device slots, currently `player1`
- selected controller runtime id and persistent fingerprint model
- binding validation, conflict helpers, bind-capture primitives, and settings normalization helpers

Product-specific defaults live in explicit profiles. Core provides primitives; game/editor profiles define the semantic actions, defaults, labels, and grouping metadata they need.

## Bindings

Persist structured bindings rather than legacy string binds:

```js
{ deviceType: 'keyboard', control: 'key', code: 'Space' }
{ deviceType: 'gamepad', control: 'button', index: 0 }
{ deviceType: 'gamepad', control: 'axis', index: 0 }
{ deviceType: 'gamepad', control: 'axisDirection', index: 0, direction: -1, threshold: 0.35 }
```

Axis actions should be semantic. For example, persist `player.moveX` with keyboard and gamepad contributors instead of separate left/right action records. Settings UI may show virtual rows such as “Move Left” and “Move Right”, but persistence stores the semantic action.

Modifier combos are first-class keyboard bindings. Standalone modifier keys and modified combos are allowed only when action metadata permits them.

## Analog and digital input

Core supports analog values and digital fallback. Keyboard keys and D-pad buttons can contribute `-1` or `+1` to axis actions. Sticks contribute continuous values after deadzone processing.

Initial deadzone is a global gamepad default. The data model can support future per-controller or per-binding overrides, but UI should stay minimal until needed.

## Context priority and consumption

Input contexts are prioritized. Typical order:

1. bind capture
2. global/devtools
3. menu
4. gameplay/editor

When a high-priority context consumes an action press, core consumes the source input edge, not merely the action name. This allows the same physical key to mean `menu.accept` and `player.jump` without double-triggering when a menu is active.

## Slots and controller identity

Use slots even with one player:

```js
player1: {
  devices: {
    keyboard: { enabled: true },
    gamepad: { enabled: true, selectedFingerprint: null, selectedRuntimeId: null }
  }
}
```

Controller enable/disable gates gamepad input but preserves selected controller and presentation preferences. Keyboard is model-enabled but not normally user-toggleable. Settings normalization prevents no-input lockout by re-enabling keyboard if all devices are disabled.

Controller identity separates:

- runtime id: current browser/gamepad session id, such as `gamepad:0`
- fingerprint: best-effort persistent identity from browser metadata

Gameplay should not silently switch to another controller after disconnect. Reselection is explicit.

## Game adapter

Game/browser adapters own:

- DOM keyboard events and Gamepad API polling
- `preventDefault()` behavior guided by profile metadata
- `localStorage` persistence through settings boundaries
- gameplay/menu/system/devtools action routing
- rendering hints, keycaps, controller icons, and settings DOM

Game profile actions should stay semantic and product-oriented, not physical-device-oriented. Examples: `player.jump`, `player.moveX`, `menu.accept`, `menu.back`, `system.pause`.

## Editor adapter

The Map Editor uses the same core input patterns but owns editor-specific behavior:

- pointer, wheel, canvas, and keyboard shortcuts
- editor action ids and controller cursor behavior
- brush cycling and Brush Palette interaction
- editor-local preferences such as floating controls and controller brush settings
- Play Preview and local-save shortcuts

Editor shortcuts should remain documented in [`map-editor.md`](./map-editor.md) when they affect creator workflow.

## Presentation and icon packs

Core/profile expose structured control descriptors and action labels only. UI presentation is outside core and may choose text, keycaps, or controller icon packs.

Controller icon selection should support this precedence:

1. per-controller fingerprint override
2. global gamepad icon pack preference
3. auto-detected controller family
4. generic fallback

## Settings migration

Settings use a unified `settings.input` object. Legacy v1 `keyboardBinds` and `gamepadBinds` normalize at the settings boundary into structured semantic bindings.

Normalization is pure and should return structured warnings for recoverable cleanup. Runtime adapters may surface those warnings in diagnostics or settings UI.

## Testing

Use module tests for pure core behavior:

- settings normalization/migration
- binding validation and duplicate prevention
- bind capture and cancellation
- context priority and source-edge consumption
- controller selection and no-silent-switch routing after disconnect

Use Playwright tests for browser behavior:

- settings UI remapping
- controller/gamepad-visible hints where practical
- menu/gameplay consumption boundaries
- editor shortcuts, controller cursor, and Brush Palette behavior
