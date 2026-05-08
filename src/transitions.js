export function shouldReduceMotion(game) {
  const motion = game?.settings?.motion || 'system';
  if (motion === 'off') return true;
  if (motion === 'on') return false;
  return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function motionStatusText(game) {
  const motion = game?.settings?.motion || 'system';
  if (motion === 'on') return 'Animations are forced on.';
  if (motion === 'off') return 'Animations are forced off.';
  return shouldReduceMotion(game) ? 'System is currently reducing motion.' : 'System is currently allowing motion.';
}

export function applyMotionPreference(game) {
  document.body.classList.toggle('motion-reduce', shouldReduceMotion(game));
  const ui = game?.ui;
  if (ui?.motionStatus) ui.motionStatus.textContent = motionStatusText(game);
  if (ui?.motionButtons) {
    for (const button of ui.motionButtons) {
      const active = button.dataset.motion === game.settings.motion;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
}

export function setupMotionPreference(game) {
  applyMotionPreference(game);
  const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  media?.addEventListener?.('change', () => applyMotionPreference(game));
}

const SNAPSHOT_ARTIFACT_CONTEXTS = new Set(['pause-close', 'menu-to-start']);

export function runDOMTransition(game, change, after, context = '') {
  const root = document.documentElement;
  const previousContext = root.dataset.transitionContext;
  const setContext = () => {
    if (context) root.dataset.transitionContext = context;
  };
  const clearContext = () => {
    if (!context) return;
    if (previousContext === undefined) delete root.dataset.transitionContext;
    else root.dataset.transitionContext = previousContext;
  };

  if (shouldReduceMotion(game) || SNAPSHOT_ARTIFACT_CONTEXTS.has(context) || !document.startViewTransition) {
    change();
    after?.();
    return null;
  }
  try {
    setContext();
    const transition = document.startViewTransition(change);
    transition.ready?.catch(() => {});
    transition.updateCallbackDone?.catch(() => {});
    transition.finished.catch(() => {}).finally(() => { clearContext(); after?.(); });
    return transition;
  } catch (err) {
    clearContext();
    change();
    after?.();
    return null;
  }
}
