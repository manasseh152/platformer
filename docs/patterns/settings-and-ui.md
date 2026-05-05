# Settings and UI patterns

## Goals

Settings and menu UI should be simple, state-driven, and scene-owned.

Avoid one-off nested panels, hidden implementation states, and duplicated persistence rules.

## State ownership

Persistent app settings live in `game.settings`.

Transient menu navigation lives in `game.menu`.

Examples:

```js
game.settings = {
  schemaVersion: 1,
  motion: 'system',
  developerMode: false,
  controllerEnabled: true,
  keyboardBinds: {},
  gamepadBinds: {}
};

game.menu = {
  page: 'main',
  origin: 'pause',
  direction: 'forward'
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
- controller enabled
- keyboard bind commit/reset
- controller bind commit/reset
- valid app-settings JSON replacement

## Page model

Current pages:

- `main`
- `settings`
- `keyboard`
- `controller`
- `accessibility`
- `advanced`
- `level-select`

Back behavior should be explicit and predictable:

- category page → settings hub
- settings hub from pause → pause main
- settings hub from start → close overlay back to start
- level select from pause/start follows its caller context

Do not persist or restore the last nested settings page automatically.

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
<div id="pauseScreen" data-menu-page="settings" data-menu-origin="pause"></div>
```

CSS should reveal pages from state, not from ad-hoc classes:

```css
.menu-page { display: none; }

#pauseScreen[data-menu-page="settings"] [data-page="settings"] {
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

Settings hub lists categories, not implementation panels.

Recommended order:

1. Keyboard
2. Controller
3. Accessibility
4. Advanced

Category pages use the same row/section primitives. Add new settings by adding category metadata and renderers, not by inventing new page mechanics.

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
