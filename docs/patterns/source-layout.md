# Source layout policy

`src/*.js` is entrypoint-only. Current allowed root entrypoints are:

- `src/main.game.js`
- `src/main.editor.js`

All other modules belong under structured folders:

- `src/app/**` — browser composition, mutable app state, DOM/UI wiring, app settings, testing hooks, browser runtime adapters.
- `src/core/**` — pure gameplay/domain rules and data normalization with no browser globals.
- `src/engine/**` — reusable primitives such as runtime, scene stack, scene objects, and render packets.
- `src/render/**` — rendering implementation, browser asset loading, render extractors, snapshots, and backends.
- `src/content/**` — authored levels, gyms, zoos, tilemap definitions, and asset metadata.

## Import style

Use two import styles:

1. Relative imports (`./`, `../`) within the same top-level source package.
2. `#/...` for imports that cross top-level package boundaries, and for source imports from tests/tools/root entrypoints.

Examples:

```js
// Inside src/core/tilemaps/** importing another core tilemap module.
import { terrainLayer } from './terrain-layer.js';

// App module importing pure core rules.
import { resetGameplaySession } from '#/core/gameplay-session.js';

// Test importing source.
import { createRuntime } from '#/app/runtime/browser-runtime.js';
```

Vite resolves `#/` to `src/`. Bun tests resolve it through `jsconfig.json` paths. Browser-evaluated tooling code may use Vite-served `/src/...` dynamic imports when running inside `page.evaluate()`.

## Migration rules

- Do not leave root compatibility re-export shims.
- A module move is complete only when the old root file is removed and all imports point at the new path.
- Prefer move plus logical split when a file mixes pure domain code and app/browser glue.
- Add JSDoc comments to seams that remain intentionally app-layer or browser-global dependent.

## Current migrated seams

- `src/app/game-state.js` — mutable game object composition/reset.
- `src/app/dom.js` — browser DOM lookup/bootstrap for the app UI contract.
- `src/app/runtime/browser-runtime.js` — browser defaults over `src/engine/runtime.js`.
- `src/app/scenes/scene-host.js` — app adapter around the engine scene stack.
- `src/app/tilemaps/tilemap-manager.js` — runtime tilemap switch/restart service.
- `src/app/tilemaps/tilemap-preview.js` — URL/session draft tilemap preview launch glue.
- `src/app/settings/settings.js` — app settings persistence and compatibility object mutation.
- `src/app/ui/settings/**` — settings rendering, navigation, and actions.
- `src/app/ui/menu/**` — menu input, setup/event wiring, and shell/chrome behavior.
- `src/app/ui/transitions.js` — motion preference and DOM transition helpers.
- `src/app/testing/gym.js` — developer/test API exposed to Playwright.
- `src/app/speedrun/speedrun.js` — speedrun app state and game-object glue.
- `src/core/speedrun/records.js` — pure speedrun records/categories/formatting.
- `src/render/assets/browser-assets.js` — browser `Image` asset map.
- `src/render/snapshot/map-snapshot.js` — map snapshot rendering entrypoint.
