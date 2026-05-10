import { computePresentationViewport } from '../../engine/render/viewport.js';

export function createPresentationViewportState(nativeWidth, nativeHeight, initialBackbufferWidth = nativeWidth, initialBackbufferHeight = nativeHeight) {
  return {
    nativeWidth,
    nativeHeight,
    viewport: computePresentationViewport(initialBackbufferWidth, initialBackbufferHeight, nativeWidth, nativeHeight),
    resize(backbufferWidth, backbufferHeight) {
      this.viewport = computePresentationViewport(backbufferWidth, backbufferHeight, nativeWidth, nativeHeight);
      return this.viewport;
    }
  };
}

/**
 * @deprecated Kept for first-pass compatibility with the old presenter facade.
 * Prefer concrete backends in this directory.
 */
export function createLegacyPresenterPresentationBackend(presenter) {
  return {
    kind: 'legacy-presenter-presentation-backend',
    resize(backbufferWidth, backbufferHeight, nativeWidth, nativeHeight) {
      presenter.viewport = computePresentationViewport(backbufferWidth, backbufferHeight, nativeWidth, nativeHeight);
    },
    present(source) {
      presenter.presentNativeFrame?.(source) ?? presenter.present(0, 0);
    }
  };
}
