---
title: Map editor patterns
---

# Map editor patterns

Shared domain language lives in [`../../CONTEXT.md`](../../CONTEXT.md). The **Map Editor** is a same-device browser content tool for authoring **Tilemaps** and saving **Local Drafts**; it is not a gameplay scene.

Keep it optimized for fast local iteration while preserving clear save semantics.

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
- **Edit**: layers, packs, current pack item, and undo/redo.
- **View**: grid/collision toggles and viewport-control preferences.

There is no separate Export tab. Export/import/preview/source belong to **Map** because they operate on the draft as a whole.

## Save model

**Local Drafts** are persisted under `chibi.tilemap-editor.*` and are the durable source for local scenarios shown in Level Select.

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

**Play Preview** is temporary. It writes a short-lived payload under `chibi.tilemap-preview.*` and opens `/index.html?previewTilemapKey=...&autorun=1&mode=developer`.

Play Preview starts a temporary gameplay session without creating a durable scenario. Use **Save local** to create or update a **Local Draft** that should appear as a local scenario in Level Select.

Generated JavaScript source remains live-updated but hidden behind a disclosure in the Map panel. Avoid dedicating permanent screen space to source output.

## Edit domain

Use the editor language consistently and avoid “level editor” terminology:

- **Layer**: what kind of map content is being authored (`terrain`, `entities`, future `lights`/`decor`). Each layer owns its snap contract/grid size, which may be gridless later.
- **Asset pack / pack**: a controller-friendly collection of placeable items. The current implementation has one `Starter` asset pack; the active layer filters which pack items are shown. Shoulder cycling changes the selected item within the active layer's active pack while the panel is hidden.
- **Brush**: the selected tile, marker, or asset stamped into the active layer.
- **Brush Palette**: the picker for browsing, previewing, and selecting brushes.

Keep layer/pack definitions in `src/editor/edit-domain.js`; the editor shell should render and route those concepts rather than hard-coding UI labels.

## Brush Palette

The Brush Palette is the Map Editor picker for browsing, previewing, and selecting brushes. It is a general editor concept with controller-first interaction, not a controller-only domain term.

Controller behavior:

- Full editor panel open + `B` closes the panel.
- Canvas + palette closed + `B` opens the Brush Palette.
- Palette open + `B` cancels/closes without changing the committed brush.
- Palette open + `A` commits the highlighted brush and closes the palette.
- Palette open + `Y` cancels/closes the palette and opens or shows the full editor panel.
- Palette open owns controller input; canvas cursor movement, painting, zoom/reset, and draw/pan toggling are paused.
- `LB/RB` quick-cycle brushes when the palette is closed and move previous/next while it is open.
- D-pad/stick navigation wraps through the visible brush list.

The highlighted brush is preview-only until confirmed. Keep cancel semantics true: closing with `B` must preserve the previously committed brush.

Presentation:

- Reuse the existing pack wheel visual language for both passive HUD and interactive palette states.
- When closed, the passive HUD may wake after brush or zoom changes and fade by timeout.
- When open, the interactive palette stays visible until committed or cancelled.
- Palette settings live with controller cursor/editor preferences; there is no enable/disable setting.
- Future multi-pack support should add a pack-picking layer above brush selection rather than changing the Brush Palette confirmation contract.

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
