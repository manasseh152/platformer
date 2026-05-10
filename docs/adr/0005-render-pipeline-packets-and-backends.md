# ADR 0005: Render pipeline packets and backends

- Status: Accepted
- Date: 2026-05-10

## Context

The renderer has several generations of implementation mixed together: gameplay rendering queries mutable game state directly, map snapshots reuse those drawing helpers, and presentation/upscaling is coupled to the old Canvas2D render canvas facade. We want the renderer to align with the ECS-ish scene model without forcing a full runtime ECS migration first.

The current visual contract remains important:

- native frame defaults to `320×180`
- gameplay camera/world view defaults to `640×360`
- presentation scales the native frame to the browser canvas

## Decision

Introduce a packet-based render pipeline:

```txt
render extraction -> RenderFrame packets -> NativeFrameBackend -> NativeFrameSource -> PresentationBackend
```

Generic packet/frame primitives live under `src/engine/render`. Browser/game-specific extraction, asset resolution, native-frame backends, and presentation adapters live under `src/render`.

Canvas2D is the first native-frame backend. WebGL/WebGPU may remain or return only when they fit the backend contracts cleanly. They must not own gameplay state, ECS state, camera policy, or packet extraction.

## Packet boundary

Extractors may read authored scene components and current gameplay session state. Backends consume finalized render packets only.

V1 packet vocabulary:

- `clear`
- `rect`
- `roundRect`
- `image`
- `path`
- `ellipse`
- `customCanvas` as temporary escape hatch only

Packets have `layer`, `order`, and insertion `sequence`; finalized frames are sorted by those keys and treated as read-only by backends.

Gameplay packets are emitted in native-frame coordinates after a `RenderView` preparation step handles camera shake, camera snapping, and world-to-native scale. Full-map snapshot extraction uses the same packet format/backend with a different, full-world view.

## Assets

Packets reference stable namespaced asset IDs, not raw image objects. A compatibility asset registry maps those IDs to the current `assets.js` images. Future registries can map the same IDs to atlas/sprite/WebGPU resources.

Fallback drawing is a semantic extraction concern. Backends defensively skip unresolved or unloaded images.

## Presentation

Presentation uses integer scale when the canvas can fit the native frame. Below native size, gameplay uses soft-fit so the game remains visible. Tests/tools may opt into stricter policies later.

## Migration rule

`src/render.js` remains as a deprecated facade during migration. New code should import the new pipeline modules directly. Deprecated compatibility modules are marked with comments/JSDoc rather than runtime warnings or import-forbid tests in this pass.

## Acceptance criteria

- Gameplay continues to render through the facade while using the packet pipeline.
- Map snapshot rendering migrates to packet extraction/backend where straightforward.
- Existing build/tests/map-render validation pass.
- New focused tests cover viewport policy, frame sorting, render view conversion, and asset registry lookup.

## Migration passes

### Pass 1: Packet pipeline foundation

Status: **done**.

Completed in the first implementation pass:

- Added generic frame builder and render-view/viewport helpers under `src/engine/render`.
- Switched default presentation viewport policy to integer scaling with soft-fit below native size.
- Added a Canvas2D `NativeFrameBackend` that consumes finalized packets.
- Added stable namespaced asset IDs and a browser compatibility registry over `assets.js`.
- Added gameplay packet extraction for backdrop, tilemap visuals, goals, hazards, actors, particles, and debug overlays.
- Migrated gameplay rendering through `src/render/gameplay-render-pipeline.js` while keeping `src/render.js` as a deprecated facade.
- Migrated map snapshot rendering to the packet extractor/backend.
- Marked legacy direct Canvas2D world renderer as deprecated.
- Added focused tests for viewport scaling, frame sorting, render-view conversion, and asset lookup.

Validation at completion:

- `bun run build` passed.
- `bunx playwright test --project=chromium` passed.
- `bun run validate:map-render` rendered `.temp/full-map.png`; Vite also reported port `4174` already in use because an existing server was present.

### Pass 2: Presentation backend cleanup

Status: **done**.

Completed in the second implementation pass:

- Added concrete `PresentationBackend` modules for Canvas2D, WebGL, and WebGPU under `src/render/presentation`.
- Refactored `src/presenter.js` into a deprecated compatibility facade over explicit native-frame source presentation.
- Kept gameplay on Canvas2D native-frame rendering while presenting via `presentNativeFrame(nativeBackend.getSource())`.
- Moved the WebGPU presenter implementation behind the presentation backend contract and left the old GPU presenter path as a deprecated re-export.
- Added a native-frame debug affordance on the presenter facade via `setNativeFrameDebugVisible(true)`.
- Exposed presentation scale/letterbox offsets on the game canvas for browser smoke visibility.

Validation at completion:

- `bun run build` passed.
- Focused render pipeline and browser smoke tests passed with `bunx playwright test tests/render-pipeline.spec.js tests/game-smoke.spec.js --project=chromium`.
- Full Chromium Playwright suite had one unrelated map-editor timeout on first run; rerunning that test passed.
- `bun run validate:map-render` rendered `.temp/full-map.png`; Vite also reported port `4174` already in use because an existing server was present.

### Pass 3: Packet fidelity and legacy renderer deletion plan

Status: **done**.

Completed in the third implementation pass:

- Audited all `src/render.js` facade exports and removed the remaining legacy direct Canvas2D world-renderer forwards.
- Switched gameplay scene rendering to import `renderGameplayFrame` from `src/render/gameplay-render-pipeline.js` directly.
- Kept `src/render.js` as a deprecated facade that only forwards to new pipeline/HUD modules for compatibility.
- Deleted `src/render/world-renderer.js`; there is no production call path to the legacy renderer.
- Confirmed map snapshots already use packet extraction and the Canvas2D native-frame backend.
- Kept `customCanvas` documented as a deliberate temporary escape hatch for the v1 packet vocabulary; current extraction does not rely on it.
- Updated foundation-review docs and boundary coverage for the packetized renderer state.

Validation at completion:

- `bun run build` passed.
- `bunx playwright test --project=chromium` passed.
- `bun run validate:map-render` rendered `.temp/full-map.png`; Vite also reported port `4174` already in use because an existing server was present.

### Pass 4: Render extraction closer to ECS scene model

Status: **done**.

Completed in the fourth implementation pass:

- Added `src/render/extractors/gameplay-renderables.js` as a render-facing read-model adapter for authored scene state, runtime actors, transient effects, and debug bodies.
- Moved player/enemy visual extraction behind component-like runtime actor renderables instead of iterating mutable gameplay arrays directly in the main extractor.
- Moved dust/particle extraction behind transient effect renderables.
- Split gameplay extraction into explicit authored scene renderables, runtime actor renderables, and transient effect renderables sections.
- Kept simulation ownership unchanged and did not introduce browser/GPU handles into ECS or gameplay components.
- Removed the temporary `tilemap.devToolsFlags` mutation by passing debug render flags into authored scene packet extraction.
- Added focused coverage for the gameplay render read model separation.

Validation at completion:

- `bun run build` passed.
- `bunx playwright test --project=chromium` passed.
- `render_full_map_png` rendered `.temp/full-map.png` at `1152×512`; Vite also reported port `4174` already in use because an existing server was present.

### Pass 5: Asset atlas and sprite packet bridge

Status: **done**.

Completed in the fifth implementation pass:

- Extended the compatibility asset registry from direct image lookup to metadata lookup while preserving `assetId -> image` for Canvas2D consumers.
- Added atlas sprite metadata helpers with explicit sprite rect, padding, and extrusion defaults for future GPU sampling.
- Added `getMetadata`, `getSprite`, and `resolveDrawable` registry APIs so backends can resolve standalone images and atlas sprites behind the same asset ID.
- Kept existing `image` packets as the compatibility path and taught the Canvas2D backend to draw them from either standalone images or atlas rect metadata.
- Added Canvas2D support for optional `sprite` and `texturedQuad` packets behind the same drawable resolution path.
- Confirmed extractors remain asset-layout agnostic: they still emit stable asset IDs and do not know whether an asset is standalone or atlas-backed.
- Added focused coverage for atlas metadata lookup and Canvas2D atlas-rect drawing without requiring WebGPU.

Validation at completion:

- `bun run build` passed.
- `bunx playwright test tests/render-pipeline.spec.js --project=chromium` passed.
- Full Chromium Playwright suite had one unrelated map-editor timing failure; rerunning that test passed.
- `render_full_map_png` rendered `.temp/full-map.png` at `1152×512`; Vite also reported port `4174` already in use because an existing server was present.

### Pass 6: WebGPU/WebGL native backend experiment

Status: **done**.

Completed in the sixth implementation pass:

- Added `src/render/backends/webgl-native-frame-backend.js` as the first GPU native-frame backend behind the existing packet contract.
- Implemented the initial packet subset for the WebGL backend: `clear`, solid/stroked `rect`, and `image`/`sprite`/`texturedQuad` packets.
- Rendered GPU native frames into a fixed native-size WebGL canvas that exposes the same `NativeFrameSource` shape used by presentation backends.
- Reused the compatibility asset registry and atlas sprite metadata path so Canvas2D and WebGL consume the same finalized `RenderFrame` asset IDs.
- Added `ensureNativeFrameBackend(...)` to toggle Canvas2D/WebGL native-frame backends without changing extraction code, while keeping Canvas2D as the default fallback/reference backend.
- Isolated WebGL context loss/restoration and resource recreation inside the native backend.
- Added focused WebGL checkerboard/1px-line and atlas sprite drawing coverage before expanding GPU packet support.

Validation at completion:

- `bun run build` passed.
- `bunx playwright test tests/render-pipeline.spec.js --project=chromium` passed.
- `render_full_map_png` rendered `.temp/full-map.png` at `1152×512`; Vite also reported port `4174` already in use because an existing server was present.
