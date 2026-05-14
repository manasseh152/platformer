---
title: Settings and UI patterns
---

# Settings and UI patterns

## Goals

Settings and menu UI should be simple, state-driven, and scene-owned.

Avoid one-off nested panels, hidden implementation states, and duplicated persistence rules.

## State ownership

Persistent app settings live in `game.settings`.

Editor-only preferences, such as map editor auto-save and floating controls, are page-local tool preferences rather than app settings. Document them with the tool pattern instead of adding them to `game.settings`.

Transient menu navigation lives in `game.menu`.

Examples:

```js
game.settings = {
  schemaVersion: 2,
  motion: 'system',
  developerMode: false,
  speedRunMode: false,
  input: {
    bindings: {},
    slots: {
      player1: {
        devices: {
          keyboard: { enabled: true },
          gamepad: { enabled: true, selectedFingerprint: null, selectedRuntimeId: null }
        }
      }
    }
  }
};

game.menu = {
  page: 'main',
  origin: 'pause',
  direction: 'forward',
  settingsCategory: null
};
```

Do not store transient page/listening state in persisted settings.

## Settings persistence

Use one normalized JSON object in localStorage.

Rules:

- Missing known keys are filled from defaults.
- Invalid known values are rejected or normalized at the settings boundary.
- Unknown keys are stripped.
- Settings save immediately after committed changes.
- Bind-listening/cancel states are not saved.

Normal setting commits include:

- motion preference
- developer mode
- controller enabled under `settings.input.slots.player1.devices.gamepad.enabled`
- explicit selected controller runtime/fingerprint under the same slot device
- speed run mode
- input bind commit/reset under semantic `settings.input.bindings` action ids
- valid app-settings JSON replacement

## Page model

Current pages:

- `main`
- `settings-category`
- `level-select`

Settings categories are tabs inside `settings-category`, tracked by transient `game.menu.settingsCategory`. Start and pause Settings open `settings-category` directly with Controls selected by default.

Back behavior should be explicit and predictable:

- settings from pause → pause main
- settings from start → close overlay back to start
- level select from pause/start follows its caller context

Do not persist or restore the last settings tab automatically.

## DOM pattern

Scenes own their DOM. The shell provides roots:

```html
<canvas id="game"></canvas>
<div id="scene-root"></div>
<div id="overlay-root"></div>
```

Use semantic scene namespaces:

- `.scene-start-screen`
- `.scene-pause-overlay`
- `.scene-settings-overlay`
- `.scene-scenario-browser`

Use shared design-system primitives for reusable UI pieces:

- `.ds-*` for shared buttons, cards, rows, chips, sections
- scene-specific classes for layout and page composition

Prefer data attributes for state:

```html
<div id="pauseScreen" data-menu-page="settings-category" data-current-settings-category="controls" data-menu-origin="pause"></div>
```

CSS should reveal pages from state, not from ad-hoc classes:

```css
.menu-page { display: none; }

#pauseScreen[data-menu-page="settings-category"] [data-page="settings-category"] {
  display: block;
}
```

## Motion and transitions

Motion setting values:

```js
'system' | 'on' | 'off'
```

Effective behavior:

- `off`: reduce motion
- `on`: force motion
- `system`: follow `prefers-reduced-motion`

Use View Transition API only for structural UI changes:

- start ↔ gameplay
- gameplay ↔ pause
- page/category navigation
- developer tools reveal/hide
- JSON replacement only when it changes visible structure

Do not use View Transition API for direct interaction feedback:

- hover/focus/pressed state
- segmented button active changes
- bind listening/cancel/commit
- controller diagnostics text
- status messages

If View Transition API is unavailable or motion is reduced, structural changes are instant.

## Settings UI categories

Settings uses a direct tab system, not a separate settings hub. The category tabs render inside the settings category page and switch panels without changing the page model.

Recommended category order:

1. Controls
2. Gameplay
3. Accessibility
4. Graphics
5. Advanced

The Controls category owns profile selection plus sub-tabs for Profiles, Gameplay, Navigation & System, Controller, and Touch. Category tab panels use the same row/section primitives. Add new settings by adding category metadata and renderers, not by inventing new page mechanics.

## Advanced tools

Developer Mode gates diagnostics and raw JSON tools.

Always visible in Advanced:

- Developer Mode toggle
- explanation of what it unlocks

Visible only when Developer Mode is enabled:

- raw app settings JSON dump/replace
- controller diagnostics
- debug/test-only tooling

Replacing settings JSON should validate before applying and show a clear status on failure.

## Input settings

`settings.input` is the persisted source of truth for gameplay, menu, system, devtools, and editor shortcuts. Store semantic action ids such as `player.moveX`, `menu.accept`, and `editor.undo`; do not persist legacy `keyboardBinds` / `gamepadBinds` rows.

Controls sub-pages may render friendly rows such as “Move Left” and “Move Right”, but commits should normalize through the core input settings helpers and write structured profile bindings. Controller enable/disable is separate from selected controller identity, and keyboard should remain enabled to prevent no-input lockout.
