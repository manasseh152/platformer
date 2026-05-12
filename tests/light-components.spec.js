import { expect, test } from '@playwright/test';
import { Color } from '#/core/color.js';
import { Vec } from '#/core/vector.js';
import { renderLight2d } from '#/engine/scene/components.js';
import { darkAmbientLight, warmTorchLight } from '#/content/tilemaps/objects.js';

test('renderLight2d creates ambient light components with cloned frozen color tuples', () => {
  const color = Color.rgb(12, 16, 28);
  const component = renderLight2d({ kind: 'ambient', color, intensity: 0.55, radius: 999 });

  expect(component).toEqual({
    type: 'render:light2d',
    kind: 'ambient',
    color: [12, 16, 28, 255],
    intensity: 0.55
  });
  expect(component.color).not.toBe(color);
  expect(Object.isFrozen(component.color)).toBe(true);
  expect(component.radius).toBeUndefined();
});

test('renderLight2d creates point light components with point-only fields', () => {
  const color = Color.rgb(255, 176, 92);
  const offset = Vec.xy(0, -8);
  const component = renderLight2d({
    kind: 'point',
    radius: 128,
    color,
    intensity: 1,
    offset,
    volumetricIntensity: 0.02,
    castsShadows: false,
    normalInfluence: 1
  });

  expect(component).toEqual({
    type: 'render:light2d',
    kind: 'point',
    radius: 128,
    color: [255, 176, 92, 255],
    intensity: 1,
    offset: [0, -8],
    volumetricIntensity: 0.02,
    castsShadows: false
  });
  expect(component.color).not.toBe(color);
  expect(component.offset).not.toBe(offset);
  expect(Object.isFrozen(component.color)).toBe(true);
  expect(Object.isFrozen(component.offset)).toBe(true);
  expect(component.normalInfluence).toBeUndefined();
});

test('renderLight2d validates schema boundaries', () => {
  expect(() => renderLight2d()).toThrow(/kind/);
  expect(() => renderLight2d({ kind: 'sun' })).toThrow(/ambient.*point/);
  expect(() => renderLight2d({ kind: 'ambient', color: [255, 255, 255] })).toThrow(/RGBA/);
  expect(() => renderLight2d({ kind: 'ambient', intensity: -1 })).toThrow(/non-negative/);
  expect(() => renderLight2d({ kind: 'point' })).toThrow(/positive/);
  expect(() => renderLight2d({ kind: 'point', radius: 0 })).toThrow(/positive/);
  expect(() => renderLight2d({ kind: 'point', radius: 1, offset: [0, Infinity] })).toThrow(/Vec2/);
  expect(() => renderLight2d({ kind: 'point', radius: 1, volumetricIntensity: -0.1 })).toThrow(/non-negative/);
  expect(() => renderLight2d({ kind: 'point', radius: 1, castsShadows: 'yes' })).toThrow(/true or false/);
});

test('tilemap light prefabs expose initial dark ambient and warm torch definitions', () => {
  expect(darkAmbientLight).toMatchObject({
    id: 'dark-ambient-light',
    components: [{ type: 'render:light2d', kind: 'ambient', color: [12, 16, 28, 255], intensity: 0.55 }]
  });
  expect(warmTorchLight).toMatchObject({
    id: 'warm-torch-light',
    components: [{
      type: 'render:light2d',
      kind: 'point',
      radius: 128,
      color: [255, 176, 92, 255],
      intensity: 1,
      offset: [0, -8],
      volumetricIntensity: 0.02,
      castsShadows: false
    }]
  });
});
