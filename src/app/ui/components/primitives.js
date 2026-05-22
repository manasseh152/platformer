export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function attrs(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([name, value]) => value === true ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`)
    .join('');
}

function classes(...values) {
  return values.flatMap(value => String(value || '').split(/\s+/)).filter(Boolean).join(' ');
}

export function renderTabList({ label, tabs, activeId, activeLayer = true, className = '', variant = '', attributes = {}, before = '', after = '' }) {
  const variantClass = variant ? `ds-tabs--${variant}` : '';
  return `<div class="${classes('ds-tabs', variantClass, className)}" role="tablist" aria-label="${escapeHtml(label)}"${attrs(attributes)}>${before}${tabs.map(tab => renderTab({ ...tab, selected: tab.id === activeId, tabbable: activeLayer && tab.id === activeId })).join('')}${after}</div>`;
}

export function renderTab({ id, label, selected = false, tabbable = false, className = '', attributes = {}, content }) {
  return `<button type="button" class="${classes('ds-tab', className)}" role="tab" aria-selected="${selected ? 'true' : 'false'}" tabindex="${tabbable ? '0' : '-1'}"${attrs(attributes)}>${content ?? escapeHtml(label)}</button>`;
}

export function renderTabPanel({ body, className = '', attributes = {} }) {
  return `<div class="${classes('ds-tab-panel', className)}" role="tabpanel"${attrs(attributes)}>${body}</div>`;
}

export function renderSection({ title, body, className = '', attributes = {} }) {
  return `<section class="${classes('ds-section', className)}"${attrs(attributes)}><h3>${escapeHtml(title)}</h3>${body}</section>`;
}

export function renderSettingRow({ id, label, value, description = '', kind = 'setting', tag = 'button', className = '', valueClassName = '', attributes = {} }) {
  const type = tag === 'button' ? ' type="button"' : '';
  return `<${tag}${type} class="${classes('ds-setting-row', kind && `ds-setting-row--${kind}`, className)}"${id ? ` data-setting-row="${escapeHtml(id)}"` : ''}${attrs(attributes)}>
    <span class="ds-setting-row--copy"><span class="ds-setting-row--label">${escapeHtml(label)}</span>${description ? `<span class="ds-setting-row--description">${escapeHtml(description)}</span>` : ''}</span>
    <span class="${classes('ds-setting-row--value', valueClassName)}">${value}</span>
  </${tag}>`;
}

export function renderInfoRow({ label, value, valueId, description = '', className = '', attributes = {} }) {
  return `<div class="${classes('ds-setting-row', 'ds-setting-row--info', className)}"${attrs(attributes)}>
    <span class="ds-setting-row--copy"><span class="ds-setting-row--label">${escapeHtml(label)}</span>${description ? `<span class="ds-setting-row--description">${escapeHtml(description)}</span>` : ''}</span>
    <span class="ds-setting-row--value"${valueId ? ` id="${escapeHtml(valueId)}"` : ''}>${value}</span>
  </div>`;
}

export function renderActionRow(actions, { className = '', attributes = {}, tag = 'span' } = {}) {
  return `<${tag} class="${classes('ds-action-row', className)}"${attrs(attributes)}>${actions.join('')}</${tag}>`;
}

export function renderKeybindRow({ label, value, listening = false, error = false, actions = '', className = '', attributes = {} }) {
  return `<div class="${classes('ds-setting-row', 'ds-setting-row--bind', listening && 'is-listening', error && 'is-error', className)}"${attrs(attributes)}>
    <span class="ds-setting-row--copy"><span class="ds-setting-row--label">${escapeHtml(label)}</span></span>
    <span class="ds-setting-row--value bind-keycaps">${value}</span>
    ${actions}
  </div>`;
}
