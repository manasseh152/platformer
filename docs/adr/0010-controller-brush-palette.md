# ADR 0010: Controller brush palette for the map editor

- Status: Accepted
- Date: 2026-05-14

## Context

The map editor already supports controller-first editing, but brush selection is split across two different interaction styles:

- the full editor panel exposes layer and brush buttons;
- when the panel is hidden, `LB/RB` quick-cycle the brushes in the active pack;
- the bottom-right `packWheelHud` is a passive HUD that wakes after brush or zoom changes;
- `A` paints, D-pad/stick moves the cursor or pans depending on controller canvas mode, `Y` toggles the full editor panel, and `B / Circle` acts as panel back/cancel.

This works for quick cycling, but it does not provide a controller-native browse-and-confirm picker. It also does not create a clear path to future multi-pack selection, where the picker can gain another layer for choosing packs while preserving `LB/RB` as quick cycling inside the active/selected pack.

The goal is not to replace the existing panel or quick shortcuts. The goal is to refactor the existing passive pack wheel into an interactive controller-only brush palette, with settings for where and how large that picker appears.

## Decision

Add an always-available controller brush picker opened from the canvas with `B / Circle` (`menu.back`, gamepad button index 1). The picker is controller-only behavior; mouse/touch/keyboard panel selection remains supported.

### Controller state machine

Initial implementation is brush-only for the current active pack:

- Full editor panel open + `B` closes the panel, preserving current back behavior.
- Canvas + picker closed + `B` opens the brush picker.
- Picker open + `B` cancels/closes without changing the committed brush.
- Picker open + `A` commits the highlighted brush and closes the picker.
- Picker open + `Y` cancels/closes the picker and opens/shows the full editor panel.
- Picker open owns controller input; canvas cursor movement, painting, zoom/reset, and draw/pan mode toggling are paused.
- `LB/RB` remain quick previous/next brush shortcuts when the picker is closed.
- While the picker is open, both D-pad/stick and `LB/RB` move the highlighted item.
- Navigation wraps around the brush list.
- Right/down mean next; left/up mean previous.
- Holding D-pad/stick repeats picker navigation after an initial delay, using the controller brush repeat timing but not momentum acceleration.

The picker starts highlighted on the current committed brush. Moving the highlight previews the item in the picker only; it does not change the actual `brush`, cursor color, or paint behavior until `A` confirms. This gives `B` true cancel semantics.

### Pack model

This ADR intentionally keeps the first picker implementation scoped to `brushesForActivePack()`.

Future multi-pack support should add another picker layer rather than changing this contract:

```txt
canvas -> B -> brush picker
brush picker -> future B/layer action -> pack picker
pack picker -> choose pack -> brush picker for selected/active pack
```

`LB/RB` continue to cycle brushes in the active/selected pack in both the current and future models.

### Picker presentation

Reuse and extend the existing `packWheelHud` visual language rather than introducing an unrelated list. The picker remains a wheel/ring concept with:

- tiny short labels on visible item badges;
- a card showing the highlighted item label and active pack label;
- selected/highlighted item styling independent from the committed brush while the picker is open.

The passive HUD remains when the picker is closed:

- in gamepad mode, the passive HUD remains bottom-right as today;
- it wakes on brush/zoom changes and fades by timeout;
- interactive picker-open state keeps the wheel fully visible until closed.

The interactive picker has controller-only presentation settings. There is no enable/disable setting.

Settings live inside the existing **Controller cursor** disclosure in the Edit panel:

- **Palette position**: `Near cursor` or `Bottom-right`.
- **Cursor palette size**: `Compact`, `Normal`, or `Large`.
- **Bottom-right palette size**: `Compact`, `Normal`, or `Large`.

Defaults:

- palette position: `Bottom-right`;
- cursor palette size: `Compact`;
- bottom-right palette size: `Normal`.

Settings persist with the existing `chibi.tilemap-editor.controller-brush` settings object. Changing settings takes effect immediately, including if the picker is currently open.

### Cursor anchoring

For `Near cursor` mode:

- anchor the picker to the active brush cell center, using `brush.cellSize`;
- use the controller `pointer` in draw mode;
- use the ghost/center indicator as appropriate in navigate mode;
- convert the world cell center to screen/workspace coordinates;
- center the picker at that point, then clamp the picker box inside visible canvas/workspace bounds with padding so it does not clip offscreen;
- keep the canvas cursor/indicator visible underneath the picker.

For `Bottom-right` mode:

- use the existing bottom-right HUD placement pattern;
- apply the bottom-right size setting while interactive;
- preserve passive HUD bottom-right behavior when the picker is closed, even if the interactive picker position setting is `Near cursor`.

### Back and hints

The editor native/browser back adapter treats picker-open as a backable state:

- picker open -> native/browser back closes picker;
- full panel open -> native/browser back closes panel;
- canvas with picker closed and panel closed -> no editor-specific back action.

Controller hints switch while picker is open:

- D-pad/stick: choose item;
- `A`: select;
- `B`: cancel;
- `LB/RB`: previous/next;
- canvas paint/zoom/reset/draw-pan hints are hidden or deprioritized while picker owns input.

## Consequences

- The controller editing loop gains a true browse-and-confirm brush picker without removing expert shortcuts.
- `B / Circle` becomes context-sensitive in the editor: panel back when panel is open, picker toggle/cancel on canvas/picker.
- Passive HUD and interactive picker share visual infrastructure but have distinct behavior.
- Future multi-pack support has a clear extension point: add a pack-picker layer above the brush picker.
- Tests should cover controller picker behavior and settings persistence at the Playwright/editor behavior level where practical.

## Implementation slices

### Slice 1: Brush picker state machine tracer bullet

Status: Implemented in `2c21652`.

- Add editor state for picker open/closed and highlighted brush index.
- Open picker from canvas with `menu.back`/`B` when the full panel is closed.
- Close/cancel picker with `B` without changing the committed brush.
- Commit highlighted brush with `A`, then close picker.
- Keep `Y` panel toggle behavior, but cancel the picker before showing the panel.
- Pause canvas painting, cursor movement, zoom/reset, and draw/pan toggling while picker is open.
- Keep existing `LB/RB` quick cycling while picker is closed.
- Expose debug/state hooks only if needed for tests.

### Slice 2: Picker navigation and selection semantics

Status: Implemented in `2c21652`.

- Initialize picker highlight from the current brush.
- Let D-pad/stick move the highlighted item in active-pack order.
- Let `LB/RB` move previous/next while the picker is open.
- Wrap selection at list boundaries.
- Add held-direction repeat using controller brush repeat timing without momentum.
- Keep navigation as preview-only until `A` confirms.
- Support one-item packs consistently.

### Slice 3: Interactive wheel rendering

Status: Implemented in `2c21652` as the minimal interactive wheel pass.

- Extend `packWheelHud` to support an interactive open state.
- Render wheel items from `brushesForActivePack()` in the same order as panel buttons and quick cycling.
- Distinguish committed brush from highlighted picker item while open.
- Update the card to show highlighted item details while the picker is open.
- Keep passive HUD behavior and timeout when picker is closed.
- Keep picker fully visible while open.

### Slice 4: Controller-only picker placement and size settings

Status: Implemented in `89f4d9d`.

- Add Controller cursor controls for palette position and separate cursor/bottom-right size.
- Persist settings in `chibi.tilemap-editor.controller-brush`.
- Defaults: bottom-right position, compact cursor picker, normal bottom-right picker.
- Apply settings immediately.
- Add CSS/data attributes or CSS variables for compact/normal/large sizing.
- Ensure no disable setting is introduced.

### Slice 5: Cursor-anchored placement

Status: Implemented in `89f4d9d`.

- Compute the brush cell center in world coordinates from the controller cursor/indicator.
- Convert the anchor to screen/workspace coordinates.
- Position the picker centered on the anchor.
- Clamp the picker inside the visible canvas/workspace with padding.
- Keep the cursor/indicator visible underneath.
- Preserve passive HUD as bottom-right when picker is closed.

### Slice 6: Native back and controller hints

Status: Implemented in `cceea95`.

- Include picker-open in the editor native/browser back adapter.
- Back closes picker before any panel behavior.
- Add picker-specific hint mode for choose/select/cancel/previous/next.
- Hide or deprioritize canvas hints while picker owns controller input.

### Slice 7: Tests and regression coverage

Status: Implemented across `2c21652`, `89f4d9d`, and `cceea95` for the scoped controller brush picker behavior.

- Extend editor Playwright tests where practical.
- Cover `B` opening picker from canvas.
- Cover D-pad/stick or `LB/RB` moving highlight without changing committed brush.
- Cover `A` commit and auto-close.
- Cover `B` cancel without brush change.
- Cover settings persistence for position and both size options.
- Cover native/browser back closing picker if the existing test harness can exercise it reliably.

### Slice 8: Future multi-pack picker layer

Status: Deferred.

- Add multiple selectable packs to the editor domain/UI.
- Add a picker layer for choosing packs.
- Define exact transition from brush picker to pack picker, likely using `B` again while picker is open or an equivalent semantic layer action.
- Keep `LB/RB` scoped to cycling brushes within the active/selected pack.
- Preserve current brush-picker confirm/cancel semantics.
