export function computePresentationViewport(backbufferWidth, backbufferHeight, nativeWidth, nativeHeight, { smallViewport = 'soft-fit' } = {}) {
  const rawScale = Math.min(backbufferWidth / nativeWidth, backbufferHeight / nativeHeight);
  let scale;
  if (rawScale < 1) {
    if (smallViewport === 'hide-or-error') throw new Error('Backbuffer is smaller than native frame');
    scale = smallViewport === 'soft-fit' ? rawScale : 1;
  } else {
    scale = Math.max(1, Math.floor(rawScale));
  }
  const width = nativeWidth * scale;
  const height = nativeHeight * scale;
  return {
    scale,
    width,
    height,
    offsetX: Math.floor((backbufferWidth - width) / 2),
    offsetY: Math.floor((backbufferHeight - height) / 2)
  };
}

export function prepareRenderView({ camera, viewWidth, viewHeight, bufferWidth, bufferHeight, shake = 0, random = Math.random }) {
  const worldToNativeX = bufferWidth / viewWidth;
  const worldToNativeY = bufferHeight / viewHeight;
  const shakeX = Math.round((random() - 0.5) * shake * 24);
  const shakeY = Math.round((random() - 0.5) * shake * 24);
  const desiredCameraX = (camera?.x ?? 0) - shakeX;
  const desiredCameraY = (camera?.y ?? 0) - shakeY;
  const cameraX = Math.round(desiredCameraX * worldToNativeX) / worldToNativeX;
  const cameraY = Math.round(desiredCameraY * worldToNativeY) / worldToNativeY;
  return {
    worldWidth: viewWidth,
    worldHeight: viewHeight,
    bufferWidth,
    bufferHeight,
    worldToNativeX,
    worldToNativeY,
    cameraX,
    cameraY,
    desiredCameraX,
    desiredCameraY,
    shakeX,
    shakeY,
    subpixelOffsetX: (cameraX - desiredCameraX) * worldToNativeX,
    subpixelOffsetY: (cameraY - desiredCameraY) * worldToNativeY
  };
}

export function worldToNativeRect(view, rect) {
  const left = Math.round((rect.x - view.cameraX) * view.worldToNativeX);
  const top = Math.round((rect.y - view.cameraY) * view.worldToNativeY);
  const right = Math.round((rect.x + rect.w - view.cameraX) * view.worldToNativeX);
  const bottom = Math.round((rect.y + rect.h - view.cameraY) * view.worldToNativeY);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function worldToNativePoint(view, x, y) {
  return {
    x: (x - view.cameraX) * view.worldToNativeX,
    y: (y - view.cameraY) * view.worldToNativeY
  };
}
