function gymSnapshot(game) {
  return game.gym?.snapshot?.() ?? null;
}

function machineSummary(game) {
  const gym = gymSnapshot(game);
  if (!gym) return 'No active gym';
  if (!gym.machines.length) return 'No machines';
  return gym.machines.map(machine => `${machine.label}: ${machine.status}`).join(', ');
}

export function registerGymDevTools(game) {
  game.devTools.registry.registerSection({
    id: 'gym',
    title: 'Gym',
    order: 25,
    items: [
      { id: 'status', kind: 'value', label: 'Gym status', get: game => gymSnapshot(game)?.status ?? 'No active gym' },
      { id: 'machines', kind: 'value', label: 'Machines', get: machineSummary },
      { id: 'start-all', kind: 'button', label: 'Start all machines', run: (game, runtime) => game.gym?.startAll?.(runtime) },
      { id: 'pause-all', kind: 'button', label: 'Pause all machines', run: (game, runtime) => game.gym?.pauseAll?.(runtime) },
      { id: 'reset-all', kind: 'button', label: 'Reset all machines', run: (game, runtime) => game.gym?.resetAll?.(runtime) }
    ]
  });
}
