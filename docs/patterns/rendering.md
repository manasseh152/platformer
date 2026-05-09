# Rendering patterns

## Pixel-perfect rect outlines

Use `drawPixelRect` from `src/rendering/pixel-outline.js` for crisp world-space rectangle fills and outlines.

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

## Current v1 usage

V1 uses `drawPixelRect` for developer/debug overlays:

- authored terrain cells
- collision cells
- greedy-merged collision rects
- runtime physics body rects

## Known future candidates

These are known reuse sites but are not migrated in v1:

- selectable/interactable outlines
- authored `render:outline` or visual outline components, if repeated usage proves useful
- terrain tile debug strokes
- raw terrain debug strokes
- `DEBUG_CAMERA` camera/deadzone rects
- sprite/silhouette outlines

Sprite and silhouette outlines need a separate algorithm based on alpha masks, offscreen canvas, or shaders. Do not force them through the rect helper.

## Boundaries

- Canvas 2D helper for now; no renderer abstraction in v1.
- Generic rendering utility; no devtools dependency.
- Rect-only v1; no scene component in v1.
- Keep color/style presets near the feature using them, not in `pixel-outline.js`.
