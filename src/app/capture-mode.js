import { centerCameraOnPlayer } from '#/core/camera.js';
import { openScenarioBrowser, startGame } from './ui/menu/menu-shell.js';

const ENABLED = import.meta.env?.VITE_ENABLE_CAPTURE_MODE === 'true';
const SUPPORTED_CAPTURES = new Set(['start-screen', 'scenario-browser', 'campaign-gameplay']);

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

  if (target === 'campaign-gameplay') {
    game.scenarios.select('act-01-level-3');
    game.scenarios.launch('act-01-level-3', { origin: 'capture-mode' });
    startGame(game, runtime);
    Object.assign(game.player, { x: 96, y: 592, vx: 0, vy: 0, dir: 1, dead: false });
    if (game.camera) {
      game.camera.mode = 'follow';
      centerCameraOnPlayer(game.camera, game.player, game.view, game.tilemap?.worldWidth, game.tilemap?.worldHeight);
    }
    document.body.dataset.tilemapId = 'act-01-level-3';
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    markCaptureReady(target);
    runtime.emit?.('capture.ready', { target });
  }));

  return { enabled: true, target };
}
