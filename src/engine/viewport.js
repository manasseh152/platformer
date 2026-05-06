export function calculateViewport(canvasWidth, canvasHeight, viewWidth, viewHeight, pixelPerfect = false) {
  const fitScale = Math.min(canvasWidth / viewWidth, canvasHeight / viewHeight);
  const scale = pixelPerfect ? Math.max(1, Math.floor(fitScale)) : fitScale;
  return {
    scale,
    offsetX: Math.floor((canvasWidth - viewWidth * scale) / 2),
    offsetY: Math.floor((canvasHeight - viewHeight * scale) / 2)
  };
}
