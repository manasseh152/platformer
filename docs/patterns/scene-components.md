# Scene components

Components are plain serializable data created by factories in `src/engine/scene/components.js`.

Current gameplay/render components include:

- `collision:solid`
- `terrain`
- `spawner`
- `physics:body`
- `physics:velocity`
- `health`
- `controller:player`
- `controller:enemy`
- `ai:patrol`
- `transition`
- `render:terrain`
- `render:goal`

## Render layer components

Optional render extras are renderer-agnostic. Unsupported components are skipped by default; no CPU/2D fallback is implied.

```js
import { renderLayer, renderParallax, renderProcedural, renderTexture } from '../../src/engine/scene/components.js';
```

```js
renderLayer({
  order: -200,
  space: 'camera-buffer',
  overscan: { x: 32, y: 16 }
})
```

Rules:

- `space` defaults to `camera-buffer` and is the only supported space for now.
- Layer coordinates and overscan are native low-res buffer pixels.
- Final composition must resolve to the native game buffer before nearest-neighbor scaling.
- `overscan` pads layers so parallax offsets do not reveal outside the layer.

```js
renderParallax({ x: 0.15, y: 0 })
```

Parallax is camera response, not autonomous scrolling:

- `0` = camera-locked
- `1` = moves with world
- `<1` = farther background
- `>1` = foreground/closer layer

Procedural and texture-backed renderables:

```js
renderProcedural({ shader: 'sky-bands' });
renderTexture({ asset: 'background-clouds', repeat: true, opacity: 0.8 });
```
