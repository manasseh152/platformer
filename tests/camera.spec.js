import { expect, test } from '@playwright/test';
import { approachExp, clampCameraToWorld, createCamera, updateFollowCamera } from '#/core/camera.js';
test('camera clamps to world bounds when viewport is smaller than world', () => {
  const camera = createCamera({ x: 900, y: 500, targetX: 900, targetY: 500 });

  clampCameraToWorld(camera, { width: 480, height: 270 }, 1260, 700);

  expect(camera.x).toBe(780);
  expect(camera.y).toBe(430);
  expect(camera.targetX).toBe(780);
  expect(camera.targetY).toBe(430);
});

test('exponential approach is frame-rate independent style smoothing toward target', () => {
  const next = approachExp(0, 100, 8, 1 / 60);

  expect(next).toBeGreaterThan(0);
  expect(next).toBeLessThan(100);
  expect(approachExp(0, 100, 8, 1)).toBeCloseTo(99.966, 2);
});

test('follow camera clamps against the active tilemap bounds', () => {
  const camera = createCamera({ x: 0, y: 0, targetX: 0, targetY: 0, smoothingX: 1000, smoothingY: 1000 });
  const game = {
    camera,
    view: { width: 100, height: 80 },
    tilemap: { worldWidth: 220, worldHeight: 140 },
    player: { x: 1000, y: 1000, w: 20, h: 20, dir: 1 }
  };

  updateFollowCamera(game, 1);

  expect(camera.x).toBe(120);
  expect(camera.y).toBe(60);
  expect(camera.targetX).toBe(120);
  expect(camera.targetY).toBe(60);
});
