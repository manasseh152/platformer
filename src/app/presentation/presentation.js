import { computePresentationViewport } from '../../engine/render/viewport.js';
import { createCanvas2DPresentationBackend } from '../../render/presentation/canvas2d-presentation-backend.js';
import { createWebGlPresentationBackend } from '../../render/presentation/webgl-presentation-backend.js';

function makeRenderCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function nativeFrameSourceFromCanvas(canvas) {
  return { kind: 'canvas2d', width: canvas.width, height: canvas.height, canvas };
}

function createDefaultPresentationBackend(canvas) {
  try {
    return createWebGlPresentationBackend(canvas) || createCanvas2DPresentationBackend(canvas);
  } catch (error) {
    console.warn('WebGL presentation unavailable; falling back to 2D canvas.', error);
    return createCanvas2DPresentationBackend(canvas);
  }
}

function syncDebugNativeFrameCanvas(renderCanvas, visible) {
  if (!visible) {
    renderCanvas.remove?.();
    return;
  }
  renderCanvas.id = 'nativeFrameDebugCanvas';
  renderCanvas.dataset.debugNativeFrame = 'true';
  Object.assign(renderCanvas.style, {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    width: `${renderCanvas.width}px`,
    height: `${renderCanvas.height}px`,
    imageRendering: 'pixelated',
    zIndex: '10000',
    border: '1px solid rgba(255,255,255,.45)',
    background: '#080b11',
    pointerEvents: 'none'
  });
  if (!renderCanvas.isConnected) document.body.append(renderCanvas);
}

export function createPresentation(canvas, width, height) {
  const renderCanvas = makeRenderCanvas(width, height);
  const renderCtx = renderCanvas.getContext('2d');
  renderCtx.imageSmoothingEnabled = false;

  let backend = createDefaultPresentationBackend(canvas);
  let viewport = computePresentationViewport(canvas.width, canvas.height, width, height);
  let debugNativeFrameVisible = false;

  return {
    canvas,
    renderCanvas,
    renderCtx,
    get backend() { return backend; },
    get mode() { return backend.mode; },
    get viewport() { return viewport; },
    async tryEnableWebGpu(gpuSystem) {
      if (backend.mode === 'webgpu') return true;
      try {
        const gpuContext = await gpuSystem?.ready;
        if (!gpuContext?.enabled) return false;
        const { createWebGpuPresentationBackend } = await import('../../render/presentation/webgpu-presentation-backend.js');
        const webgpu = await createWebGpuPresentationBackend(canvas, gpuContext);
        if (!webgpu) return false;
        backend.destroy?.();
        backend = webgpu;
        return true;
      } catch (error) {
        console.warn('WebGPU presentation unavailable; keeping current presentation backend.', error);
        return false;
      }
    },
    resize(displayWidth, displayHeight) {
      viewport = computePresentationViewport(displayWidth, displayHeight, width, height);
      if (debugNativeFrameVisible) syncDebugNativeFrameCanvas(renderCanvas, true);
      return viewport;
    },
    present(source = nativeFrameSourceFromCanvas(renderCanvas), options = {}) {
      backend.present(source, viewport, options);
    },
    presentRenderCanvas(options = {}) {
      this.present(nativeFrameSourceFromCanvas(renderCanvas), options);
    },
    setNativeFrameDebugVisible(visible) {
      debugNativeFrameVisible = Boolean(visible);
      syncDebugNativeFrameCanvas(renderCanvas, debugNativeFrameVisible);
    },
    getNativeFrameDebugVisible() {
      return debugNativeFrameVisible;
    },
    destroy() {
      backend.destroy?.();
      renderCanvas.remove?.();
    }
  };
}
