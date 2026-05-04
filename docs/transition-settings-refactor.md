# Transition and Settings Refactor Handoff

## Goal

Refactor menu/settings transitions to use the **View Transition API** for section-level navigation/state changes, while keeping direct interaction feedback as CSS/instant. Add a persistent app settings model with motion preference, developer mode, bindings, and controller enabled state.

## Core decisions

### Transition boundary

Use View Transition API for:

- screen/menu navigation:
  - start screen → game
  - game ↔ pause
  - pause → main menu
  - settings ↔ controls
  - settings ↔ advanced
- section-level reveal/hide:
  - Developer Mode revealing/hiding developer tools
- full app settings JSON replacement **only if** it changes section-level layout, currently mainly `developerMode` visibility while on Advanced.

Do **not** use View Transition API for:

- hover/focus/pressed direct feedback
- motion toggle changes
- active segmented-control state
- binding edits/listening/cancel/commit/defaults
- keyboard/controller device switch inside Controls
- JSON dump/status text
- controller diagnostic text updates

No CSS fallback animations for browsers without View Transition API. Structural changes are instant if VT unavailable.

### Motion preference

Add 3-state setting:

```js
motion: 'system' | 'on' | 'off'
```

Effective behavior:

```js
off    => reduce motion / no VT
on     => force motion on, even if OS prefers reduced motion
system => follow matchMedia('(prefers-reduced-motion: reduce)')
```

Listen to runtime OS reduced-motion changes and update effective body class/status.

Motion setting should affect:

- View Transition API enable/disable
- non-micro CSS transitions
- smooth scrolling in focus reveal
- UI/canvas transition motion

Gameplay motion/effects are out of scope for this session.

When motion is effectively reduced:

- no VT
- no smooth scroll
- no hover movement
- transitions should be instant
- hover/focus style changes may still happen instantly

### Settings persistence

Use **one JSON object** in `localStorage`, masked from normal users.

Recommended shape:

```json
{
  "schemaVersion": 1,
  "motion": "system",
  "developerMode": false,
  "controllerEnabled": true,
  "keyboardBinds": {},
  "gamepadBinds": {}
}
```

Storage key recommendation:

```js
'chibi.settings'
```

Auto-save immediately on committed changes:

- motion preference
- developer mode
- controller enabled
- keyboard bind commits
- controller bind commits
- clear extra binds
- reset defaults
- valid app settings JSON replacement

Do not save transient listening state.

JSON replacement behavior:

- parse object
- merge missing known keys from defaults
- validate known values
- strip unknown keys
- write normalized full object
- reject invalid known values with clear error
- include `schemaVersion`
- if JSON replacement sets `developerMode: false` while Advanced dev tools are visible, apply immediately and hide them.

## New architecture

### New `src/settings.js`

Responsibilities:

- default settings creation
- load from `localStorage`
- validate/normalize settings object
- save settings
- apply settings to runtime `game.input`
- sync input/binds back into settings after commits
- replace settings from JSON
- serialize settings for developer dump

Suggested exports:

```js
export const SETTINGS_KEY = 'chibi.settings';

export function defaultSettings() {}

export function normalizeSettings(candidate) {}

export function loadSettings() {}

export function saveSettings(settings) {}

export function applySettingsToGame(game) {}

export function syncSettingsFromInput(game) {}

export function replaceSettings(game, json) {}
```

Validation:

- `motion` must be `'system' | 'on' | 'off'`
- `developerMode` boolean
- `controllerEnabled` boolean
- `keyboardBinds` valid same shape as `defaultBinds`
- `gamepadBinds` valid same shape as default gamepad binds
- unknown keys stripped
- missing keys defaulted

You may need to export `defaultGamepadBinds` and `validBinds`-like helpers from `src/input.js`.

### New `src/transitions.js`

Responsibilities:

- reduced-motion calculation
- body class application
- matchMedia listener
- View Transition wrapper

Suggested API:

```js
export function shouldReduceMotion(game) {}

export function applyMotionPreference(game) {}

export function setupMotionPreference(game) {}

export function runDOMTransition(game, change, after) {}
```

Behavior:

```js
export function runDOMTransition(game, change, after) {
  if (shouldReduceMotion(game) || !document.startViewTransition) {
    change();
    after?.();
    return null;
  }

  const transition = document.startViewTransition(change);
  transition.finished.finally(() => after?.());
  return transition;
}
```

Body class recommendation:

```js
document.body.classList.toggle('motion-reduce', shouldReduceMotion(game));
```

Also update visible motion status text when present.

### `game` state

In `src/state.js`, add:

```js
settings: loadSettings(),
menu: {
  page: 'main',       // 'main' | 'settings' | 'controls' | 'advanced'
  origin: 'pause',    // 'pause' | 'start'
  direction: 'forward'
}
```

After creating input, apply loaded settings to input.

Persistent settings live in `game.settings`.

Transient navigation lives in `game.menu`.

DOM mirrors menu state:

```js
ui.pauseScreen.dataset.menuPage = game.menu.page;
ui.pauseScreen.dataset.menuDirection = game.menu.direction;
document.body.dataset.menuOrigin = game.menu.origin;
```

Replace old `body.start-settings` with `body[data-menu-origin="start"]` or a clearer class like `settings-from-start`. Prefer data attributes for consistency.

Remove old `.settings-open`.

## Menu/page model

Pages:

```txt
main
settings
controls
advanced
```

Back behavior:

- Controls Back → Settings
- Advanced Back → Settings
- Settings Back:
  - if opened from Pause → main pause page
  - if opened from Start → close overlay back to start screen
- Main Back does nothing or resumes via existing Continue.

Always open Settings top-level when clicking Settings from Start or Pause. Do not persist/reopen last nested page.

Use generic helpers in `src/menu.js`:

```js
function setMenuPage(game, page, direction = 'forward') {}
function openSettings(game, origin) {}
function closeSettings(game) {}
function goBack(game) {}
function updateMenuChrome(game) {}
```

`updateMenuChrome` should set outer card eyebrow/title based on active page.

Title behavior:

- Main page: title `Paused`, eyebrow `Paused`
- Settings: title `Settings`
- Controls: title `Controls`
- Advanced: title `Advanced`
- Settings/Controls/Advanced eyebrow:
  - from start: `Before you begin` or `Settings`
  - from pause: `Settings`

## HTML structure

Refactor `index.html`.

Start screen:

```html
<button id="startSettingsButton" class="secondary">Settings</button>
```

Pause main:

```html
<button id="settingsButton" class="secondary">Settings</button>
```

Shared pause/settings card should have dynamic chrome:

```html
<div class="eyebrow" id="menuEyebrow">Paused</div>
<h2 id="menuTitle">Paused</h2>
<div id="menuPages" class="menu-pages">
  <div id="pauseMainPage" class="menu-page" data-page="main">...</div>
  <div id="settingsPage" class="menu-page" data-page="settings">...</div>
  <div id="controlsPage" class="menu-page" data-page="controls">...</div>
  <div id="advancedPage" class="menu-page" data-page="advanced">...</div>
</div>
```

Top-level Settings page:

- description:
  > Tune how the game feels before jumping in.
- Motion segmented control:
  - System
  - On
  - Off
- helper:
  > System follows your device preference. On and Off override it.
- effective status text:
  - `System is currently allowing motion.`
  - `System is currently reducing motion.`
  - `Animations are forced on.`
  - `Animations are forced off.`
- nav/actions:
  - Controls
  - Advanced
  - Back

Controls page:

- description:
  > Remap keyboard and controller inputs.
- Keyboard / Controller segmented control
- binding status
- bind list
- Controller enabled toggle
- actions:
  - Defaults
  - Back

Controls Defaults behavior:

- if Keyboard selected: reset keyboard defaults
- if Controller selected: reset controller defaults
- save settings immediately
- show specific status message.

Advanced page:

Always visible:

- explanation:
  > Advanced tools are for debugging, diagnostics, and raw settings edits.
- Developer Mode toggle:
  - helper: `Shows diagnostics and raw settings tools.`
- Back

Developer Mode only:

- full App Settings JSON editor:
  - textarea
  - Dump app settings
  - Replace app settings
  - status
- controller diagnostics:
  - controller name
  - pressed inputs
- future debug tools area

Replacing settings JSON should use `window.confirm()` before applying.

No separate bindings JSON UI. Bindings are included in the one app settings JSON.

## CSS changes

In `styles/main.css`:

- Remove old structural nested slide/height transitions:
  - `.menu-pages { transition: height ... }`
  - `.menu-page { transition: transform/opacity ... }`
  - `#pauseScreen.settings-open ...`
  - `body.start-settings ...`
  - `body.no-nested-menu-transition ...`
- Replace with data-attribute visibility/layout:

```css
.menu-page {
  display: none;
}

#pauseScreen[data-menu-page="main"] [data-page="main"],
#pauseScreen[data-menu-page="settings"] [data-page="settings"],
#pauseScreen[data-menu-page="controls"] [data-page="controls"],
#pauseScreen[data-menu-page="advanced"] [data-page="advanced"] {
  display: block;
}
```

- Show pause/settings overlay from start via new origin state:

```css
body[data-menu-origin="start"] #pauseScreen {
  opacity: 1;
  pointer-events: auto;
  z-index: 11;
}
```

- Preserve the current dynamic modal/card sizing feel when navigating between Pause, Settings, Controls, and Advanced. Remove the old manual `.menu-pages` height transition, but do **not** turn the menu card into a fixed-size modal. The card should remain content-driven per page, and View Transition snapshots should make width/height changes feel like a smooth card morph instead of a snap.

- Card width:

```css
#pauseScreen[data-menu-page="controls"] .menu-card,
#pauseScreen[data-menu-page="advanced"] .menu-card {
  width: min(940px, calc(100vw - 32px));
}
```

Settings can remain narrow. Controls/Advanced can widen. Height should remain dynamic/content-driven for each page.

- View transition names should be updated to new page/card structure. Suggested:

```css
#startScreen { view-transition-name: start-screen; }
#pauseScreen { view-transition-name: pause-screen; }
#pauseScreen .menu-card { view-transition-name: menu-card; }
```

Be careful not to assign same `view-transition-name` to multiple simultaneously rendered elements.

- Add direction-aware VT animations for page changes if feasible:

```css
::view-transition-old(menu-card),
::view-transition-new(menu-card) {
  animation-duration: .16s;
  animation-timing-function: ease;
}
```

Shared card morph/crossfade is required to preserve the pleasant dynamic sizing feel. Direction-specific old/new page snapshots are optional, but desired.

- Add motion reduce CSS:

```css
body.motion-reduce canvas,
body.motion-reduce #hud,
body.motion-reduce #controls,
body.motion-reduce #message,
body.motion-reduce #startScreen,
body.motion-reduce #pauseScreen,
body.motion-reduce button {
  transition-duration: 0s !important;
  animation-duration: 0s !important;
}

body.motion-reduce button:hover {
  transform: none;
}
```

Structural CSS transitions should already be removed.

## JS behavior updates

### `src/dom.js`

Update IDs for new pages/elements:

- `menuEyebrow`
- `menuTitle`
- `pauseMainPage`
- `settingsPage`
- `controlsPage`
- `advancedPage`
- motion buttons/status
- controls nav button
- advanced nav button
- developer mode checkbox
- settings JSON textarea/buttons/status
- advanced diagnostics container

Remove/repoint old `settingsPanel` references.

### `src/menu.js`

Remove local `transitionDOM`.

Import from `transitions.js`:

```js
import { runDOMTransition, shouldReduceMotion, applyMotionPreference } from './transitions.js';
```

Update:

- `activeMenuRoot(game)` returns active page element based on `game.menu.page`.
- `updateMenuPageHeight` may become unnecessary if old height transition removed. If still needed for layout, set instantly.
- `focusAndReveal` uses:
  ```js
  behavior: shouldReduceMotion(game) ? 'auto' : 'smooth'
  ```
- `openSettings(game, origin)`:
  - set origin
  - page `settings`
  - show overlay
  - VT wrap because navigation/section-level
- `setMenuPage(game, page, direction)`:
  - VT wrap for Settings↔Controls/Advanced navigation
  - update dataset/title/focus after
- `goBack(game)`:
  - controls/advanced → settings
  - settings → close overlay or pause main
- `setPaused`, `startGame`, `returnToMainMenu`:
  - use `runDOMTransition`
- Device switch Keyboard/Controller:
  - instant, no VT
  - renderBinds
  - save settings if relevant
- Developer Mode toggle:
  - use VT because it reveals/hides dev section
  - save immediately
- Motion toggle:
  - instant
  - save immediately
  - apply body class/status immediately
- App Settings JSON:
  - Dump: instant
  - Replace:
    - confirm
    - validate first
    - if invalid: status error, no VT
    - if valid and changes section-level layout: VT
    - otherwise instant
    - apply settings to game/input/UI
    - save normalized settings

### `src/input.js`

Likely changes:

- export `defaultGamepadBinds`
- add `validGamepadBinds` or general bind validation helper
- when binding commits happen, caller should save settings afterward
- reset controller defaults available from Controls Defaults.

### `src/main.js`

Update escape/back logic:

Current checks `body.start-settings` and `.settings-open`.

New logic:

- if active menu page is controls/advanced/settings, call `goBack(game)`
- if game paused on main and Escape pause hit, resume
- start settings overlay origin from body dataset or game.menu.

Gamepad back logic similarly:

- if menu page controls/advanced/settings → `goBack(game)`
- else if started → resume

## Tests

Update Playwright tests. Do not assert animation internals.

Recommended coverage:

1. Start screen has **Settings**, not Controls.
2. Start Settings opens top-level Settings page.
3. Settings page shows Motion segmented buttons and effective status.
4. Motion Off:
   - click Off
   - body has `motion-reduce`
   - reload
   - Off remains active/body class remains.
5. Settings → Controls:
   - bind rows visible/count 7
   - Keyboard/Controller toggle works
   - Back returns to Settings, not start/pause root.
6. Settings → Advanced:
   - Developer Mode toggle visible
   - dev tools hidden initially if off
   - enabling Developer Mode reveals settings JSON tools/controller diagnostics
   - reload persists Developer Mode.
7. Settings JSON:
   - Dump app settings populates JSON containing `schemaVersion`, `motion`, `developerMode`, binds.
   - Replace with valid JSON changing motion/developerMode applies.
   - Replace with invalid JSON shows error.
8. Pause flow:
   - start game
   - Escape pauses
   - Pause menu Settings opens top-level Settings
   - Back from Settings returns to pause main
   - Continue resumes.
9. Controls Defaults:
   - Keyboard selected → Defaults restores keyboard/status.
   - Controller selected → Defaults restores controller/status.

## Suggested implementation order

1. `settings.js`: defaults/load/save/normalize/apply/sync.
2. Add `game.settings` and `game.menu` in `state.js`.
3. Refactor HTML/CSS from old `settings-open` panel into generic pages.
4. Update `dom.js`.
5. Refactor `menu.js` navigation/back/focus around `game.menu.page`.
6. Add `transitions.js` and wire structural navigation to `runDOMTransition`.
7. Wire motion preference and body class/status.
8. Move Advanced/Developer Mode/settings JSON tools.
9. Sync all input changes to settings.
10. Update Playwright tests.
