---
title: Developer toolbox patterns
---

# Developer toolbox patterns

## Goals

Developer tooling should be easy for gameplay, rendering, and test systems to register without creating one-off debug panels.

The toolbox is for developer/debug/testing UI only. Do not use it for player-facing settings or production HUD.

## Access and lifetime

Developer Mode gates the toolbox.

Rules:

- Developer Mode is enabled from Settings → Advanced.
- The toolbox is available only during active gameplay.
- The toolbox is hidden while paused, on start screens, and on end-state messages.
- Turning Developer Mode off closes and hides the toolbox immediately.
- Toolbox open state and tool flags are session-only unless a future pattern explicitly adds opt-in persistence.

Current controls:

- Backquote toggles the toolbox during eligible gameplay.
- The floating Dev button toggles the toolbox during eligible gameplay.
- Escape closes the toolbox only when focus is inside the toolbox.

## File boundaries

Developer toolbox implementation lives under `src/devtools`.

Current modules:

- `toolbox.js` — state, registry, validation, built-in registrations.
- `toolbox-dom.js` — DOM shell, rendering, focus behavior, button/panel events.

Keep core gameplay modules free of DOM/debug UI concerns. Systems should register toolbox sections/items through the devtools registry instead of importing DOM helpers.

## Registry model

Register sections through `game.devTools.registry.registerSection(...)`.

Example:

```js
game.devTools.registry.registerSection({
  id: 'physics',
  title: 'Physics',
  order: 100,
  items: [
    {
      id: 'show-collision',
      kind: 'toggle',
      label: 'Show Collision',
      get: game => Boolean(game.devTools.flags.showCollision),
      set: (game, value) => { game.devTools.flags.showCollision = value; }
    }
  ]
});
```

Supported first-pass item kinds:

- `toggle` — requires `get(game)` and `set(game, value)`.
- `button` — requires `run(game, runtime)`.
- `value` — requires `get(game)`.

Do not add custom-render item types until repeated real tools prove the primitive set is insufficient.

## Ordering and duplicates

Sections and items may provide numeric `order` values.

Sort rules:

1. `order` when present.
2. registration order fallback.
3. title/label tie-breaker for stable output.

Duplicate section IDs merge so multiple systems can contribute to shared sections like `physics`, `entities`, or `render`.

Duplicate item IDs inside a merged section throw immediately. Item IDs are scoped to their section, e.g. `physics.show-collision`.

## Built-in section

The toolbox includes a small built-in `Session` section to prove value rendering and provide useful context.

Current values:

- Tilemap
- Scenario
- Player position

Values refresh on a throttled interval while the toolbox is open. Prefer updating existing value elements over rebuilding the whole panel every frame.

## Canvas/debug overlays

Debug drawing should be registered as toolbox state first, then rendered by normal render code.

Recommended shape:

- A system registers a toggle item.
- The toggle writes to `game.devTools.flags` or another session-only devtools namespace.
- The renderer reads that flag and calls a focused debug draw helper.

For world-space overlays such as AABB collision boxes, draw inside the game canvas while the world camera transform is active. Use `drawPixelRect` from `src/rendering/pixel-outline.js` for crisp rect fills/outlines instead of raw `strokeRect`. Add DOM or overlay-canvas inspection only when mouse/selection tools need it.

Current terrain/physics overlays:

| Toggle | Meaning |
| --- | --- |
| Show terrain cells | 16px `terrainLayer()` cells used for contained-autotile visuals |
| Show collision cells | 8px derived terrain primitives |
| Show collision rects | greedy-merged terrain collision rects used by physics queries |
| Show physics body rects | runtime actor body AABBs |

Visual terrain debugging should be additive so artists/developers can compare visuals, collision primitives, merged rects, and actor bodies independently.

## Automation and playbooks

Developer automation should build on the existing gated `window.__gym` API.

Current rule:

- `window.__gym.snapshot().devTools` may expose read-only toolbox state and registered metadata.
- `window.__gym.snapshot().gym` may expose read-only gym machine state for in-engine validation scenarios.
- Do not add mutation APIs such as `open()`, `toggleItem()`, `runButton()`, or machine control methods without a separate design decision.

Playwright tests should prefer real UI interactions for UX behavior. Gym CI should prefer loading an auto-start gym and polling read-only machine state. Use the snapshot for assertions and future playbook context, not as the primary control surface.

## Testing requirements

When changing toolbox primitives, add or update tests for both contracts:

- registry/DX behavior, e.g. ordering, merges, duplicate detection, item validation.
- browser UX behavior, e.g. Developer Mode gating, open/close controls, focus behavior, gameplay-only visibility.

Use Playwright for visible toolbox behavior.
