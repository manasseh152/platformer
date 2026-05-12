import { expect, test } from '@playwright/test';
import { Color, assertRgba, isRgba } from '#/core/color.js';
import { Vec, assertVec2, assertVec3, assertVec4, isVec2, isVec3, isVec4 } from '#/core/vector.js';

test('Color creates frozen RGBA byte tuples', () => {
  const rgb = Color.rgb(1, 2, 3);
  const rgba = Color.rgba(4, 5, 6, 7);

  expect(rgb).toEqual([1, 2, 3, 255]);
  expect(rgba).toEqual([4, 5, 6, 7]);
  expect(Object.isFrozen(rgb)).toBe(true);
  expect(Object.isFrozen(rgba)).toBe(true);
});

test('Color validation accepts only integer bytes', () => {
  expect(isRgba([0, 128, 255, 42])).toBe(true);
  expect(assertRgba([0, 1, 2, 3])).toEqual([0, 1, 2, 3]);

  for (const value of [-1, 256, 1.5, Number.NaN, '1']) {
    expect(() => Color.rgba(value, 0, 0, 255)).toThrow(/byte/);
  }
  for (const value of [[0, 1, 2], [0, 1, 2, 3, 4], [0, 1, 2, 300], new Uint8Array([0, 1, 2, 3])]) {
    expect(isRgba(value)).toBe(false);
    expect(() => assertRgba(value)).toThrow(/RGBA/);
  }
});

test('Vec creates frozen finite-number tuples', () => {
  const xy = Vec.xy(1, -2.5);
  const xyz = Vec.xyz(1, 2, 3);
  const xyzw = Vec.xyzw(1, 2, 3, 4);

  expect(xy).toEqual([1, -2.5]);
  expect(xyz).toEqual([1, 2, 3]);
  expect(xyzw).toEqual([1, 2, 3, 4]);
  expect(Object.isFrozen(xy)).toBe(true);
  expect(Object.isFrozen(xyz)).toBe(true);
  expect(Object.isFrozen(xyzw)).toBe(true);
});

test('Vec validation is length-specific and rejects non-finite channels', () => {
  expect(isVec2([0, 1])).toBe(true);
  expect(isVec3([0, 1, 2])).toBe(true);
  expect(isVec4([0, 1, 2, 3])).toBe(true);
  expect(assertVec2([0, 1])).toEqual([0, 1]);
  expect(assertVec3([0, 1, 2])).toEqual([0, 1, 2]);
  expect(assertVec4([0, 1, 2, 3])).toEqual([0, 1, 2, 3]);

  for (const value of [Number.NaN, Infinity, -Infinity, '1']) {
    expect(() => Vec.xy(value, 0)).toThrow(/finite number/);
  }
  for (const value of [[0], [0, 1, 2], [0, Infinity], new Float32Array([0, 1])]) {
    expect(isVec2(value)).toBe(false);
    expect(() => assertVec2(value)).toThrow(/Vec2/);
  }
});
