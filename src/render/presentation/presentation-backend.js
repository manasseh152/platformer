import { computePresentationViewport } from '../../engine/render/viewport.js';

export function createLegacyPresenterPresentationBackend(presenter) {
  return {
    resize(backbufferWidth, backbufferHeight, nativeWidth, nativeHeight) {
      presenter.viewport = computePresentationViewport(backbufferWidth, backbufferHeight, nativeWidth, nativeHeight);
    },
    present(source) {
      if (source.kind !== 'canvas2d') throw new Error(`Unsupported native frame source: ${source.kind}`);
      const previousCanvas = presenter.renderCanvas;
      presenter.renderCanvas = source.canvas;
      try { presenter.present(0, 0); }
      finally { presenter.renderCanvas = previousCanvas; }
    }
  };
}
