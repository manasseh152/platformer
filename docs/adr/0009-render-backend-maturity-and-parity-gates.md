# ADR 0009: Render backend maturity and parity gates

- Status: Accepted
- Date: 2026-05-13

## Context

The render pipeline now uses the packet/backend architecture accepted in ADR 0005:

```txt
render extraction -> RenderFrame packets -> NativeFrameBackend -> NativeFrameSource -> PresentationBackend
```

Canvas2D is the current reference native-frame backend. WebGL and WebGL2 deferred native-frame backends exist, but they have different maturity and specialization profiles. ADR 0007 introduced deferred 2D lighting primitives, which makes backend selection more important: some frames are valid only for specialized GPU paths, while baseline gameplay frames must continue to render correctly through the reference path.

Known maturity concerns include:

- Backend selection and fallback must be capability-driven, not preference-driven.
- Unsupported packets or packet features must not be silently dropped by GPU backends.
- Capability checks must inspect finalized frame semantics, not just backend existence or packet kind names.
- WebGL native-frame rendering currently supports vector packets and gradients through a Canvas2D texture compatibility path; this is valid support for correctness, but not enough by itself to make WebGL an accelerated/default backend.
- WebGL native-frame rendering still has feature gaps such as rotated image, sprite, and texturedQuad packets.
- WebGL2 deferred is a specialized lighting path, not a general replacement for Canvas2D.
- Optional GPU polish effects, such as deferred lighting, should degrade deterministically when unsupported rather than making the game unplayable.
- New visual features can fragment behavior if they bypass the render read model, packet contract, or backend capability checks.
- We need a shared policy for when a GPU backend is experimental, production-capable, or eligible to become a default.

We considered migrating to an external renderer such as Three.js. Three.js is valuable for 3D or heavy material/post-processing workflows, but it is not the best default fit for a 2D pixel platformer whose renderer already has project-specific packet extraction, tilemap rendering, pixel-perfect presentation, fallback behavior, and deferred-lighting experiments. If an external 2D renderer is evaluated later, PixiJS is likely a closer fit than Three.js.

External renderers may still be used as design references. PixiJS, Three.js, and similar renderers may inform batching, resource lifetime, diagnostics, fallback patterns, and GPU architecture choices. The implementation goal remains a project-specific renderer streamlined for this game's packet model, pixel presentation, tilemaps, and deferred 2D lighting needs.

The likely product runtime is a bundled Chromium shell for desktop and Android, while still supporting modern browsers where practical. This reduces future WebGPU availability risk for target builds, but it does not remove the need for capability gates, fallback behavior, and baseline rendering correctness.

## Decision

Continue maturing the custom packet-based render pipeline rather than migrating to Three.js or another external runtime renderer.

Canvas2D remains the reference backend for required gameplay visual correctness. GPU backends become production-capable only through explicit capability declarations, parity coverage where applicable, deterministic downgrade behavior, and fallback diagnostics.

Backend selection must be capability-driven. A backend may be requested by settings or devtools, but the pipeline must select, degrade, or fall back based on the finalized frame's packet requirements and the backend's declared support.

## Runtime visual tiers

### Target / best visual tier

Bundled Chromium desktop/Android and modern browsers with WebGL2, and later possibly WebGPU, are the target tier for best visuals. This tier may enable optional GPU polish such as deferred lighting, volumetric lighting, material effects, or future post-processing.

### Baseline tier

Canvas2D-capable browsers/devices are the baseline tier. Required gameplay visuals must remain correct and playable here. Optional GPU polish may be disabled or degraded.

### Optional GPU effects

GPU-only polish features may ship without Canvas2D visual parity if they are explicitly documented as optional and have:

- capability checks
- deterministic disabled/degraded fallback
- GPU acceptance tests on target runtime
- diagnostics explaining the downgrade
- no effect on gameplay logic, collision, or simulation semantics

Disabling optional GPU effects is not a player-facing failure. The game should remain visually coherent, just less polished.

## Backend maturity tiers

### Reference

A reference backend must support the accepted packet vocabulary used by normal gameplay and tooling frames. It is the correctness oracle for required visual behavior and fallback rendering.

Current reference backend:

- Canvas2D native-frame backend

### Experimental

An experimental backend may support only a packet subset or may support packets through compatibility paths that still need parity/performance hardening. It may be manually requested for development or diagnostics, but it must never silently omit unsupported required packets. If a finalized frame exceeds its capabilities, the pipeline must fall back or degrade according to the backend type and record the reason.

Current examples:

- WebGL native-frame backend while feature gaps and parity gates remain

### Accelerated

An accelerated backend may be selected automatically for frames it fully supports. It must have parity coverage against the reference backend for representative gameplay frames and must handle context loss, resize, asset loading, and fallback paths predictably.

A backend can become accelerated only after the relevant acceptance criteria in this ADR are met.

### Specialized

A specialized backend implements a specific rendering mode or pass structure, such as deferred lighting. It is not required to support all reference behavior, but it must declare the frame features it requires and the packet/features it can consume.

Current examples:

- WebGL2 deferred native-frame backend

Specialized backends may degrade unsupported optional effects within a frame when that behavior is explicitly documented. For WebGL2 deferred rendering, unsupported lit G-buffer participation is rendered forward/unlit with diagnostics, per ADR 0007. This is different from the forward WebGL native backend, where unsupported required packet features cause whole-frame fallback to Canvas2D.

## Feature-entry rule

New visual features must enter the renderer through the established pipeline:

1. authored scene/component data when applicable
2. render read model extraction
3. explicit `RenderFrame` packet contract or packet metadata
4. Canvas2D reference implementation unless the feature is explicitly GPU-only optional polish
5. backend capability declarations
6. focused tests or documented fallback/degrade behavior

New visual behavior must not directly query mutable gameplay state from a backend, store browser/GPU handles in gameplay components, or add backend-only draw paths that bypass packet extraction.

Future render feature ADRs or implementation plans must reference this feature-entry rule.

## Capability declarations

Native-frame backends must expose enough capability information for selection and diagnostics. Capability checks must answer whether a finalized frame is supported, not merely whether a backend exists.

Capability reporting should use a shared manifest/inspection shape incrementally adapted from existing backend-specific analyzers. A support result should include at least:

```js
{
  backendKind,
  supported,
  issues: [
    { packetKind, feature, reason, severity }
  ]
}
```

Capability reporting should cover at least:

- packet kinds
- packet feature flags, such as rotation, gradients, alpha policy, flip state, or textured atlas rects
- packet semantics, including whether lighting is default ambient, authored ambient, point light, lit surface, unlit surface, or light instruction
- asset requirements and asset load state where relevant
- platform/backend availability
- context loss state

Unsupported frames must return structured issues that can be surfaced in render diagnostics and devtools.

`light2d` support is semantic, not just a packet-kind check. Forward backends may ignore default ambient light packets, but authored ambient/point lights require a deferred/specialized path or a documented optional-effect downgrade.

## Diagnostics and fallback policy

Fallback or degradation is mandatory when a requested backend cannot faithfully render required visuals for a finalized frame.

Diagnostics should converge on a single normalized render pipeline diagnostics system. Temporary legacy fields may remain during migration, but new code should use normalized fields such as:

```js
{
  requestedBackendKind,
  candidateBackendKind,
  actualBackendKind,
  fallback: {
    occurred,
    from,
    to,
    issues
  },
  frame
}
```

Definitions:

- `requestedBackendKind`: backend requested by settings, devtools, or explicit render call; `auto` when none was requested.
- `candidateBackendKind`: backend selected before fallback/degrade checks.
- `actualBackendKind`: backend actually used for draw/presentation after fallback.
- `fallback.issues`: structured capability or availability issues that caused fallback/degrade behavior.

Rules:

- Canvas2D is the fallback for non-specialized native-frame rendering.
- Forward WebGL/native unsupported required packet features cause fallback to Canvas2D, not omission.
- Deferred rendering falls back to unlit Canvas2D when WebGL2 deferred rendering is unavailable or unsupported for the frame as a whole.
- WebGL2 deferred unsupported lit G-buffer participation may render forward/unlit with diagnostics, per ADR 0007.
- Fallback reasons must be recorded on render pipeline diagnostics.
- Backend selection must not mutate gameplay state or extraction state.
- Player-facing gameplay should not show technical warnings by default. Devtools/diagnostics should expose plain-language fallback text, such as: "WebGL could not render this frame; using Canvas2D fallback."

## Parity gates

A GPU backend can become an automatic/default backend only when:

- it declares support for the packet set and packet features used by representative gameplay frames
- unsupported packets and unsupported packet features are detected before draw
- fallback/degrade behavior is covered by tests
- representative Canvas2D and GPU render outputs have focused parity coverage where the feature is not documented as GPU-only optional polish
- full-map visual review artifacts can be generated for map/tile rendering changes
- context loss and restoration are handled inside the backend
- resize/native-frame source behavior matches the presentation contract
- asset loading and atlas sprite metadata paths are covered
- diagnostics report requested, candidate, and actual backend decisions accurately

Pixel-exact parity is not required for every antialiased/vector edge, but gameplay-relevant visual semantics must match. Tests may use a mix of exact pixel checks for crisp sprite/tile cases and tolerance-based checks for GPU/vector cases.

GPU tests should be capability-gated. CI must always run Canvas2D/reference and packet/diagnostics tests. GPU behavior tests should run when feature detection succeeds, and skip with an explicit reason when unavailable. Bundled Chromium release validation should include the full GPU suite for target platforms.

## Authorized next slices

### 1. Renumber and accept this ADR

Use a unique ADR number and mark the policy accepted before implementation slices begin.

### 2. Formalize backend capability manifests — Complete

Move capability checks toward a shared manifest/inspection shape so backend selection and diagnostics do not duplicate ad-hoc packet support logic.

Initial implementation may adapt the existing WebGL support analyzer rather than performing a big-bang rewrite. Canvas2D can declare reference support for accepted gameplay packets. Specialized deferred support can report specialized pass limitations and optional-effect degrade diagnostics.

Implemented in `src/render/backends/native-frame-capabilities.js`, with the WebGL analyzer returning normalized `backendKind`, `supported`, and structured `issues`; Canvas2D now declares reference support through `supportsFrame()`.

### 3. Normalize render diagnostics and fallback fields — Complete

Render diagnostics should expose:

- requested backend
- candidate backend
- actual backend
- fallback/degrade occurrence
- fallback/degrade reason
- packet count by kind/layer
- unsupported packet/features when applicable
- draw-call/resource counters where practical
- frame timing where practical and stable enough to be useful

Keep temporary legacy fallback fields only as a compatibility bridge. Add a cleanup slice to remove them once devtools/tests read the normalized system.

Implemented through `renderNativeFrame(...)` and `renderGameplayFrame(...)` diagnostics: `requestedBackendKind`, `candidateBackendKind`, `actualBackendKind`, `fallback.occurred`, `fallback.from`, `fallback.to`, and normalized fallback issues are recorded. Legacy `webglFallbackReason` / `deferredFallbackReason` fields were removed in slice 7.

### 4. Add focused unsupported-feature fallback tests — Complete

Create at least one focused finalized-frame test verifying an unsupported WebGL packet feature, such as rotated image/sprite/texturedQuad packets, causes fallback to Canvas2D with a structured diagnostic reason.

Covered by `tests/render-pipeline.spec.js`, which verifies a frame with an unsupported WebGL fill feature falls back to Canvas2D and records a structured `fill` capability issue.

### 5. Close remaining WebGL native backend feature gaps — Complete

Implement or explicitly reject support for current required packet feature gaps.

Known current gap resolved:

- rotated image, sprite, and texturedQuad packets in the forward WebGL native backend

Implemented by rotating WebGL quad vertices around the packet destination center while preserving source rect, atlas sprite, flip, texture, and alpha handling. The WebGL capability analyzer no longer rejects rotated image-like packets. `tests/render-pipeline.spec.js` covers rotated `image`, `sprite`, and `texturedQuad` packets staying on WebGL without fallback, while the focused unsupported-feature fallback test now uses an unsupported fill feature.

Vector packets and gradient fills are currently supported through a Canvas2D texture compatibility path. That path counts as correctness support for capability checks, but it does not by itself satisfy accelerated/default backend parity or performance gates.

Canvas2D remains the reference during this work.

### 6. Add parity render scenarios — Complete

Create focused render scenarios for:

- clear/rect/vector primitives
- standalone image packets
- atlas sprite packets
- tilemap/contained-terrain chunks
- actors and flipped/rotated sprites
- lighting primitives and lit/unlit surfaces
- debug overlays

Implemented in `src/render/parity-render-scenarios.js`, with coverage and Canvas2D/WebGL sampled-pixel parity checks in `tests/render-pipeline.spec.js`. The scenarios are focused fixtures for the ADR 0009 representative packet families; debug/vector samples allow bounded tolerance where Canvas2D compatibility paths and WebGL rasterization differ on antialiasing or alpha blending.

### 7. Cleanup legacy fallback fields — Complete

After diagnostics consumers are migrated, remove split fields such as backend-specific fallback reason properties in favor of the normalized diagnostics object.

Implemented by removing `webglFallbackReason` and `deferredFallbackReason` writes from `renderNativeFrame(...)`, removing the legacy `selectedBackendKind` diagnostics bridge, and migrating devtools/tests to read `diagnostics.fallback.issues` plus `candidateBackendKind`.

### 8. Keep WebGPU native/deferred backend as a future spike

Do not introduce a WebGPU native-frame backend as part of this ADR's immediate implementation. Revisit after capability manifests, diagnostics, and WebGL/WebGL2 parity gates are established, or if deferred/material requirements outgrow WebGL2.

Because bundled Chromium is a likely target runtime, WebGPU is a credible future native-frame/deferred backend target. Its first slice should be narrow, such as drawing clear/rect/image packets into a `NativeFrameSource`, and it must enter through the same packet contract, capability manifest, diagnostics, and fallback rules.

### 9. Keep external renderer evaluation as a future escape hatch

Do not migrate to Three.js as part of renderer maturity work. Revisit external renderers only if one of these becomes true:

- product direction requires real 3D or substantial 2.5D scene composition
- shader/material/post-processing needs outgrow the custom backend approach and WebGPU/WebGL2 custom backend work is not cost-effective
- maintaining 2D batching, filters, and effects becomes more expensive than adapting to a mature 2D renderer

If the goal remains 2D renderer maintenance reduction, evaluate PixiJS before Three.js.

## Consequences

### Positive

- Gives the renderer a clear production-readiness path.
- Prevents silent visual regressions in GPU backends.
- Keeps Canvas2D as a stable correctness oracle and fallback for required gameplay visuals.
- Allows WebGL/WebGL2 improvements to land incrementally.
- Preserves the existing packet/read-model architecture.
- Creates a path for future WebGPU without switching prematurely.
- Avoids premature migration to a renderer optimized for a different problem shape.

### Negative

- Adds test and diagnostics work before GPU backends can become defaults.
- Keeps custom renderer maintenance in the project.
- Some GPU features may take longer because they must pass through packet contracts and parity gates.
- Canvas2D reference behavior can constrain required feature design unless explicitly documented as GPU-only optional polish.
- Capability-gated tests require care so CI remains stable while target runtime validation remains strict.

## Acceptance criteria

- Backend maturity tiers are documented and used when describing Canvas2D, WebGL, WebGL2 deferred, and future WebGPU backends.
- Backend capability checks are explicit enough to prevent silent required packet/feature loss.
- Render diagnostics record requested backend, candidate backend, actual backend, and fallback/degrade reason.
- At least one focused finalized-frame test verifies an unsupported WebGL packet feature causes fallback to Canvas2D with a structured diagnostic reason.
- Specialized deferred fallback/degrade behavior remains consistent with ADR 0007.
- Future render feature ADRs or implementation plans reference the feature-entry rule in this ADR.
