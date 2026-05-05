export function createAppState() {
  return { started: false, paused: false };
}

export function isStarted(game) {
  return Boolean(game.appState?.started);
}

export function setStarted(game, value) {
  if (!game.appState) game.appState = createAppState();
  game.appState.started = Boolean(value);
}

export function isPaused(game) {
  return Boolean(game.appState?.paused);
}

export function setPausedState(game, value) {
  if (!game.appState) game.appState = createAppState();
  game.appState.paused = Boolean(value);
}

export function isWon(game) {
  return game.gameplaySession?.outcome === 'completed';
}
