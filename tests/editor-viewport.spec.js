import { expect, test } from '@playwright/test';
import { clampCamera, createViewport, resetView } from '#/editor/editor-viewport.js';

function viewport({ width = 800, height = 600, zoom = 1, x = 0, y = 0 } = {}) {
  const canvas = { clientWidth: width, clientHeight: height, width, height };
  const view = createViewport(canvas);
  view.width = width;
  view.height = height;
  view.camera = { x, y, zoom };
  return view;
}

test('editor viewport centers maps that are smaller than the visible camera', () => {
  const view = viewport({ width: 800, height: 600, zoom: 1, x: 0, y: 0 });

  clampCamera(view, 128, 96);

  expect(view.camera.x).toBe(-336);
  expect(view.camera.y).toBe(-252);
});

test('editor reset view centers the whole map instead of anchoring it top-left', () => {
  const view = viewport({ width: 800, height: 600 });

  resetView(view, 128, 96);

  const visibleWidth = view.width / view.camera.zoom;
  const visibleHeight = view.height / view.camera.zoom;
  expect(view.camera.x).toBeCloseTo((128 - visibleWidth) / 2);
  expect(view.camera.y).toBeCloseTo((96 - visibleHeight) / 2);
});

test('editor viewport still clamps normally when the map is larger than the camera', () => {
  const view = viewport({ width: 320, height: 180, zoom: 1, x: 900, y: 500 });

  clampCamera(view, 1000, 600);

  expect(view.camera.x).toBe(680);
  expect(view.camera.y).toBe(420);
});
