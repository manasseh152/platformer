---
title: Rendering patterns
---

# Rendering patterns

The current renderer is packetized:

```txt
extractors -> RenderFrame packets -> native-frame backend -> presentation backend
```

Generic packet/frame primitives live under `src/engine/render`. Game/browser extraction, asset resolution, native-frame backends, presentation, and snapshots live under `src/render`.

## Pipeline ownership

The active gameplay render path is:

```txt
gameplay scene
  -> renderGameplayFrame
  -> gameplay render read model / packet extraction
  -> finalized RenderFrame
  -> Canvas2D or WebGL NativeFrameBackend
  -> NativeFrameSource
  -> Canvas2D/WebGL/WebGPU PresentationBackend
  -> browser canvas
```

Map snapshots use the same packet/backend family through `extractTilemapSnapshotRenderFrame`, not a separate gameplay renderer.

Presentation composition lives under `src/app/presentation/**`. App code owns browser lifecycle, settings, resize integration, and canvas attachment; render backends remain under `src/render/**`.

## Packet boundary

Extractors may read authored scene components and current gameplay session state. Backends consume finalized render packets only.

Packets have `layer`, `order`, and insertion `sequence`; finalized frames are sorted by those keys and treated as read-only by backends.

Gameplay packets are emitted in native-frame coordinates after render-view preparation handles camera shake, camera snapping, and world-to-native scale. Full-map snapshot extraction uses the same packet format/backend with a full-world view.

Backends must not own gameplay state, ECS state, camera policy, or packet extraction.

## Native frame and presentation

The native frame defaults to `320×180`. The gameplay camera/world view defaults to `640×360`. Presentation scales the native frame to the browser canvas.

Presentation uses integer scale when the canvas can fit the native frame. Below native size, gameplay uses soft-fit so the game remains visible. Tests/tools may opt into stricter policies later.

Canvas2D is the reference native-frame backend. WebGL/WebGPU paths may be used only behind backend contracts, capability checks, and parity gates.

## Backend maturity and parity gates

Backend selection is capability-driven. A backend may be requested by settings or devtools, but the pipeline must select, degrade, or fall back based on the finalized frame's packet requirements and the backend's declared support.

Backend maturity tiers:

- **Reference**: supports accepted gameplay/tooling packet vocabulary and acts as the correctness oracle. Current reference: Canvas2D native-frame backend.
- **Experimental**: supports only a packet subset or compatibility paths. It may be manually requested, but unsupported required packets must fall back or degrade with diagnostics instead of being omitted.
- **Accelerated**: may be selected automatically for frames it fully supports after representative parity coverage, context-loss handling, resize behavior, asset loading, and fallback paths are proven.
- **Specialized**: implements a specific rendering mode or pass structure, such as WebGL2 deferred lighting. It declares required frame features and consumed packet/features, but is not a general reference replacement.

New visual features must enter through the established pipeline:

1. authored scene/component data when applicable
2. render read-model extraction
3. explicit `RenderFrame` packet contract or packet metadata
4. Canvas2D reference implementation unless the feature is explicitly GPU-only optional polish
5. backend capability declarations
6. focused tests or documented fallback/degrade behavior

New visual behavior must not directly query mutable gameplay state from a backend, store browser/GPU handles in gameplay components, or add backend-only draw paths that bypass packet extraction.

Native-frame backends must expose capability information for selection and diagnostics. Capability checks answer whether a finalized frame is supported, not merely whether a backend exists. Unsupported frames return structured issues that can be surfaced in render diagnostics and devtools.

Fallback or degradation is mandatory when a requested backend cannot faithfully render required visuals for a finalized frame. Diagnostics should record requested backend, candidate backend, actual backend, fallback/degrade occurrence, and structured fallback issues.

Rules:

- Canvas2D is the fallback for non-specialized native-frame rendering.
- Forward WebGL/native unsupported required packet features cause fallback to Canvas2D, not omission.
- Deferred rendering falls back to unlit Canvas2D when WebGL2 deferred rendering is unavailable or unsupported for the frame as a whole.
- Specialized deferred unsupported lit G-buffer participation may render forward/unlit with diagnostics, as documented by the lighting rules.
- Player-facing gameplay should not show technical warnings by default; devtools/diagnostics should expose plain-language fallback text.

A GPU backend can become automatic/default only when representative gameplay frames have capability declarations, fallback/degrade tests, parity coverage where the feature is not GPU-only polish, context-loss handling, resize/native-frame source behavior, asset loading coverage, and accurate diagnostics.

Pixel-exact parity is not required for every antialiased/vector edge, but gameplay-relevant visual semantics must match. CI should always run Canvas2D/reference and packet/diagnostics tests. GPU tests should be capability-gated and skip with explicit reasons when unavailable.

## Asset rule

Render packets reference stable asset IDs, not raw image objects. Browser compatibility images and metadata are resolved through `src/render/assets/**`, currently rooted at `src/render/assets/browser-assets.js`.

For art-facing IDs and locations, update [`../asset-creator-source.md`](../asset-creator-source.md) whenever the registry changes.

## 2D lighting

Lighting extends the packet pipeline instead of bypassing it:

```txt
authored prefab/component
  -> gameplay render read model light renderable
  -> RenderFrame packet kind: light2d
  -> WebGL2 deferred native-frame backend
```

V1 lighting supports ambient lights, point lights, default ambient injection, and deferred treatment for supported opaque lit surfaces. It intentionally does not include shadows, normal/specular/height/material channels, cone/sun/moon lights, layered/parallax lighting, HDR/bloom, or arbitrary Map Editor light authoring.

Default ambient rules:

- Extraction always emits at least one ambient `light2d` packet.
- If no authored ambient exists, emit default white ambient.
- If one or more authored ambient lights exist, emit authored ambients only; they replace the default.
- A completely dark scene is authored with ambient intensity `0` and point lights.

Lighting metadata uses:

- `lighting: 'lit'` for packets eligible for the deferred G-buffer.
- `lighting: 'unlit'` for packets drawn forward and unaffected by v1 deferred lights.
- `lighting: 'light'` for light primitive/instruction packets.

Canvas2D ignores lighting metadata. Deferred backends use it for pass grouping. Unsupported lit packet kinds in deferred mode may be drawn forward/unlit with diagnostics instead of forcing whole-frame fallback when that downgrade is documented. Semi-transparent deferred blending is out of scope for v1.

Deferred rendering is content-driven, but default ambient alone does not activate it. If a frame has authored ambient or point lights, the pipeline may try the WebGL2 deferred backend; if unavailable, it renders unlit through the existing fallback and records a diagnostic reason.

## Pixel-perfect rect outlines

Use `drawPixelRect` from `src/rendering/pixel-outline.js` for crisp world-space rectangle fills and outlines in Canvas2D/debug contexts.

`drawPixelRect` normalizes rect edges to native pixels by default, then draws outlines with integer `fillRect` bands instead of `strokeRect`. This avoids blurry half-pixel strokes on moving objects and camera transforms.

Default behavior:

- accepts one rect or an array of rects
- validates `{ x, y, w, h }` and no-ops invalid or zero-size rects
- snaps by rounding rect edges: left/top/right/bottom
- fills the snapped original rect when `fill` is provided
- draws the outline after fill when `outline` is provided
- uses `placement: 'inside'` by default
- supports `placement: 'outside'` for selection/highlight affordances
- owns canvas `save()` / `restore()` for style safety

Example:

```js
import { drawPixelRect } from '../rendering/pixel-outline.js';

drawPixelRect(ctx, object.transform, {
  outline: '#fff6a8',
  thickness: 2,
  placement: 'outside'
});
```

For custom composition or tests, use `normalizePixelRect(rect)`. Pass `snap: false` to `drawPixelRect` only when the caller has already intentionally normalized the rect.

## Current rect-helper usage

`drawPixelRect` is used for developer/debug overlays:

- authored terrain cells
- collision cells
- greedy-merged collision rects
- runtime physics body rects

## Boundaries

- Gameplay visuals should go through render extraction and packets, not ad-hoc canvas drawing.
- Debug Canvas2D helpers such as `drawPixelRect` remain allowed near developer overlay code.
- Keep color/style presets near the feature using them, not in `pixel-outline.js`.
- Sprite/silhouette outlines need a separate algorithm based on alpha masks, offscreen canvas, or shaders. Do not force them through the rect helper.
- GPU/WebGL/WebGPU work must stay behind backend contracts and the parity gates in ADR 0010.
- New render features and implementation plans must reference ADR 0010's feature-entry rule: authored data/read-model extraction, explicit `RenderFrame` packet contract or metadata, Canvas2D reference unless explicitly optional GPU polish, backend capability declarations, and focused tests or documented downgrade behavior.
