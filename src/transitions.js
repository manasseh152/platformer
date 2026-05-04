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

export function runDOMTransition(game, change, after) {
  if (shouldReduceMotion(game) || !document.startViewTransition) {
    change();
    after?.();
    return null;
  }
  try {
    const transition = document.startViewTransition(change);
    transition.ready?.catch(() => {});
    transition.updateCallbackDone?.catch(() => {});
    transition.finished.catch(() => {}).finally(() => after?.());
    return transition;
  } catch (err) {
    change();
    after?.();
    return null;
  }
}
