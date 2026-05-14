# Source layout policy

`src/*.js` is entrypoint-only. Current allowed root entrypoints are:

- `src/main.game.js`
- `src/main.editor.js`

Do not add root compatibility shims or broad facade files. Place new code in the owning package below.

## Source packages

| Package | Owns | Notes |
| --- | --- | --- |
| `src/app/**` | Browser game composition, mutable app state, runtime adapters, settings persistence, gameplay shell UI, scenario launch glue, testing hooks. | May compose all layers, but pass smaller contexts where practical. |
| `src/core/**` | Pure platformer/domain rules: constants, gameplay session helpers, input domain, speedrun records, tilemap compiler/query/collision helpers. | No browser globals. Should not import app/content/editor/UI. |
| `src/engine/**` | Generic reusable primitives: runtime, scene stack, scene objects/components, render packet/frame primitives. | Keep browser-global free and game-agnostic. |
| `src/content/**` | Authored game content: campaigns, gyms, zoos, tilemaps, reusable objects, content-specific draft compilation. | Content may use core/engine primitives; avoid app/editor dependencies. |
| `src/catalog/**` | Scenario/category registries, scenario service, local-draft catalog integration. | Catalog reads content and core draft formats; it must not import editor UI/tool modules. |
| `src/render/**` | Game/browser render pipeline: asset registry, extractors, native-frame backends, presentation, map snapshots. | Backends consume render packets; extractors own game-specific read models. |
| `src/rendering/**` | Low-level Canvas2D drawing helpers that are not full render backends. | Example: pixel-perfect rect outlines for debug overlays. |
| `src/gpu/**` | GPU capability/support helpers and GPU-facing experiments. | Must stay behind render/presentation contracts. |
| `src/devtools/**` | Developer-only toolbox, debug UI registry, debug overlay helpers. | Gated by Developer Mode; keep out of core gameplay logic. |
| `src/editor/**` | Browser map editor shell, viewport/history, draft commands, import/export/preview/local-save tooling. | Editor is a separate browser product from gameplay UI. |
| `src/scenes/**` | Runtime scene DOM/render helpers still shared by app scene setup. | Prefer focused ownership when touching old shared scene/menu code. |
| `src/ui/**` | Shared UI primitives/helpers used by runtime/editor when proven reusable. | Do not make feature-specific UI depend on unrelated feature UI. |
| `src/assets/**` | Bundled game art imported by Vite/runtime modules. | Include source/license files for copied packs. |

Static browser-addressed assets live under `public/assets/**`.

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

## Dependency direction

- `engine` stays generic.
- `core` may depend on `engine`, but not browser/app/editor/content.
- `content` may depend on `core`/`engine`.
- `catalog` may depend on content/core, but not editor UI/tool modules.
- `app`, `editor`, `devtools`, and `render` are browser/runtime integration layers and may compose lower layers.
- Tests/tools may import concrete modules directly.

## Migration rules

- A module move is complete only when the old file is removed and all imports point at the new path.
- Prefer move plus logical split when a file mixes pure domain code and app/browser glue.
- Add JSDoc comments to seams that intentionally depend on app-layer state or browser globals.
- Do not migrate broad areas just for tidiness; move when it clarifies ownership, unblocks reuse, or removes stale compatibility.

## Current important seams

- `src/app/game-state.js` — mutable app composition root and legacy compatibility fields.
- `src/app/runtime/browser-runtime.js` — browser defaults over `src/engine/runtime.js`.
- `src/app/scenes/scene-host.js` — app adapter around the engine scene stack.
- `src/app/tilemaps/tilemap-manager.js` and `src/app/tilemaps/tilemap-preview.js` — runtime tilemap switch/restart and preview launch glue.
- `src/app/ui/menu/**`, `src/app/ui/settings/**`, `src/scenes/menu-dom.js` — current runtime menu/settings/browser UI seam.
- `src/app/testing/gym.js` — developer/test API exposed to Playwright.
- `src/core/tilemaps/tilemap.js` — compatibility facade over focused tilemap modules.
- `src/content/tilemaps/draft-compiler.js` — content mapping from Chibi editor drafts to runtime tilemaps.
- `src/catalog/local-drafts/**` — Level Select local draft integration without editor UI imports.
- `src/render/gameplay-render-pipeline.js`, `src/render/extractors/**`, `src/render/backends/**`, `src/render/presentation/**` — packetized rendering path.
- `src/render/assets/browser-assets.js` — browser asset compatibility map.
- `src/render/snapshot/map-snapshot.js` — full-map snapshot rendering entrypoint.
