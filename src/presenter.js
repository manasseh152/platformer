import { computePresentationViewport } from './engine/render/viewport.js';
import { createCanvas2DPresentationBackend } from './render/presentation/canvas2d-presentation-backend.js';
import { createWebGlPresentationBackend } from './render/presentation/webgl-presentation-backend.js';

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

/**
 * @deprecated Compatibility facade. New rendering code should use native-frame
 * backends plus render/presentation/* backends directly.
 */
export function createPresenter(canvas, width, height) {
  const renderCanvas = makeRenderCanvas(width, height);
  const renderCtx = renderCanvas.getContext('2d');
  renderCtx.imageSmoothingEnabled = false;

  let presentationBackend = createDefaultPresentationBackend(canvas);
  let debugNativeFrameVisible = false;

  const presenter = {
    canvas,
    renderCanvas,
    renderCtx,
    viewport: computePresentationViewport(canvas.width, canvas.height, width, height),
    get presentationBackend() { return presentationBackend; },
    get mode() { return presentationBackend.mode; },
    set mode(_) {},
    async tryEnableWebGpu(gpuSystem) {
      if (presentationBackend.mode === 'webgpu') return true;
      try {
        const gpuContext = await gpuSystem?.ready;
        if (!gpuContext?.enabled) return false;
        const { createWebGpuPresentationBackend } = await import('./render/presentation/webgpu-presentation-backend.js');
        const webgpu = await createWebGpuPresentationBackend(canvas, gpuContext);
        if (!webgpu) return false;
        presentationBackend.destroy?.();
        presentationBackend = webgpu;
        return true;
      } catch (error) {
        console.warn('WebGPU presentation unavailable; keeping current presenter.', error);
        return false;
      }
    },
    resize(displayWidth, displayHeight) {
      this.viewport = computePresentationViewport(displayWidth, displayHeight, width, height);
    },
    presentNativeFrame(source = nativeFrameSourceFromCanvas(renderCanvas), options = {}) {
      presentationBackend.present(source, this.viewport, options);
    },
    present(subpixelOffsetX = 0, subpixelOffsetY = 0) {
      this.presentNativeFrame(nativeFrameSourceFromCanvas(renderCanvas), { subpixelOffsetX, subpixelOffsetY });
    },
    setNativeFrameDebugVisible(visible) {
      debugNativeFrameVisible = Boolean(visible);
      syncDebugNativeFrameCanvas(renderCanvas, debugNativeFrameVisible);
    },
    getNativeFrameDebugVisible() {
      return debugNativeFrameVisible;
    }
  };

  presenter.presentation = {
    get backend() { return presentationBackend; },
    get viewport() { return presenter.viewport; },
    present(source, options) { presenter.presentNativeFrame(source, options); },
    resize(displayWidth, displayHeight) { presenter.resize(displayWidth, displayHeight); }
  };

  return presenter;
}
