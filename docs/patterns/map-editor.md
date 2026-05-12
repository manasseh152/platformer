# Map editor patterns

The browser map editor is a same-device content tool, not a gameplay scene. Keep it optimized for fast local iteration while preserving clear save semantics.

`src/editor/map-editor.js` is the browser shell: DOM wiring, canvas interactions, viewport/history orchestration, localStorage side effects, downloads, and popup opening. Reusable draft commands/status/payload decisions belong in focused editor modules such as `src/editor/map-editor-commands.js`.

## Shell layout

Use the canvas as the full-page background. Editor controls float above it:

- Header has three separate pieces: **Main menu** left, **Map/Edit/View** tabs centered, save state/action right.
- Default active tab is **Edit**. Do not persist the last active tab.
- Active tab content is a floating overlay over the canvas. It never pushes or resizes the canvas.
- Clicking the active tab toggles the overlay. Clicking another tab switches and shows that panel.
- The overlay has a visible hide control.
- On narrow screens, the overlay docks as a bottom sheet.

Do not reintroduce a permanent sidebar, permanent generated-source pane, or canvas chrome label.

## Action groups

Tabs are editor action groups:

- **Map**: registered map selection, metadata, dimensions, new/reload, local workflow, portability, generated source disclosure.
- **Edit**: layers, palettes, current palette item, and undo/redo.
- **View**: grid/collision toggles and viewport-control preferences.

There is no separate Export tab. Export/import/preview/source belong to **Map** because they operate on the draft as a whole.

## Save model

Local drafts are persisted under `chibi.tilemap-editor.*` and are the durable source for Level Select local maps.

Auto-save is an editor-local preference:

- Key: `chibi.tilemap-editor.auto-save`
- Default: on
- Scope: editor only, not `game.settings`

When auto-save is on, edits debounce to localStorage and the header save button acts as both status and manual flush.

When auto-save is off:

- Do not persist regular edits automatically.
- Mark the draft dirty.
- Save only via the header save button or `Ctrl/Cmd+S`.
- Warn before browser unload or Main menu navigation if dirty.

Save button states should communicate the current contract:

- `Saved`: clean, disabled/muted
- `Save now`: auto-save on with pending/dirty work
- `Save local`: auto-save off with dirty work
- `Saving…`: save in progress
- `Fix ID to save`: invalid draft id

Draft ids must be kebab-case before durable local save/export flows.

## Preview and portability

**Play preview** is temporary. It writes a short-lived payload under `chibi.tilemap-preview.*` and opens `/index.html?previewTilemapKey=...&autorun=1&mode=developer`.

Preview is separate from durable Local drafts. Use **Save local** for maps that should appear in Level Select.

Generated JavaScript source remains live-updated but hidden behind a disclosure in the Map panel. Avoid dedicating permanent screen space to source output.

## Edit domain

Use the editor language consistently:

- **Layer**: what kind of map content is being authored (`terrain`, `entities`, future `lights`/`decor`). Each layer owns its snap contract/grid size, which may be gridless later.
- **Palette**: a small controller-friendly collection of placeable items for one layer. Shoulder cycling changes the selected item within the active palette while the panel is hidden.
- **Palette item / brush**: the concrete symbol/material stamped into the active layer.

Keep layer/palette definitions in `src/editor/edit-domain.js`; the editor shell should render and route those concepts rather than hard-coding UI labels.

## View controls

Floating zoom controls are an editor-local preference:

- Key: `chibi.tilemap-editor.floating-controls`
- Default: on

The floating cluster owns zoom out, zoom readout, zoom in, reset, and pan toggle. The View panel owns only the preference/toggles and explanatory text.

Pan mode changes primary drag from paint to pan until turned off. Space-drag and middle-drag remain available.

## Keyboard

Required shortcuts:

- `Ctrl/Cmd+S`: save local
- `Ctrl/Cmd+Enter`: play preview
- `Ctrl/Cmd+Z`: undo
- `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y`: redo
- Arrow keys on focused tabs: move between Map/Edit/View tabs

## Testing

Cover editor behavior with Playwright through roles, labels, visible panels, localStorage effects, and URL/popup handoffs.

Keep tests for:

- default Edit tab
- tab switch and active-tab overlay toggle
- hidden generated source still updating
- auto-save on/off persistence behavior
- `Ctrl/Cmd+S` save
- `Ctrl/Cmd+Enter` preview
- floating controls preference
- import/export map payloads
