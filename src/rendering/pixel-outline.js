function isFiniteRect(rect) {
  return rect
    && Number.isFinite(rect.x)
    && Number.isFinite(rect.y)
    && Number.isFinite(rect.w)
    && Number.isFinite(rect.h)
    && rect.w > 0
    && rect.h > 0;
}

export function normalizePixelRect(rect, { snap = true } = {}) {
  if (!isFiniteRect(rect)) return null;

  if (snap === false) return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };

  const left = Math.round(rect.x);
  const top = Math.round(rect.y);
  const right = Math.round(rect.x + rect.w);
  const bottom = Math.round(rect.y + rect.h);
  const normalized = { x: left, y: top, w: right - left, h: bottom - top };

  return normalized.w > 0 && normalized.h > 0 ? normalized : null;
}

function normalizedThickness(thickness, rect, placement) {
  const value = Number.isFinite(thickness) ? Math.round(thickness) : 1;
  const positive = Math.max(1, value);
  return placement === 'outside' ? positive : Math.min(positive, rect.w, rect.h);
}

function drawInsideOutline(ctx, rect, thickness) {
  const innerW = Math.max(0, rect.w - thickness * 2);
  const innerH = Math.max(0, rect.h - thickness * 2);

  ctx.fillRect(rect.x, rect.y, rect.w, thickness);
  ctx.fillRect(rect.x, rect.y + rect.h - thickness, rect.w, thickness);
  ctx.fillRect(rect.x, rect.y + thickness, thickness, innerH);
  ctx.fillRect(rect.x + rect.w - thickness, rect.y + thickness, thickness, innerH);
}

function drawOutsideOutline(ctx, rect, thickness) {
  ctx.fillRect(rect.x - thickness, rect.y - thickness, rect.w + thickness * 2, thickness);
  ctx.fillRect(rect.x - thickness, rect.y + rect.h, rect.w + thickness * 2, thickness);
  ctx.fillRect(rect.x - thickness, rect.y, thickness, rect.h);
  ctx.fillRect(rect.x + rect.w, rect.y, thickness, rect.h);
}

function drawOnePixelRect(ctx, sourceRect, options) {
  const rect = normalizePixelRect(sourceRect, options);
  if (!rect) return;

  if (options.fill) {
    ctx.fillStyle = options.fill;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  const outline = options.outline ?? options.color;
  if (!outline) return;

  const placement = options.placement === 'outside' ? 'outside' : 'inside';
  const thickness = normalizedThickness(options.thickness, rect, placement);
  ctx.fillStyle = outline;

  if (placement === 'outside') drawOutsideOutline(ctx, rect, thickness);
  else drawInsideOutline(ctx, rect, thickness);
}

export function drawPixelRect(ctx, rectOrRects, options = {}) {
  if (!ctx) return;
  const rects = Array.isArray(rectOrRects) ? rectOrRects : [rectOrRects];
  if (!rects.length) return;

  ctx.save();
  try {
    for (const rect of rects) drawOnePixelRect(ctx, rect, options);
  } finally {
    ctx.restore();
  }
}
