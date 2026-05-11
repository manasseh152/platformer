export function visibleFocusables(root) {
  return [...root.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')]
    .filter(el => el.getAttribute('role') !== 'tab')
    .filter(el => !el.closest('details:not([open])'))
    .filter(el => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return el.offsetParent !== null && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    });
}

export function currentFocusElement(root, fallback = null) {
  const active = document.activeElement;
  if (active && root?.contains(active)) return active;
  if (fallback && root?.contains(fallback)) return fallback;
  return active;
}

export function ensureMenuFocus(root, fallback, focusElement) {
  if (!root) return false;
  if (!root.contains(document.activeElement) && !root.contains(fallback)) {
    const first = visibleFocusables(root)[0];
    if (first) {
      focusElement(first);
      return true;
    }
  }
  return false;
}

export function moveLinearFocus(root, fallback, direction, focusElement) {
  if (!root) return false;
  const items = visibleFocusables(root);
  if (!items.length) return false;
  const current = items.indexOf(currentFocusElement(root, fallback));
  focusElement(items[current < 0 ? 0 : (current + direction + items.length) % items.length]);
  return true;
}

export function moveHorizontalGroupFocus(root, fallback, direction, focusElement) {
  const current = currentFocusElement(root, fallback);
  const group = current?.closest?.('.ds-action-row, .segmented, .level-select-tabs, .settings-tabs');
  if (!group) return false;
  const items = visibleFocusables(group);
  const index = items.indexOf(current);
  if (items.length < 2 || index < 0) return false;
  focusElement(items[(index + direction + items.length) % items.length]);
  return true;
}
