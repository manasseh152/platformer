import { expect, test } from '@playwright/test';
import { approachExp, clampCameraToWorld, createCamera } from '../src/camera.js';
import { calculateViewport } from '../src/viewport.js';

test('default viewport fills the available canvas with fractional scale', () => {
  expect(calculateViewport(1920, 1080, 630, 360)).toEqual({ scale: 3, offsetX: 15, offsetY: 0 });
  expect(calculateViewport(1280, 720, 630, 360)).toEqual({ scale: 2, offsetX: 10, offsetY: 0 });
  expect(calculateViewport(800, 600, 630, 360)).toEqual({ scale: 800 / 630, offsetX: 0, offsetY: 71 });
});

test('pixel-perfect viewport can still be requested explicitly', () => {
  expect(calculateViewport(800, 600, 630, 360, true)).toEqual({ scale: 1, offsetX: 85, offsetY: 120 });
});

test('camera clamps to world bounds when viewport is smaller than world', () => {
  const camera = createCamera({ x: 900, y: 500, targetX: 900, targetY: 500 });

  clampCameraToWorld(camera, { width: 630, height: 360 }, 1260, 700);

  expect(camera.x).toBe(630);
  expect(camera.y).toBe(340);
  expect(camera.targetX).toBe(630);
  expect(camera.targetY).toBe(340);
});

test('exponential approach is frame-rate independent style smoothing toward target', () => {
  const next = approachExp(0, 100, 8, 1 / 60);

  expect(next).toBeGreaterThan(0);
  expect(next).toBeLessThan(100);
  expect(approachExp(0, 100, 8, 1)).toBeCloseTo(99.966, 2);
});
