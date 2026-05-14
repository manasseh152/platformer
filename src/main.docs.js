const modules = import.meta.glob(['../docs/**/*.md', '!../docs/adr/**'], {
  query: '?raw',
  import: 'default',
  eager: true
});

const documents = Object.entries(modules)
  .map(([modulePath, source]) => {
    const path = modulePath.replace(/^\.\.\//, '');
    const { markdown, frontMatter } = parseMarkdownDocument(source);
    const title = frontMatter.title || markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || titleFromPath(path);
    const id = slug(path.replace(/\.md$/, ''));
    return { id, path, title, markdown, frontMatter };
  })
  .sort(compareDocuments);

const documentIdsByPath = new Map(documents.map(doc => [doc.path, doc.id]));
const nav = document.getElementById('docsNav');
const content = document.getElementById('docsContent');
const filter = document.getElementById('docsFilter');
const sortedDocumentsByIdLength = [...documents].sort((a, b) => b.id.length - a.id.length);
let selectedDoc = findDocFromHash() || documents[0];
let currentQuery = '';

render();

filter?.addEventListener('input', () => {
  currentQuery = filter.value.trim().toLowerCase();
  renderNav(filteredDocuments(), currentQuery);
});

window.addEventListener('hashchange', () => {
  const nextDoc = findDocFromHash();
  if (nextDoc) selectedDoc = nextDoc;
  render();
  scrollToHashTarget();
});

function render() {
  renderNav(filteredDocuments(), currentQuery);
  content.innerHTML = selectedDoc
    ? renderDocument(selectedDoc)
    : `<article class="doc-card doc-card--empty"><h2>No docs available.</h2><p>Add markdown files under <code>docs/</code> to populate this reader.</p></article>`;
  scrollToHashTarget();
}

function filteredDocuments() {
  return currentQuery
    ? documents.filter(doc => [doc.title, doc.path, doc.frontMatter.description, doc.frontMatter.tags, doc.markdown].flat().join(' ').toLowerCase().includes(currentQuery))
    : documents;
}

function renderNav(docs, query) {
  const groups = groupByDirectory(docs);
  nav.innerHTML = docs.length
    ? Object.entries(groups).map(([group, entries]) => `
      <section class="docs-nav-group">
        <h2>${escapeHtml(group)}</h2>
        ${entries.map(renderNavLink).join('')}
      </section>
    `).join('')
    : `<p class="docs-nav-empty">No docs match “${escapeHtml(query)}”.</p>`;
}

function renderNavLink(doc) {
  const active = selectedDoc?.id === doc.id;
  return `<a class="docs-nav-link${active ? ' is-active' : ''}" href="#${doc.id}"${active ? ' aria-current="page"' : ''}>
    <span>${escapeHtml(doc.title)}</span>
    <small>${escapeHtml(doc.path)}</small>
  </a>`;
}

function renderDocument(doc) {
  return `<article id="${doc.id}" class="doc-card" data-doc-path="${escapeHtml(doc.path)}">
    <header class="doc-card__header">
      <div>
        <p class="doc-card__eyebrow">Selected file</p>
        <p>${escapeHtml(doc.path)}</p>
      </div>
      <a href="#${doc.id}" aria-label="Link to ${escapeHtml(doc.title)}">#</a>
    </header>
    ${renderMarkdown(doc.markdown, doc)}
  </article>`;
}

function findDocFromHash() {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  if (!hash) return null;
  return sortedDocumentsByIdLength.find(doc => hash === doc.id || hash.startsWith(`${doc.id}-`)) || null;
}

function scrollToHashTarget() {
  if (!window.location.hash) return;
  requestAnimationFrame(() => {
    const id = CSS.escape(decodeURIComponent(window.location.hash.slice(1)));
    const target = document.querySelector(`#${id}`);
    target?.scrollIntoView({ block: 'start' });
  });
}

function parseMarkdownDocument(source) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return { markdown: normalized, frontMatter: {} };

  return {
    markdown: normalized.slice(match[0].length),
    frontMatter: parseFrontMatter(match[1])
  };
}

function parseFrontMatter(source) {
  const data = {};
  let currentListKey = null;

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith('#')) continue;

    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && currentListKey) {
      data[currentListKey].push(parseFrontMatterValue(listItem[1]));
      continue;
    }

    currentListKey = null;
    const entry = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!entry) continue;

    const [, key, rawValue = ''] = entry;
    if (!rawValue.trim()) {
      data[key] = [];
      currentListKey = key;
    } else {
      data[key] = parseFrontMatterValue(rawValue);
    }
  }

  return data;
}

function parseFrontMatterValue(rawValue) {
  const value = rawValue.trim();
  if (!value) return '';
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1).split(',').map(item => parseFrontMatterValue(item)).filter(item => item !== '');
  }
  const quoted = value.match(/^(['"])([\s\S]*)\1$/);
  return quoted ? quoted[2] : value;
}

function renderMarkdown(markdown, doc) {
  const lines = markdown.split('\n');
  let html = '';
  let paragraph = [];
  let list = null;
  let code = null;
  let tableRows = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html += `<p>${inline(paragraph.join(' '), doc)}</p>`;
    paragraph = [];
  };
  const closeList = () => {
    if (!list) return;
    html += `</${list}>`;
    list = null;
  };
  const flushTable = () => {
    if (!tableRows.length) return;
    html += renderTable(tableRows, doc);
    tableRows = [];
  };

  for (const line of lines) {
    if (code) {
      if (line.startsWith('```')) {
        html += `<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`;
        code = null;
      } else code.lines.push(line);
      continue;
    }
    if (line.startsWith('```')) {
      flushParagraph();
      closeList();
      code = { lines: [] };
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      flushTable();
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushParagraph();
      closeList();
      tableRows.push(trimmed);
      continue;
    }
    flushTable();

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length + 1, 6);
      const text = stripInline(heading[2]);
      const id = `${doc.id}-${slug(text)}`;
      html += `<h${level} id="${id}">${inline(heading[2], doc)}<a class="heading-anchor" href="#${id}" aria-label="Link to ${escapeHtml(text)}">#</a></h${level}>`;
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const type = unordered ? 'ul' : 'ol';
      if (list !== type) {
        closeList();
        html += `<${type}>`;
        list = type;
      }
      html += `<li>${inline((unordered || ordered)[1], doc)}</li>`;
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  flushTable();
  if (code) html += `<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`;
  return html;
}

function renderTable(rows, doc) {
  if (rows.length < 2 || !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(rows[1])) {
    return rows.map(row => `<p>${inline(row, doc)}</p>`).join('');
  }
  const cells = row => row.slice(1, -1).split('|').map(cell => cell.trim());
  const header = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  return `<div class="doc-table-wrap"><table><thead><tr>${header.map(cell => `<th>${inline(cell, doc)}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${row.map(cell => `<td>${inline(cell, doc)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function inline(text, doc) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => renderLink(label, href, doc));
}

function renderLink(label, href, doc) {
  if (/^[a-z]+:/i.test(href) || href.startsWith('#')) return `<a href="${escapeAttr(href)}">${label}</a>`;
  const [target, hash = ''] = href.split('#');
  const targetPath = normalizeDocPath(doc.path, target);
  const targetId = documentIdsByPath.get(targetPath);
  if (targetId) return `<a href="#${targetId}${hash ? `-${slug(hash)}` : ''}">${label}</a>`;
  if (targetPath.includes('/adr/') || targetPath.startsWith('docs/adr/')) return `<span class="doc-link-muted" title="ADR excluded from this docs page">${label}</span>`;
  return `<a href="${escapeAttr(href)}">${label}</a>`;
}

function normalizeDocPath(fromPath, href) {
  if (href.startsWith('/')) return href.replace(/^\//, '');
  const base = fromPath.split('/').slice(0, -1);
  for (const part of href.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') base.pop();
    else base.push(part);
  }
  return base.join('/');
}

function groupByDirectory(docs) {
  return docs.reduce((groups, doc) => {
    const group = doc.path.split('/').slice(0, -1).join('/') || 'docs';
    (groups[group] ||= []).push(doc);
    return groups;
  }, {});
}

function titleFromPath(path) {
  return path.split('/').pop().replace(/\.md$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function compareDocuments(a, b) {
  const orderDelta = frontMatterOrder(a) - frontMatterOrder(b);
  return orderDelta || sortKey(a.path).localeCompare(sortKey(b.path));
}

function frontMatterOrder(doc) {
  const order = doc.frontMatter.order ?? doc.frontMatter.navOrder;
  return Number.isFinite(order) ? order : Number.POSITIVE_INFINITY;
}

function sortKey(path) {
  return path === 'docs/README.md' ? '0' : path;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
}

function stripInline(text) {
  return text.replace(/[`*_\[\]()]/g, '').trim();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
