# ADR 0008: Layered menu navigation and reusable UI primitives

- Status: Accepted
- Date: 2026-05-13

## Context

The Settings UI already uses direct category tabs and shared design-system classes, but several interactions are still mouse/touch-first:

- primary Settings tabs can be clicked and partially switched with shoulder actions, but are excluded from generic focus navigation;
- Controls nested tabs are click-only;
- Settings content rows are navigable, but tab rails and nested tab rails are not modeled as first-class controller/keyboard navigation layers;
- reusable markup helpers for tabs, sections, rows, and keybinds live inline in `src/app/ui/settings/settings-view.js` instead of as app-wide primitives;
- future pages such as Scenario Browser, editor overlays, and other menus need the same primitives and navigation rules.

The project already has semantic menu input actions (`menu.navigateX`, `menu.navigateY`, `menu.accept`, `menu.back`, `menu.previousTab`, `menu.nextTab`). Browser `Tab` must remain native and must not be hijacked. Mobile/browser native back integration is desirable, but it should apply across game and editor rather than being bolted onto Settings only.

## Decision

Introduce layered semantic navigation for Settings first, then extract app-wide UI primitives and redesign the visuals in later slices.

Settings navigation will use explicit transient menu state rather than inferring intent only from `document.activeElement`:

```js
game.menu.settingsFocusLayer = 'primary-tabs' | 'nested-tabs' | 'content';
```

Layer behavior:

- opening Settings starts in `primary-tabs`;
- categories without nested tabs use `primary-tabs -> content`;
- Controls uses `primary-tabs -> nested-tabs -> content`;
- `menu.back` climbs one layer at a time before closing Settings;
- bind-listening remains a special case where `menu.back` cancels listening first;
- `menu.previousTab` / `menu.nextTab` switch primary Settings categories from any layer;
- switching primary category resets `settingsFocusLayer` to `primary-tabs`;
- Controls nested tab selection is preserved during the current Settings session, but reset to Profiles when Settings opens fresh;
- mouse/touch click behavior remains supported;
- all controller/keyboard behavior uses semantic actions, not raw keys/buttons.

Tabs should become reusable app-wide primitives with proper accessibility semantics:

- `role="tablist"`, `role="tab"`, `aria-selected`, and `role="tabpanel"`;
- roving `tabindex` for tab buttons;
- programmatic focus is allowed for controller/semantic navigation;
- browser `Tab` remains native.

Visual focus should distinguish selected state, focused element, and active layer:

- `aria-selected="true"` marks selected tab/page;
- `.controller-focus` / `:focus-visible` marks the focused control;
- a parent data attribute, for example `data-settings-focus-layer`, marks the active navigation layer for styling.

Reusable primitives should be app-wide and design-system-oriented, not settings-specific:

- tabs: `.ds-tabs`, `.ds-tabs--primary`, `.ds-tabs--nested`, `.ds-tab`, `.ds-tab-panel`;
- settings/content primitives: `.ds-section`, `.ds-setting-row`, `.ds-action-row`, status rows, keybind rows;
- Settings-specific code should adapt these primitives with Settings data attributes and handlers.

Native browser/mobile back is deferred to an app-wide navigation pass covering both game and editor.

## Implementation slices

### Slice 1: Settings layered navigation tracer bullet

Status: Implemented.

- Add transient `game.menu.settingsFocusLayer`.
- Reset focus layer and Controls nested page appropriately when opening Settings.
- Implement semantic layer transitions for Settings:
  - `menu.navigateX` switches tabs within the active tab layer or moves within horizontal action groups;
  - `menu.navigateY` enters/leaves content according to the active layer;
  - `menu.accept` activates the focused tab/row or enters the next layer;
  - `menu.back` climbs `content -> nested-tabs -> primary-tabs -> close Settings`;
  - `menu.previousTab` / `menu.nextTab` switch primary Settings categories globally.
- Make primary Settings tabs and Controls nested tabs navigable by the semantic focus system.
- Preserve mouse/touch behavior and existing data attributes.
- Add Playwright coverage for keyboard semantic navigation and a controller smoke test.

### Slice 2: Extract app-wide render primitives

Status: Implemented.

- Add reusable tab rendering helpers under app-wide UI/component paths.
- Add reusable section, row, status, action-row, and keybind-row helpers.
- Convert Settings to consume these primitives without changing behavior.
- Keep stable selectors and roles expected by existing tests.

### Slice 3: Visual redesign of Settings

Status: Implemented.

- Redesign Settings using the new primitives and layer state.
- Make active navigation layer, focus, and selected tab visually distinct.
- Improve density, spacing, typography, controller affordances, and keybind readability.
- Respect the existing motion setting and reduced-motion behavior.

### Slice 4: Reuse primitives outside Settings

Status: Implemented.

- Scenario Browser now renders its category tab rail with the shared tab primitive while preserving level-select-specific data attributes, copy, and tab persistence.
- Scenario Browser panels now use the shared tab-panel primitive.
- Scenario rows, local draft rows, and campaign/developer sections now use shared row/section primitives where the app-wide shape fits; bespoke local toolbar markup remains page-owned.
- Scene/page adapters remain responsible for Scenario Browser state, grouping, local draft actions, and user-facing copy.

### Slice 5: App-wide native/browser back integration

Status: Deferred.

- Design a shared browser-history/native-back adapter for game and editor.
- Route native back through the same semantic navigation stack used by controller/keyboard back.
- Avoid trapping users in synthetic history loops.
- Do not add Settings-only browser back behavior before the app-wide model exists.

## Consequences

- Settings becomes controller/keyboard navigable without sacrificing browser-native `Tab` behavior.
- Navigation state is explicit and testable rather than inferred from DOM focus alone.
- UI primitives can be reused by future pages and editor overlays.
- The first slice can be implemented and tested without committing to final visual design.
- Browser/mobile back remains out of scope until a whole-app navigation model is designed.
