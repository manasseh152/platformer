export function createCanvas2DPresentationBackend(canvas, { letterboxColor = '#080b11' } = {}) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  return {
    kind: 'canvas2d-presentation-backend',
    mode: '2d',
    canvas,
    ctx,
    present(source, viewport, { subpixelOffsetX = 0, subpixelOffsetY = 0 } = {}) {
      if (source.kind !== 'canvas2d') throw new Error(`Unsupported native frame source: ${source.kind}`);
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = letterboxColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        source.canvas,
        viewport.offsetX + subpixelOffsetX * viewport.scale,
        viewport.offsetY + subpixelOffsetY * viewport.scale,
        Math.round(source.width * viewport.scale),
        Math.round(source.height * viewport.scale)
      );
    }
  };
}
