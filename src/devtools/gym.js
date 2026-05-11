import { clampCameraToWorld } from '../core/camera.js';

function gymSnapshot(game) {
  return game.gym?.snapshot?.() ?? null;
}

function gymInspectionState(game) {
  game.devTools.flags.gymInspection ??= { freeCamera: false, focusedMachineId: null };
  return game.devTools.flags.gymInspection;
}

function machineSummary(game) {
  const gym = gymSnapshot(game);
  if (!gym) return 'No active gym';
  if (!gym.machines.length) return 'No machines';
  return gym.machines.map(machine => `${machine.label}: ${machine.status}`).join(', ');
}

function focusedMachine(game) {
  const gym = gymSnapshot(game);
  if (!gym?.machines?.length) return null;
  const inspection = gymInspectionState(game);
  return gym.machines.find(machine => machine.id === inspection.focusedMachineId) ?? gym.machines[0];
}

function focusedMachineSummary(game) {
  const machine = focusedMachine(game);
  return machine ? `${machine.label}: ${machine.status}` : 'No machine focus';
}

function setCameraMode(game, mode) {
  if (!game.camera) return;
  game.camera.mode = mode;
  if (mode === 'follow') gymInspectionState(game).freeCamera = false;
}

function centerCameraOnWorldPoint(game, x, y) {
  if (!game.camera || !game.view) return;
  game.camera.x = x - game.view.width / 2;
  game.camera.y = y - game.view.height / 2;
  game.camera.targetX = game.camera.x;
  game.camera.targetY = game.camera.y;
  clampCameraToWorld(game.camera, game.view, game.tilemap?.worldWidth, game.tilemap?.worldHeight);
}

function machineWorldPoint(game, machine) {
  const observations = machine?.observations ?? {};
  const x = observations.x ?? observations.endX ?? observations.startX;
  const y = observations.y ?? observations.startY;
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  if (game.player) return { x: game.player.x + game.player.w / 2, y: game.player.y + game.player.h / 2 };
  return { x: game.view.width / 2, y: game.view.height / 2 };
}

function focusMachine(game, machine) {
  if (!machine) return;
  const inspection = gymInspectionState(game);
  inspection.focusedMachineId = machine.id;
  setCameraMode(game, 'gym-inspect');
  centerCameraOnWorldPoint(game, machineWorldPoint(game, machine).x, machineWorldPoint(game, machine).y);
}

function focusNextMachine(game) {
  const gym = gymSnapshot(game);
  if (!gym?.machines?.length) return;
  const inspection = gymInspectionState(game);
  const currentIndex = gym.machines.findIndex(machine => machine.id === inspection.focusedMachineId);
  const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 1;
  const next = gym.machines[nextIndex % gym.machines.length];
  focusMachine(game, next);
}

function toggleFreeCamera(game, enabled) {
  const inspection = gymInspectionState(game);
  inspection.freeCamera = Boolean(enabled);
  setCameraMode(game, enabled ? 'free' : 'follow');
}

function nudgeFreeCamera(game, dx, dy) {
  if (!game.camera) return;
  gymInspectionState(game).freeCamera = true;
  setCameraMode(game, 'free');
  centerCameraOnWorldPoint(game, game.camera.x + game.view.width / 2 + dx, game.camera.y + game.view.height / 2 + dy);
}

export function registerGymDevTools(game) {
  game.devTools.registry.registerSection({
    id: 'gym',
    title: 'Gym',
    order: 25,
    items: [
      { id: 'status', kind: 'value', label: 'Gym status', get: game => gymSnapshot(game)?.status ?? 'No active gym' },
      { id: 'machines', kind: 'value', label: 'Machines', get: machineSummary },
      { id: 'focused-machine', kind: 'value', label: 'Focused machine', get: focusedMachineSummary },
      { id: 'free-camera', kind: 'toggle', label: 'Free camera', get: game => gymInspectionState(game).freeCamera, set: toggleFreeCamera },
      { id: 'focus-next-machine', kind: 'button', label: 'Focus next machine', run: focusNextMachine },
      { id: 'camera-left', kind: 'button', label: 'Camera left', run: game => nudgeFreeCamera(game, -128, 0) },
      { id: 'camera-right', kind: 'button', label: 'Camera right', run: game => nudgeFreeCamera(game, 128, 0) },
      { id: 'camera-up', kind: 'button', label: 'Camera up', run: game => nudgeFreeCamera(game, 0, -96) },
      { id: 'camera-down', kind: 'button', label: 'Camera down', run: game => nudgeFreeCamera(game, 0, 96) },
      { id: 'follow-player', kind: 'button', label: 'Follow player', run: game => setCameraMode(game, 'follow') },
      { id: 'start-all', kind: 'button', label: 'Start all machines', run: (game, runtime) => game.gym?.startAll?.(runtime) },
      { id: 'pause-all', kind: 'button', label: 'Pause all machines', run: (game, runtime) => game.gym?.pauseAll?.(runtime) },
      { id: 'reset-all', kind: 'button', label: 'Reset all machines', run: (game, runtime) => game.gym?.resetAll?.(runtime) }
    ]
  });
}
