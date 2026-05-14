---
title: Rendering patterns
---

# Rendering patterns

The current renderer is packetized:

```txt
extractors -> RenderFrame packets -> native-frame backend -> presentation backend
```

Generic packet/frame primitives live under `src/engine/render`. Game/browser extraction, asset resolution, native-frame backends, presentation, and snapshots live under `src/render`.

## Asset rule

Render packets reference stable asset IDs, not raw image objects. Browser compatibility images and metadata are resolved through `src/render/assets/**`, currently rooted at `src/render/assets/browser-assets.js`.

For art-facing IDs and locations, update [`../asset-creator-source.md`](../asset-creator-source.md) whenever the registry changes.

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
- GPU/WebGL/WebGPU work must stay behind backend contracts and the parity gates in ADR 0009.
- New render features and implementation plans must reference ADR 0009's feature-entry rule: authored data/read-model extraction, explicit `RenderFrame` packet contract or metadata, Canvas2D reference unless explicitly optional GPU polish, backend capability declarations, and focused tests or documented downgrade behavior.
