import { RESIZE_DEBOUNCE_MS } from './constants.js';
import { calculateViewport } from './viewport.js';

export function applyResize(game) {
  const rect = game.canvas.getBoundingClientRect();
  game.view.dpr = window.devicePixelRatio || 1;
  game.canvas.width = Math.max(1, Math.round(rect.width * game.view.dpr));
  game.canvas.height = Math.max(1, Math.round(rect.height * game.view.dpr));
  const viewport = calculateViewport(game.canvas.width, game.canvas.height, game.view.bufferWidth, game.view.bufferHeight);
  game.view.scale = 1;
  game.view.offsetX = 0;
  game.view.offsetY = 0;
  game.view.displayScale = viewport.scale;
  game.view.displayOffsetX = viewport.offsetX;
  game.view.displayOffsetY = viewport.offsetY;
  game.presenter.resize(game.canvas.width, game.canvas.height);
  game.ctx.imageSmoothingEnabled = false;
  game.canvas.classList.remove('resizing');
  game.view.firstResizeDone = true;
}

export function scheduleResize(game) {
  if (!game.view.firstResizeDone) return applyResize(game);
  if (game.flags.started) game.canvas.classList.add('resizing');
  clearTimeout(game.view.resizeDebounce);
  game.view.resizeDebounce = setTimeout(() => applyResize(game), RESIZE_DEBOUNCE_MS);
}

export function setupResize(game) {
  new ResizeObserver(() => scheduleResize(game)).observe(game.canvas);
  addEventListener('resize', () => scheduleResize(game));
  applyResize(game);
}
