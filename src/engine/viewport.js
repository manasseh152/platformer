import { computePresentationViewport } from './render/viewport.js';

export function calculateViewport(canvasWidth, canvasHeight, viewWidth, viewHeight, pixelPerfect = true) {
  if (pixelPerfect) {
    const viewport = computePresentationViewport(canvasWidth, canvasHeight, viewWidth, viewHeight);
    return { scale: viewport.scale, offsetX: viewport.offsetX, offsetY: viewport.offsetY };
  }
  const fitScale = Math.min(canvasWidth / viewWidth, canvasHeight / viewHeight);
  return {
    scale: fitScale,
    offsetX: Math.floor((canvasWidth - viewWidth * fitScale) / 2),
    offsetY: Math.floor((canvasHeight - viewHeight * fitScale) / 2)
  };
}
