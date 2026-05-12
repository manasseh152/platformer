import { Color } from '../../core/color.js';
import { worldToNativePoint } from '../../engine/render/viewport.js';
import { GameplayRenderLayer as L } from './gameplay-render-layers.js';

const DEFAULT_AMBIENT_COLOR = Color.rgb(255, 255, 255);

function finiteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

export function lightWorldPosition(lightRenderable) {
  const transform = lightRenderable?.transform ?? {};
  const offset = lightRenderable?.render?.offset ?? [0, 0];
  return {
    x: finiteOrZero(transform.x) + finiteOrZero(transform.w) / 2 + offset[0],
    y: finiteOrZero(transform.y) + finiteOrZero(transform.h) / 2 + offset[1]
  };
}

export function pointLightIntersectsView(lightRenderable, renderView) {
  const radius = lightRenderable?.render?.radius;
  if (!Number.isFinite(radius) || radius <= 0 || !renderView) return false;
  const p = lightWorldPosition(lightRenderable);
  const left = renderView.cameraX;
  const top = renderView.cameraY;
  const right = left + renderView.worldWidth;
  const bottom = top + renderView.worldHeight;
  const closestX = Math.max(left, Math.min(p.x, right));
  const closestY = Math.max(top, Math.min(p.y, bottom));
  const dx = p.x - closestX;
  const dy = p.y - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

function addAmbientPacket(builder, lightRenderable, layer) {
  const render = lightRenderable.render;
  builder.add({
    kind: 'light2d',
    lightKind: 'ambient',
    layer,
    lighting: 'light',
    sourceId: lightRenderable.id,
    color: render.color,
    intensity: render.intensity
  });
}

function addPointPacket(builder, lightRenderable, renderView, layer) {
  if (!pointLightIntersectsView(lightRenderable, renderView)) return;
  const render = lightRenderable.render;
  const position = worldToNativePoint(renderView, lightWorldPosition(lightRenderable).x, lightWorldPosition(lightRenderable).y);
  builder.add({
    kind: 'light2d',
    lightKind: 'point',
    layer,
    lighting: 'light',
    sourceId: lightRenderable.id,
    x: position.x,
    y: position.y,
    radius: render.radius * renderView.worldToNativeX,
    color: render.color,
    intensity: render.intensity,
    volumetricIntensity: render.volumetricIntensity,
    castsShadows: render.castsShadows
  });
}

export function addLightPackets(builder, lights = [], renderView, layer = L.LightPrimitive) {
  let authoredAmbientCount = 0;
  for (const light of lights) {
    if (light?.render?.kind === 'ambient') {
      authoredAmbientCount++;
      addAmbientPacket(builder, light, layer);
    }
  }
  if (authoredAmbientCount === 0) {
    builder.add({
      kind: 'light2d',
      lightKind: 'ambient',
      layer,
      lighting: 'light',
      sourceId: 'default-ambient-light',
      defaultLight: true,
      color: DEFAULT_AMBIENT_COLOR,
      intensity: 1
    });
  }
  for (const light of lights) {
    if (light?.render?.kind === 'point') addPointPacket(builder, light, renderView, layer);
  }
}
