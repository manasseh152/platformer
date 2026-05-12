import { isWon } from '../app-state.js';
import { formatRunTime, getBestTime } from '../speedrun/speedrun.js';
import { syncHintLayer } from './hint-layer.js';
import { isTilemapPreviewActive } from '../tilemaps/tilemap-preview.js';

export function syncGameplayHud(game) {
  const { ui, player } = game;
  if (ui.hudLevelName) ui.hudLevelName.textContent = game.tilemap?.name || 'Unknown Level';
  [...ui.heartsEl.children].forEach((heart, i) => heart.classList.toggle('full', i < player.hp));
  ui.dashStatusEl.classList.toggle('ready', player.dashCooldown <= 0);
  const speedRunEnabled = Boolean(game.settings?.speedRunMode);
  if (ui.speedRunHud) ui.speedRunHud.hidden = !speedRunEnabled;
  if (speedRunEnabled) {
    const attempt = game.speedRun?.attempt;
    const elapsed = game.speedRun?.lastResult?.bestMs ?? attempt?.elapsedMs ?? 0;
    const bestMs = getBestTime(game.speedRun, game.tilemap?.id || '');
    if (ui.speedRunTimer) ui.speedRunTimer.textContent = formatRunTime(elapsed);
    if (ui.speedRunBest) ui.speedRunBest.textContent = `Best ${bestMs === null ? '--:--.---' : formatRunTime(bestMs)}`;
  }
  const won = isWon(game);
  const showingEndMessage = player.dead || won;
  ui.messageEl.hidden = !showingEndMessage;
  ui.messageTitleEl.textContent = won ? 'Gate Reached!' : 'You Faded';
  if (ui.messageSpeedRun) {
    const result = speedRunEnabled && won ? game.speedRun?.lastResult : null;
    ui.messageSpeedRun.hidden = !result;
    ui.messageSpeedRun.textContent = result ? `Speed Run: ${formatRunTime(result.bestMs)} — ${result.isNewBest ? 'New Best!' : `Best ${formatRunTime(result.previousBestMs)}`}` : '';
  }
  const preview = isTilemapPreviewActive(game);
  if (ui.messageNextLevelButton) {
    const campaignEligible = !game.scenarios?.current || game.scenarios.current.source === 'campaigns';
    const nextLevel = !preview && won && campaignEligible ? game.tilemaps.getNextTilemap() : null;
    ui.messageNextLevelButton.hidden = !nextLevel;
    ui.messageNextLevelButton.textContent = nextLevel ? `Play ${nextLevel.name}` : 'Play Next';
  }
  if (ui.messageLevelSelectButton) ui.messageLevelSelectButton.hidden = preview;
  if (ui.messageCloseButton) ui.messageCloseButton.hidden = !preview;
  if (ui.messageRestartButton) {
    ui.messageRestartButton.classList.toggle('ds-button--primary', preview);
    ui.messageRestartButton.classList.toggle('ds-button--secondary', !preview);
  }
  if (showingEndMessage && !game.endMessageWasVisible) {
    game.endMessageWasVisible = true;
    requestAnimationFrame(() => {
      const firstAction = ui.messageEl.querySelector('button:not([hidden]):not(:disabled)');
      firstAction?.focus?.({ preventScroll: true });
      firstAction?.classList.add('controller-focus');
    });
  } else if (!showingEndMessage) {
    game.endMessageWasVisible = false;
  }
  document.body.classList.toggle('game-over', player.dead);
  document.body.classList.toggle('game-won', won);
}

export function syncGameplayHudPresentation(game) {
  syncGameplayHud(game);
  syncHintLayer(game);
}
