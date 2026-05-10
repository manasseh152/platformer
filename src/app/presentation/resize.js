import { RESIZE_DEBOUNCE_MS } from '../../core/constants.js';
import { isStarted } from '../app-state.js';

function syncPresentationViewportMirror(game, viewport) {
  game.view.scale = 1;
  game.view.offsetX = 0;
  game.view.offsetY = 0;
  game.view.displayScale = viewport.scale;
  game.view.displayOffsetX = viewport.offsetX;
  game.view.displayOffsetY = viewport.offsetY;
  game.canvas.dataset.presentationScale = String(viewport.scale);
  game.canvas.dataset.presentationOffsetX = String(viewport.offsetX);
  game.canvas.dataset.presentationOffsetY = String(viewport.offsetY);
}

export function applyPresentationResize(game) {
  const rect = game.canvas.getBoundingClientRect();
  game.view.dpr = window.devicePixelRatio || 1;
  game.canvas.width = Math.max(1, Math.round(rect.width * game.view.dpr));
  game.canvas.height = Math.max(1, Math.round(rect.height * game.view.dpr));
  const viewport = game.presentation.resize(game.canvas.width, game.canvas.height);
  syncPresentationViewportMirror(game, viewport);
  game.ctx.imageSmoothingEnabled = false;
  game.canvas.classList.remove('resizing');
  game.view.firstResizeDone = true;
}

export function schedulePresentationResize(game) {
  if (!game.view.firstResizeDone) return applyPresentationResize(game);
  if (isStarted(game)) game.canvas.classList.add('resizing');
  clearTimeout(game.view.resizeDebounce);
  game.view.resizeDebounce = setTimeout(() => applyPresentationResize(game), RESIZE_DEBOUNCE_MS);
}

export function setupPresentationResize(game) {
  new ResizeObserver(() => schedulePresentationResize(game)).observe(game.canvas);
  addEventListener('resize', () => schedulePresentationResize(game));
  applyPresentationResize(game);
}
