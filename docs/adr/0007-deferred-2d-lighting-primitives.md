# ADR 0007: Deferred 2D lighting primitives

- Status: Accepted
- Date: 2026-05-12

## Context

We want a 2D deferred lighting system inspired by the referenced deferred-lights renderer: opaque surfaces are written to a G-buffer, light primitives are accumulated later, and future shadow casters/material channels can extend the same pipeline.

The current project already has a packetized render pipeline:

```txt
render extraction -> RenderFrame packets -> NativeFrameBackend -> NativeFrameSource -> PresentationBackend
```

Canvas2D is the reference/fallback native-frame backend. A simple WebGL backend exists for a small packet subset, but it is not a deferred renderer and does not own scene state or extraction. Lighting should therefore extend the existing scene/component, read-model, packet, and backend boundaries instead of bypassing them.

## Decision

Add lighting as explicit primitives across the existing layers:

```txt
scene object prefab with render:light2d component
  -> gameplay render read model light renderable
  -> RenderFrame packet kind: light2d
  -> WebGL2 deferred native-frame backend
```

V1 supports only:

- ambient lights
- point lights
- default ambient injection
- opaque lit rect surfaces first
- lit image/sprite/texturedQuad surfaces in the next slice
- unlit Canvas2D fallback when deferred rendering is unavailable

V1 intentionally does not implement:

- shadows
- normal/specular/height/material channels
- cone/sun/moon lights
- layered/parallax lighting
- HDR, tone mapping, quantization, dithering, or bloom
- map-editor authoring of arbitrary light objects

The API and packet design must leave room for those future systems without implementing fake fields early.

## Data primitives

Introduce small immutable tuple helpers for new authored/render primitive values:

```js
// src/core/color.js
Color.rgb(r, g, b)      // -> frozen [r, g, b, 255]
Color.rgba(r, g, b, a) // -> frozen [r, g, b, a]

// src/core/vector.js
Vec.xy(x, y)           // -> frozen [x, y]
Vec.xyz(x, y, z)
Vec.xyzw(x, y, z, w)
```

Rules:

- `Color` channels are integer bytes `0..255`.
- `Vec` channels are finite numbers.
- Helpers validate and throw on invalid authored data.
- Helpers return frozen tuples.
- Special concepts such as infinitely distant sky/parallax layers must use semantic fields later, not `Infinity` vector values.

## Scene component schema

Add `renderLight2d()` to `src/engine/scene/components.js`.

Ambient component:

```js
renderLight2d({
  kind: 'ambient',
  color: Color.rgb(255, 255, 255),
  intensity: 1
})
```

Point component:

```js
renderLight2d({
  kind: 'point',
  radius: 144,
  color: Color.rgb(255, 180, 90),
  intensity: 1,
  offset: Vec.xy(0, -8),
  volumetricIntensity: 0,
  castsShadows: false
})
```

Rules:

- `kind` is restricted to `'ambient' | 'point'` in v1.
- Point lights require an explicit positive world-pixel `radius`.
- `intensity` and `volumetricIntensity` are finite non-negative numbers with no upper clamp.
- RGBA alpha multiplies effective light intensity.
- Point `offset` is a world-pixel `Vec2`, applied relative to the source object's transform center.
- Ambient components store only ambient-relevant fields.
- Point components store point-relevant fields.
- `castsShadows` is reserved/no-op in v1 but belongs on point lights.
- Do not add `normalInfluence`, specular, albedo, or height fields to `renderLight2d`; those belong to future material primitives.
- The component object may remain a plain object for consistency with existing component factories, but nested color/offset tuples are validated, cloned, and frozen.

## Prefabs and authoring

Lighting prefabs use existing `defineObject()` definitions with `render:light2d` components.

Initial small game-flavored prefabs in `src/content/tilemaps/objects.js`:

```js
darkAmbientLight:
  color: Color.rgb(12, 16, 28)
  intensity: 0.55

warmTorchLight:
  radius: 128
  color: Color.rgb(255, 176, 92)
  intensity: 1.0
  volumetricIntensity: 0.02
```

The rendering gym should instantiate:

- one dark ambient light
- two warm torch point lights

Lights are invisible scene objects in v1. Visual torch fixtures/decor are a later concern.

Map-editor authoring is deferred until the planned editor/layer refactor. Future editor palettes should reference prefab object IDs through static metadata rather than copying runtime component definitions.

## Read model and packet extraction

`createGameplayRenderReadModel()` collects all `render:light2d` components from authored scene objects.

Light renderable shape:

```js
{
  id: `${object.id}:light2d:${index}`,
  kind: 'light2d',
  transform: { ...object.transform },
  render: { ...component },
  source: object
}
```

Multiple `render:light2d` components per object are allowed; each emits one light renderable and one packet.

Add `src/render/extractors/light-packets.js` with:

- `lightWorldPosition(lightRenderable)`
- `pointLightIntersectsView(lightRenderable, renderView)`
- `addLightPackets(builder, lights, renderView, layer)`

Point light position:

```js
x = transform.x + transform.w / 2 + offset[0]
y = transform.y + transform.h / 2 + offset[1]
```

Point lights are authored in world pixels and emitted in native-frame pixels. Cull point lights when their radius circle does not intersect the camera view. Do not add hidden culling padding in v1.

Ambient lights are always emitted.

Default ambient rules:

- Extraction always emits at least one ambient `light2d` packet.
- If no authored ambient exists, emit default white ambient:
  ```js
  {
    kind: 'light2d',
    lightKind: 'ambient',
    sourceId: 'default-ambient-light',
    defaultLight: true,
    color: Color.rgb(255, 255, 255),
    intensity: 1
  }
  ```
- If one or more authored ambient lights exist, emit authored ambients only; they replace the default.
- Multiple authored ambient lights add together in the backend and clamp through the SDR output.
- A completely dark scene is authored with ambient intensity `0` and point lights.

## Render packets

Lights are regular finalized render packets:

```js
{
  kind: 'light2d',
  lightKind: 'ambient' | 'point',
  layer: GameplayRenderLayer.LightPrimitive,
  lighting: 'light',
  sourceId,
  color,       // byte RGBA tuple
  intensity,
  ...pointFields
}
```

Point packet fields:

```js
{
  x, y,        // native-frame pixels
  radius,      // native-frame pixels
  volumetricIntensity,
  castsShadows
}
```

Use `GameplayRenderLayer.LightPrimitive = 9500` for inspection/debug ordering only. This layer is not a pass boundary and does not decide which surfaces are lit.

Add minimal packet pass-membership metadata:

```js
lighting: 'lit' | 'unlit' | 'light'
```

Semantics:

- `lit`: eligible for the deferred G-buffer if the backend supports the packet kind and alpha policy.
- `unlit`: drawn forward and never affected by v1 deferred lights.
- `light`: light primitive/instruction packet.

Canvas2D ignores this field. Deferred backends use it for pass grouping.

Initial extraction policy:

- `lighting: 'lit'`: contained-terrain solid rects first; image/sprite/texturedQuad surfaces in the next slice.
- `lighting: 'unlit'`: dungeon backdrop, current vector actors, dust, particles, debug overlays, unsupported translucent effects.
- `lighting: 'light'`: `light2d` packets.

Unsupported lit packet kinds in deferred mode are drawn forward/unlit with diagnostics instead of forcing whole-frame fallback.

Alpha policy:

- Lit rects must be opaque. Semi-transparent lit rects render forward/unlit with diagnostics.
- Lit images use alpha-mask behavior: sample alpha below cutoff is discarded; surviving pixels write opaque albedo.
- Full semi-transparent deferred blending is out of scope for v1.

## Backend selection and fallback

Deferred rendering is content-driven but default ambient alone does not activate it.

Rules:

- If a frame has only default ambient, use the existing forward native-frame path.
- If a frame has authored ambient or point lights, try the WebGL2 deferred native-frame backend.
- If WebGL2 deferred is unavailable, render unlit through the existing Canvas2D fallback and record a fallback reason.
- Dev flags may force or disable deferred lighting for debugging.

Keep the existing backend contract:

```js
{
  kind: 'webgl2-deferred-native-frame-backend',
  draw(frame),
  supportsFrame(frame),
  getSource(),
  destroy()
}
```

Leave room for a future sibling `webgpu-deferred-native-frame-backend`; do not build a larger abstraction before there is a second implementation.

## Deferred renderer shape

Target WebGL2 for the first deferred backend. WebGL1 extension fallback is out of scope.

V1 pass structure:

```txt
1. forward/background pass for unlit backdrop where needed
2. G-buffer pass for supported opaque lit surfaces
3. light accumulation pass for ambient and point lights
4. compose pass
5. forward overlay pass for unlit actors/effects/debug/unsupported packets
```

The compose pass is intentionally named even though v1 only clamps SDR output. Future color operations such as tone mapping, quantization, dithering, and bloom can attach there.

V1 color equation:

```txt
final = albedo * ambient + sum(albedo * pointLight + volumetric)
```

Final output is SDR/clamped. HDR/tone mapping/bloom are future post-lighting systems.

## Implementation slices

Implement as independently testable vertical slices.

### Slice 1: Core data primitives — Complete

Implemented in:

- `src/core/color.js` with `Color.rgb/rgba`, `isRgba`, `assertRgba`.
- `src/core/vector.js` with `Vec.xy/xyz/xyzw`, `isVec2/3/4`, `assertVec2/3/4`.
- `tests/core-primitives.spec.js` covering validation, freezing, and invalid input failures.

Validated with:

```sh
bunx playwright test tests/core-primitives.spec.js --project=chromium
bun run build
```

### Slice 2: Light component and prefabs — Complete

Implemented in:

- `src/engine/scene/components.js` with `renderLight2d()` for ambient and point light schemas.
- `src/content/tilemaps/objects.js` with `darkAmbientLight` and `warmTorchLight` prefabs and `renderLight2d` re-export.
- `tests/light-components.spec.js` covering schema validation, cloned/frozen nested tuples, field filtering, and prefab shapes.

Validated with:

```sh
bunx playwright test tests/light-components.spec.js --project=chromium
bunx playwright test tests/scene.spec.js tests/light-components.spec.js --project=chromium
bun run build
```

### Slice 3: Read model and light packet extraction — Complete

Implemented in:

- `src/render/extractors/gameplay-renderables.js` collecting `render:light2d` renderables.
- `src/render/extractors/light-packets.js` with light positioning, point culling, default/authored ambient replacement, and `light2d` packet emission.
- `src/render/extractors/gameplay-render-layers.js` with `GameplayRenderLayer.LightPrimitive = 9500`.
- Gameplay/tilemap/primitive extraction sites with explicit `lighting` metadata (`lit`, `unlit`, `light`).
- `tests/render-pipeline.spec.js` covering default ambient, authored ambient replacement, point anchoring/native scaling, culling, multiple light components, and packet shapes.

Validated with:

```sh
bunx playwright test tests/render-pipeline.spec.js --project=chromium
bun run build
bunx playwright test tests/scene.spec.js tests/render-pipeline.spec.js --project=chromium
```

### Slice 4: Rendering gym content — Complete

Implemented in:

- `src/content/tilemaps/definitions/rendering-gym-map.js` with a dedicated invisible `lights` grid layer containing one dark ambient light and two warm torch point lights.
- `tests/render-pipeline.spec.js` asserting the rendering gym frame emits one authored ambient packet and two point packets.

Validated with:

```sh
bunx playwright test tests/render-pipeline.spec.js --project=chromium
bun run build
```

### Slice 5: Backend selection scaffolding — Complete

Implemented in:

- `src/render/deferred-lighting-selection.js` with helpers to detect authored/non-default light packets, default-only ambient, dev force/disable flags, and selected backend kind.
- `src/render/gameplay-render-pipeline.js` selecting deferred for authored lights by default, preserving explicit forward WebGL/Canvas requests, and falling back to Canvas2D with a recorded deferred fallback reason while the deferred backend is unavailable.
- `src/render/backends/webgl2-deferred-native-frame-backend.js` as the deferred backend contract placeholder for the next slice.
- `tests/render-pipeline.spec.js` covering default ambient not activating deferred, authored lights requesting deferred, disable/force flags, and unavailable deferred fallback to Canvas2D.

Validated with:

```sh
bunx playwright test tests/render-pipeline.spec.js --project=chromium
bun run build
```

### Slice 6: WebGL2 deferred MVP-A, rect surfaces — Complete

Implemented in:

- `src/render/backends/webgl2-deferred-native-frame-backend.js` with the deferred backend contract, WebGL2 availability gate, native-resolution albedo/light compose buffers, opaque lit rect support, ambient/point accumulation, forward drawing for unlit/unsupported packets, and diagnostics for unsupported lit packets.
- `tests/render-pipeline.spec.js` proving point-lit rect terrain is brighter at the light center than outside the light radius, and authored gameplay lights select the deferred backend when WebGL2 is available.

Validated with:

```sh
bunx playwright test tests/render-pipeline.spec.js --project=chromium
bun run build
bun run validate:map-render
```

Note: `bun run validate:foundation` was also attempted after this slice; the new render-pipeline coverage passed, but existing unrelated foundation expectations currently fail in `tests/core-boundary.spec.js`, `tests/scenarios-registry.spec.js`, and `tests/scenes-registry.spec.js`.

### Slice 7: WebGL2 deferred MVP-B, image/sprite surfaces

- Add G-buffer support for `image`, `sprite`, and `texturedQuad` packets.
- Reuse asset registry and atlas/source-rect resolution.
- Apply alpha-mask discard for image pixels.
- Add focused atlas/image lighting tests.

## Consequences

Positive:

- Lighting follows the existing scene/read-model/packet/backend architecture.
- Canvas2D remains a reliable unlit fallback.
- Light authoring starts as reusable `defineObject()` prefabs.
- Default ambient preserves a complete lighting model while still allowing black/dark scenes through authored ambient replacement.
- Future shadows, materials, layered lights, WebGPU, and post-lighting color operations have named extension points.

Negative / risks:

- V1 lights will not affect vector actors, particles, debug overlays, or the dungeon backdrop.
- Initial deferred visuals may feel incomplete until image/sprite and later actor/material support land.
- Invisible light objects are not editor-friendly until the editor/layer refactor.
- WebGL2 backend work adds shader/FBO complexity and needs browser-level validation.

## Validation expectations

For data/model/extraction slices:

```sh
bun run build
bunx playwright test tests/scene.spec.js tests/render-pipeline.spec.js --project=chromium
```

For backend/rendering slices:

```sh
bun run build
bunx playwright test tests/render-pipeline.spec.js --project=chromium
bun run validate:map-render
```

Use focused tests first, then the project foundation gate before completing major rendering slices:

```sh
bun run validate:foundation
```
