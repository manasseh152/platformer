export const DEFAULT_VIEWPORT = Object.freeze({ minZoom: 0.25, maxZoom: 4, fitPadding: 0.95, cameraPadding: null });

export function createViewport(canvas, { minZoom = DEFAULT_VIEWPORT.minZoom, maxZoom = DEFAULT_VIEWPORT.maxZoom, cameraPadding = DEFAULT_VIEWPORT.cameraPadding } = {}) {
  return {
    canvas,
    width: canvas.clientWidth || canvas.width || 1,
    height: canvas.clientHeight || canvas.height || 1,
    dpr: 1,
    camera: { x: 0, y: 0, zoom: 1 },
    minZoom,
    maxZoom,
    cameraPadding
  };
}

export function resizeViewport(viewport) {
  const rect = viewport.canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width || viewport.canvas.clientWidth || viewport.width || 1));
  const height = Math.max(1, Math.floor(rect.height || viewport.canvas.clientHeight || viewport.height || 1));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  viewport.width = width;
  viewport.height = height;
  viewport.dpr = dpr;
  const backingWidth = Math.max(1, Math.floor(width * dpr));
  const backingHeight = Math.max(1, Math.floor(height * dpr));
  if (viewport.canvas.width !== backingWidth) viewport.canvas.width = backingWidth;
  if (viewport.canvas.height !== backingHeight) viewport.canvas.height = backingHeight;
  return viewport;
}

export function fitZoom(viewport, worldWidth, worldHeight, padding = DEFAULT_VIEWPORT.fitPadding) {
  if (worldWidth <= 0 || worldHeight <= 0) return 1;
  const zoom = Math.min(viewport.width / worldWidth, viewport.height / worldHeight) * padding;
  return clampZoom(viewport, Math.min(1, zoom));
}

export function resetView(viewport, worldWidth, worldHeight) {
  viewport.camera.zoom = fitZoom(viewport, worldWidth, worldHeight);
  viewport.camera.x = (worldWidth - viewport.width / viewport.camera.zoom) / 2;
  viewport.camera.y = (worldHeight - viewport.height / viewport.camera.zoom) / 2;
  clampCamera(viewport, worldWidth, worldHeight);
}

export function clampZoom(viewport, zoom) {
  return Math.max(viewport.minZoom, Math.min(viewport.maxZoom, Number.isFinite(zoom) ? zoom : 1));
}

export function clampCamera(viewport, worldWidth, worldHeight) {
  const visibleWidth = viewport.width / viewport.camera.zoom;
  const visibleHeight = viewport.height / viewport.camera.zoom;
  const xPadding = cameraAxisPadding(viewport, visibleWidth);
  const yPadding = cameraAxisPadding(viewport, visibleHeight);
  const xRange = cameraAxisRange(worldWidth, visibleWidth, xPadding);
  const yRange = cameraAxisRange(worldHeight, visibleHeight, yPadding);
  viewport.camera.x = clamp(viewport.camera.x, xRange.min, xRange.max);
  viewport.camera.y = clamp(viewport.camera.y, yRange.min, yRange.max);
}

export function zoomAtScreenPoint(viewport, screenX, screenY, nextZoom, worldWidth, worldHeight) {
  const before = screenToWorld(viewport, screenX, screenY);
  viewport.camera.zoom = clampZoom(viewport, nextZoom);
  viewport.camera.x = before.x - screenX / viewport.camera.zoom;
  viewport.camera.y = before.y - screenY / viewport.camera.zoom;
  clampCamera(viewport, worldWidth, worldHeight);
}

export function panByScreenDelta(viewport, dx, dy, worldWidth, worldHeight) {
  viewport.camera.x -= dx / viewport.camera.zoom;
  viewport.camera.y -= dy / viewport.camera.zoom;
  clampCamera(viewport, worldWidth, worldHeight);
}

export function screenToWorld(viewport, screenX, screenY) {
  return {
    x: viewport.camera.x + screenX / viewport.camera.zoom,
    y: viewport.camera.y + screenY / viewport.camera.zoom
  };
}

export function eventToScreenPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

export function eventToWorld(viewport, event) {
  const point = eventToScreenPoint(viewport.canvas, event);
  return screenToWorld(viewport, point.x, point.y);
}

export function visibleWorldRect(viewport) {
  return {
    x: viewport.camera.x,
    y: viewport.camera.y,
    w: viewport.width / viewport.camera.zoom,
    h: viewport.height / viewport.camera.zoom
  };
}

export function applyWorldTransform(ctx, viewport) {
  const scale = viewport.dpr * viewport.camera.zoom;
  ctx.setTransform(scale, 0, 0, scale, -viewport.camera.x * scale, -viewport.camera.y * scale);
}

export function clearViewport(ctx, viewport, color = '#090d15') {
  ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

function cameraAxisPadding(viewport, visibleSize) {
  const configuredPadding = viewport.cameraPadding ?? DEFAULT_VIEWPORT.cameraPadding;
  if (Number.isFinite(configuredPadding)) return Math.max(0, configuredPadding) / viewport.camera.zoom;
  return visibleSize / 2;
}

function cameraAxisRange(worldSize, visibleSize, padding = 0) {
  if (worldSize <= visibleSize) {
    const centered = (worldSize - visibleSize) / 2;
    return { min: centered - padding, max: centered + padding };
  }
  return { min: -padding, max: worldSize - visibleSize + padding };
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
