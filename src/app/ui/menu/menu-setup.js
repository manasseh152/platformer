import { renderInputHints } from '../../input/input-presentation.js';
import { syncHintLayer } from '../hint-layer.js';
import { setPausedFlag } from '../../game-state.js';
import { setupMotionPreference } from '../transitions.js';
import { renderSettings } from '../settings/settings-view.js';
import { browserRuntime } from '../../runtime/browser-runtime.js';
import { renderSelectedTilemapSummary, selectScenario, setLevelSelectTab } from '../scenario-browser.js';
import { handleSettingsActionsClick } from '../settings/settings-actions.js';
import { setStarted } from '../../app-state.js';
import {
  closeScenarioBrowser,
  createMenuShellCallbacks,
  focusAndReveal,
  goBack,
  openScenarioBrowser,
  openSettings,
  returnToMainMenu,
  setMenuPage,
  setPaused,
  setSettingsTab,
  startGame,
  updateMenuChrome
} from './menu-shell.js';
import { activateSemanticMenuAction } from './menu-input.js';

function handleSettingsClick(game, e, runtime = browserRuntime) {
  const tabButton = e.target.closest('button[data-level-select-tab]');
  if (tabButton) return setLevelSelectTab(game, tabButton.dataset.levelSelectTab, el => focusAndReveal(game, el));
  const editDraft = e.target.closest('button[data-local-draft-edit]')?.dataset.localDraftEdit;
  if (editDraft) return window.location.assign(`/editor.html?draft=${encodeURIComponent(editDraft)}`);
  if (e.target.closest('[data-open-map-editor]')) return window.location.assign('/editor.html');
  const scenarioButton = e.target.closest('button[data-scenario-id]');
  if (scenarioButton) return selectScenario(game, scenarioButton.dataset.scenarioId, { closeScenarioBrowser });
  if (e.target.closest('[data-level-select-back]')) return goBack(game);
  const settingsTab = e.target.closest('button[data-settings-tab]');
  if (settingsTab) return setSettingsTab(game, settingsTab.dataset.settingsTab);
  const categoryButton = e.target.closest('[data-settings-category]');
  if (categoryButton) return setMenuPage(game, 'settings-category', 'forward', categoryButton.dataset.settingsCategory);
  const backButton = e.target.closest('[data-settings-back]');
  if (backButton) return goBack(game);
  return handleSettingsActionsClick(game, e, runtime, createMenuShellCallbacks());
}

/** Wires browser DOM events for the menu shell and settings/scenario delegated actions. */
export function setupMenu(game, runtime = browserRuntime) {
  const { ui } = game;
  setupMotionPreference(game);
  renderSettings(game);
  updateMenuChrome(game);
  renderInputHints(game.input, document, game);
  syncHintLayer(game);

  for (let i = 0; i < 5; i++) {
    const heart = document.createElement('span');
    heart.className = 'heart full';
    ui.heartsEl.appendChild(heart);
  }

  addEventListener('focusin', e => {
    game.menu.lastFocused = e.target;
    document.querySelectorAll('.controller-focus').forEach(node => { if (node !== e.target) node.classList.remove('controller-focus'); });
  });

  renderSelectedTilemapSummary(game);

  ui.startButton.addEventListener('click', () => startGame(game, runtime));
  ui.startLevelSelectButton.addEventListener('click', () => openScenarioBrowser(game, 'start'));
  ui.startEditorButton.addEventListener('click', () => window.location.assign('/editor'));
  ui.startSettingsButton.addEventListener('click', () => openSettings(game, 'start'));
  ui.resumeButton.addEventListener('click', () => setPaused(game, false, runtime));
  ui.restartButton.addEventListener('click', () => game.resetGame());
  ui.mainMenuButton.addEventListener('click', () => returnToMainMenu(game, runtime));
  ui.levelSelectButton.addEventListener('click', () => openScenarioBrowser(game, 'pause'));
  ui.settingsButton.addEventListener('click', () => openSettings(game, 'pause'));
  ui.messageRestartButton.addEventListener('click', () => game.resetGame());
  ui.messageNextLevelButton.addEventListener('click', () => {
    const result = game.tilemaps.switchToNextTilemap();
    if (!result.ok) return;
    setPausedFlag(game, false, runtime);
    setStarted(game, true);
    runtime.emit('game.next-level', { tilemapId: game.tilemap?.id || null });
    document.body.classList.add('playing');
    document.body.classList.remove('game-won', 'game-over');
    game.canvas.focus?.({ preventScroll: true });
  });
  ui.messageLevelSelectButton.addEventListener('click', () => {
    setPausedFlag(game, true, runtime);
    openScenarioBrowser(game, 'pause');
  });
  const handleHintActivation = e => {
    const hintAction = e.target.closest('[data-input-clickable="true"]')?.dataset.inputAction;
    return Boolean(hintAction && activateSemanticMenuAction(game, hintAction));
  };
  ui.startScreen.addEventListener('click', e => { handleHintActivation(e); });
  ui.startScreen.addEventListener('keydown', e => {
    if (!['Enter', 'Space'].includes(e.code) || !handleHintActivation(e)) return;
    e.preventDefault();
  });
  ui.pauseScreen.addEventListener('click', e => { if (!handleHintActivation(e)) handleSettingsClick(game, e, runtime); });
  ui.pauseScreen.addEventListener('keydown', e => {
    if (!['Enter', 'Space'].includes(e.code) || !handleHintActivation(e)) return;
    e.preventDefault();
  });
  ui.hintLayerEl?.addEventListener('click', e => { handleHintActivation(e); });
  ui.hintLayerEl?.addEventListener('keydown', e => {
    if (!['Enter', 'Space'].includes(e.code) || !handleHintActivation(e)) return;
    e.preventDefault();
  });

  requestAnimationFrame(() => focusAndReveal(game, ui.startButton));
}
