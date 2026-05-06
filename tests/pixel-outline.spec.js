import { expect, test } from '@playwright/test';
import { drawPixelRect, normalizePixelRect } from '../src/rendering/pixel-outline.js';

function fakeCanvasContext() {
  const calls = [];
  let fillStyle = '#initial';
  return {
    calls,
    get fillStyle() { return fillStyle; },
    set fillStyle(value) { fillStyle = value; calls.push(['fillStyle', value]); },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    fillRect(x, y, w, h) { calls.push(['fillRect', x, y, w, h, fillStyle]); }
  };
}

test('normalizePixelRect rounds rect edges to native pixels', () => {
  expect(normalizePixelRect({ x: 10.4, y: 20.2, w: 31.4, h: 15.8 })).toEqual({ x: 10, y: 20, w: 32, h: 16 });
});

test('normalizePixelRect ignores invalid and zero-size rects', () => {
  expect(normalizePixelRect(null)).toBeNull();
  expect(normalizePixelRect({ x: 0, y: 0, w: 0, h: 4 })).toBeNull();
  expect(normalizePixelRect({ x: Number.NaN, y: 0, w: 4, h: 4 })).toBeNull();
  expect(normalizePixelRect({ x: 0.4, y: 0, w: 0.09, h: 4 })).toBeNull();
});

test('drawPixelRect fills the snapped original rect before drawing inside outline bands', () => {
  const ctx = fakeCanvasContext();

  drawPixelRect(ctx, { x: 10.4, y: 20.2, w: 31.4, h: 15.8 }, {
    fill: 'rgba(255, 80, 80, 0.12)',
    outline: 'rgba(255, 80, 80, 0.95)',
    thickness: 2
  });

  expect(ctx.calls).toEqual([
    ['save'],
    ['fillStyle', 'rgba(255, 80, 80, 0.12)'],
    ['fillRect', 10, 20, 32, 16, 'rgba(255, 80, 80, 0.12)'],
    ['fillStyle', 'rgba(255, 80, 80, 0.95)'],
    ['fillRect', 10, 20, 32, 2, 'rgba(255, 80, 80, 0.95)'],
    ['fillRect', 10, 34, 32, 2, 'rgba(255, 80, 80, 0.95)'],
    ['fillRect', 10, 22, 2, 12, 'rgba(255, 80, 80, 0.95)'],
    ['fillRect', 40, 22, 2, 12, 'rgba(255, 80, 80, 0.95)'],
    ['restore']
  ]);
});

test('drawPixelRect can draw caller-normalized rects without snapping', () => {
  const ctx = fakeCanvasContext();

  drawPixelRect(ctx, { x: 1.25, y: 2.5, w: 4.5, h: 3.5 }, {
    fill: '#123',
    snap: false
  });

  expect(ctx.calls).toEqual([
    ['save'],
    ['fillStyle', '#123'],
    ['fillRect', 1.25, 2.5, 4.5, 3.5, '#123'],
    ['restore']
  ]);
});

test('drawPixelRect draws outside outlines around the original rect', () => {
  const ctx = fakeCanvasContext();

  drawPixelRect(ctx, { x: 10, y: 20, w: 8, h: 6 }, {
    outline: '#fff',
    thickness: 2,
    placement: 'outside'
  });

  expect(ctx.calls).toEqual([
    ['save'],
    ['fillStyle', '#fff'],
    ['fillRect', 8, 18, 12, 2, '#fff'],
    ['fillRect', 8, 26, 12, 2, '#fff'],
    ['fillRect', 8, 20, 2, 6, '#fff'],
    ['fillRect', 18, 20, 2, 6, '#fff'],
    ['restore']
  ]);
});

test('drawPixelRect accepts arrays and restores canvas state per call', () => {
  const ctx = fakeCanvasContext();

  drawPixelRect(ctx, [{ x: 0, y: 0, w: 4, h: 4 }, { x: 8, y: 0, w: 4, h: 4 }], {
    outline: '#0ff',
    thickness: 1
  });

  expect(ctx.calls[0]).toEqual(['save']);
  expect(ctx.calls.at(-1)).toEqual(['restore']);
  expect(ctx.calls.filter(call => call[0] === 'fillRect')).toEqual([
    ['fillRect', 0, 0, 4, 1, '#0ff'],
    ['fillRect', 0, 3, 4, 1, '#0ff'],
    ['fillRect', 0, 1, 1, 2, '#0ff'],
    ['fillRect', 3, 1, 1, 2, '#0ff'],
    ['fillRect', 8, 0, 4, 1, '#0ff'],
    ['fillRect', 8, 3, 4, 1, '#0ff'],
    ['fillRect', 8, 1, 1, 2, '#0ff'],
    ['fillRect', 11, 1, 1, 2, '#0ff']
  ]);
});
