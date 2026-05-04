# Settings UX Overhaul Plan

## Goal

Make settings work like a clean game settings menu: a root category hub, reusable category pages, and left/right setting rows. This is Minecraft-like in UX structure, not visual style. Keep the current ChibiOS visual identity while improving hierarchy and scanability.

## Non-goals

- No Pause redesign in this pass beyond settings entry/return behavior.
- No Minecraft skin/block styling.
- No settings storage migration unless a future real persisted setting requires it.
- No empty Graphics/Audio/Legal placeholder pages yet.

## Main and game screen refresh

- Redesign the Start screen as a two-column hero: title/actions on the left, level-preview diorama on the right.
- Keep ChibiOS cozy fantasy identity and reuse existing medieval pixel assets.
- Preserve the existing Start and Settings actions, shortcut hint bar, and Start → Settings flow.
- Refresh the in-game HUD with compact run chrome: act/zone, vigor hearts, objective card, dash state, stronger control strip, and end-run modal styling.
- Keep gameplay canvas readable; overlays stay translucent and non-interactive.
- Collapse to a single-column start layout and compact HUD on small screens.

## UX flow

- Start screen → Settings hub → Back → Start screen.
- Pause menu → Settings hub → Back → Pause menu.
- Settings hub → category → Back → Settings hub.
- All normal settings apply immediately.

Root category order:

1. Keyboard
2. Controller
3. Accessibility
4. Advanced

The hub supports future root-level setting rows, but none are shown initially.

## Category pages

Use one generic category page container rendered from category metadata. The title chrome changes to the current category title; the eyebrow remains `Settings` on category pages.

### Keyboard

- Group bind rows into Movement, Actions, System.
- Show all current binds.
- Activating a row listens for a new key and replaces that action with a single bind.
- Escape cancels listening.
- Duplicate keybinds are blocked with a page status and row error styling.
- Reset Keyboard Defaults applies immediately without confirmation.

### Controller

- Controller Input is an On/Off setting row.
- Passive diagnostics are visible without Developer Mode:
  - Detected Controller
  - Pressed Inputs
- Group bind rows like Keyboard.
- Activating a row listens for a controller input and replaces that action with a single bind.
- Controller Back/B cancels listening.
- Duplicate controller binds are blocked.
- Reset Controller Defaults applies immediately without confirmation.

### Accessibility

- Motion Effects is a cycle row: System → On → Off.
- Helper/status explains the effective motion state.

### Advanced

- Advanced remains visible as the last category.
- Developer Mode is an On/Off row.
- Raw settings JSON/debug tools stay hidden unless Developer Mode is on.
- Replace app settings keeps confirmation.

## Implementation notes

- Add `src/settings-ui.js` for settings category metadata and renderers.
- Keep `src/settings.js` as persistence/normalization.
- Keep duplicate bind detection in `src/input.js`.
- Use semantic `data-*` selectors for categories, setting rows, bind rows, and actions.
- Interactive rows are real `<button>` elements; passive info rows are non-focusable.
- Use hybrid CSS: reusable `ds-*` row/section primitives plus settings-specific layout hooks.
- Preserve current View Transition/motion preference behavior.

## Tests

Update Playwright coverage for:

- Settings hub categories and order.
- Category Back and root Back flow from Start/Pause.
- Motion cycle persistence.
- Keyboard grouped bind rows, row-click replacement, duplicate warning.
- Controller On/Off row and diagnostics visibility without Developer Mode.
- Advanced Developer Mode gating and JSON replace behavior.
