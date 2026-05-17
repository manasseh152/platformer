import { openScenarioBrowser } from './ui/menu/menu-shell.js';

const ENABLED = import.meta.env?.VITE_ENABLE_CAPTURE_MODE === 'true';
const SUPPORTED_CAPTURES = new Set(['start-screen', 'scenario-browser']);

export function readCaptureTarget(locationRef = window.location) {
  if (!ENABLED) return null;
  const target = new URL(locationRef.href).searchParams.get('capture');
  return SUPPORTED_CAPTURES.has(target) ? target : null;
}

function markCaptureReady(target) {
  document.documentElement.dataset.captureReady = target;
  document.body.dataset.captureReady = target;
}

export function applyCaptureMode(game, runtime) {
  const target = readCaptureTarget();
  if (!target) return { enabled: false, target: null };

  document.documentElement.dataset.captureMode = target;
  document.body.dataset.captureMode = target;
  game.settings.motion = 'off';
  game.settings.developerMode = false;
  game.session.developerModeOverride = false;

  if (target === 'scenario-browser') {
    openScenarioBrowser(game, 'start');
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    markCaptureReady(target);
    runtime.emit?.('capture.ready', { target });
  }));

  return { enabled: true, target };
}
