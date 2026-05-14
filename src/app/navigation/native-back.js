const defaultWindow = () => (typeof window === 'undefined' ? null : window);

function supportsHistory(win) {
  return Boolean(win?.history?.pushState && win?.history?.replaceState && win?.history?.back && win?.addEventListener);
}

/**
 * Bridges browser/mobile native Back to an app-owned semantic back handler.
 *
 * The adapter keeps at most one same-URL synthetic history entry while the app
 * has an internal back target. Popping that entry calls `onBack`, then re-arms
 * only if another internal back target remains. When the app closes its own
 * target by clicking/controller input, the marker is removed with one suppressed
 * history.back() so users are not trapped in stale synthetic entries.
 */
export function createNativeBackAdapter({
  window: providedWindow,
  canGoBack,
  onBack,
  stateKey = '__chibiNativeBack',
  stateValue = true
} = {}) {
  const win = providedWindow || defaultWindow();
  let armed = false;
  let suppressNextPop = false;
  let disposed = false;

  const isMarkerState = state => Boolean(state && state[stateKey] === stateValue);

  function currentUrl() {
    return `${win.location?.pathname || ''}${win.location?.search || ''}${win.location?.hash || ''}` || undefined;
  }

  function markState(state = win.history.state) {
    return { ...(state && typeof state === 'object' ? state : {}), [stateKey]: stateValue };
  }

  function sync() {
    if (disposed || !supportsHistory(win)) return false;
    const backable = Boolean(canGoBack?.());
    const currentIsMarker = isMarkerState(win.history.state);

    if (backable) {
      if (!armed || !currentIsMarker) {
        win.history.pushState(markState(), '', currentUrl());
      }
      armed = true;
      return true;
    }

    if (armed && currentIsMarker) {
      suppressNextPop = true;
      armed = false;
      win.history.back();
      return false;
    }

    armed = false;
    return false;
  }

  function handlePopState(event) {
    if (disposed) return;
    if (suppressNextPop) {
      suppressNextPop = false;
      return;
    }
    if (!armed) return;

    armed = false;
    if (!canGoBack?.()) return;
    onBack?.(event);
    if (win.queueMicrotask) win.queueMicrotask(() => sync());
    else setTimeout(sync, 0);
  }

  function dispose() {
    disposed = true;
    win?.removeEventListener?.('popstate', handlePopState);
  }

  if (supportsHistory(win)) win.addEventListener('popstate', handlePopState);

  return {
    sync,
    dispose,
    get armed() { return armed; }
  };
}
