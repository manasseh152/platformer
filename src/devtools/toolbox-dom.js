import { isPaused, isStarted, isWon } from '../app/app-state.js';

const VALUE_REFRESH_MS = 250;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function itemKey(section, item) {
  return `${section.id}.${item.id}`;
}

export function isDevToolsEligible(game) {
  return Boolean(game.settings?.developerMode && isStarted(game) && !isPaused(game) && !game.player?.dead && !isWon(game));
}

function itemValue(game, item) {
  try { return item.get(game); } catch (err) { return `Error: ${err.message}`; }
}

function renderItem(game, section, item) {
  const key = itemKey(section, item);
  if (item.kind === 'toggle') {
    const checked = Boolean(itemValue(game, item));
    return `<label class="devtool-row devtool-row--toggle" data-devtool-item="${escapeHtml(key)}">
      <span class="devtool-row__copy"><span class="devtool-row__label">${escapeHtml(item.label)}</span></span>
      <input type="checkbox" data-devtool-toggle="${escapeHtml(key)}"${checked ? ' checked' : ''}>
    </label>`;
  }
  if (item.kind === 'button') {
    return `<button type="button" class="devtool-row devtool-row--button" data-devtool-button="${escapeHtml(key)}">
      <span class="devtool-row__copy"><span class="devtool-row__label">${escapeHtml(item.label)}</span></span>
      <span class="devtool-row__value">Run</span>
    </button>`;
  }
  return `<div class="devtool-row devtool-row--value" data-devtool-item="${escapeHtml(key)}">
    <span class="devtool-row__copy"><span class="devtool-row__label">${escapeHtml(item.label)}</span></span>
    <span class="devtool-row__value" data-devtool-value="${escapeHtml(key)}">${escapeHtml(itemValue(game, item))}</span>
  </div>`;
}

function renderPanel(game) {
  const sections = game.devTools.registry.getSections();
  if (!sections.length) return '<p class="devtool-empty">No tools registered.</p>';
  return sections.map(section => `<section class="devtool-section" data-devtool-section="${escapeHtml(section.id)}">
    <h3>${escapeHtml(section.title)}</h3>
    <div class="devtool-section__items">${section.items.map(item => renderItem(game, section, item)).join('')}</div>
  </section>`).join('');
}

function findRegisteredItem(game, key) {
  for (const section of game.devTools.registry.getSections()) {
    for (const item of section.items) if (itemKey(section, item) === key) return item;
  }
  return null;
}

function focusAfterClose(game) {
  const button = game.devTools.elements.button;
  if (button && !button.hidden) button.focus({ preventScroll: true });
  else game.canvas?.focus?.({ preventScroll: true });
}

export function openDevTools(game) {
  if (!isDevToolsEligible(game)) return false;
  game.devTools.open = true;
  syncDevTools(game, { forceRender: true });
  const panel = game.devTools.elements.panel;
  requestAnimationFrame(() => panel?.focus?.({ preventScroll: true }));
  return true;
}

export function closeDevTools(game, { restoreFocus = true } = {}) {
  if (!game.devTools?.open) return false;
  game.devTools.open = false;
  syncDevTools(game);
  if (restoreFocus) focusAfterClose(game);
  return true;
}

export function toggleDevTools(game) {
  return game.devTools?.open ? closeDevTools(game) : openDevTools(game);
}

function refreshValues(game, now = performance.now()) {
  const devTools = game.devTools;
  if (!devTools.open || now - devTools.lastValueRefresh < VALUE_REFRESH_MS) return;
  devTools.lastValueRefresh = now;
  for (const section of devTools.registry.getSections()) {
    for (const item of section.items) {
      if (item.kind !== 'value') continue;
      const el = devTools.elements.panel?.querySelector(`[data-devtool-value="${CSS.escape(itemKey(section, item))}"]`);
      if (el) el.textContent = itemValue(game, item);
    }
  }
}

export function syncDevTools(game, { forceRender = false } = {}) {
  const devTools = game.devTools;
  if (!devTools) return;
  const eligible = isDevToolsEligible(game);
  devTools.visible = eligible;
  const { root, button, panel, body } = devTools.elements;
  if (!root) return;
  button.hidden = !eligible;
  if (!eligible && devTools.open) devTools.open = false;
  panel.hidden = !eligible || !devTools.open;
  panel.setAttribute('aria-hidden', panel.hidden ? 'true' : 'false');
  button.setAttribute('aria-expanded', devTools.open ? 'true' : 'false');
  root.dataset.devtoolsOpen = devTools.open ? 'true' : 'false';
  if (devTools.open && (forceRender || body.dataset.rendered !== 'true')) {
    body.innerHTML = renderPanel(game);
    body.dataset.rendered = 'true';
    devTools.lastValueRefresh = 0;
  }
  if (!devTools.open) body.dataset.rendered = 'false';
  refreshValues(game);
}

export function handleDevToolsKeydown(game, event) {
  if (event.code === 'Backquote') {
    if (!isDevToolsEligible(game)) return false;
    toggleDevTools(game);
    return true;
  }
  if (event.code === 'Escape' && game.devTools?.open) {
    const panel = game.devTools.elements.panel;
    if (panel?.contains(document.activeElement)) {
      closeDevTools(game);
      return true;
    }
  }
  return false;
}

export function setupDevTools(game) {
  const overlayRoot = document.getElementById('overlay-root') || document.body;
  const root = document.createElement('section');
  root.id = 'devtoolRoot';
  root.className = 'devtool-root';
  root.dataset.devtoolsOpen = 'false';
  root.innerHTML = `<button id="devtoolToggle" class="devtool-toggle" type="button" aria-controls="devtoolPanel" aria-expanded="false" hidden>Dev</button>
    <aside id="devtoolPanel" class="devtool-panel" role="region" aria-label="Developer toolbox" tabindex="-1" hidden aria-hidden="true">
      <header class="devtool-panel__header">
        <div><span class="devtool-eyebrow">Developer</span><h2>Toolbox</h2></div>
        <button type="button" class="devtool-close" data-devtool-close aria-label="Close developer toolbox">×</button>
      </header>
      <div class="devtool-panel__body" data-devtool-body></div>
    </aside>`;
  overlayRoot.appendChild(root);

  game.devTools.elements = {
    root,
    button: root.querySelector('#devtoolToggle'),
    panel: root.querySelector('#devtoolPanel'),
    body: root.querySelector('[data-devtool-body]')
  };
  game.devTools.sync = () => syncDevTools(game);

  game.devTools.elements.button.addEventListener('click', () => toggleDevTools(game));
  root.addEventListener('click', event => {
    if (event.target.closest('[data-devtool-close]')) return closeDevTools(game);
    const toggle = event.target.closest('[data-devtool-toggle]');
    if (toggle) {
      const item = findRegisteredItem(game, toggle.dataset.devtoolToggle);
      item?.set(game, toggle.checked);
      return;
    }
    const button = event.target.closest('[data-devtool-button]');
    if (button) {
      const item = findRegisteredItem(game, button.dataset.devtoolButton);
      item?.run(game, game.runtime);
      syncDevTools(game, { forceRender: true });
    }
  });
  syncDevTools(game);
}
