const SUPPORTED_ITEM_KINDS = new Set(['toggle', 'button', 'value']);

function assertId(value, label) {
  if (!value || typeof value !== 'string') throw new Error(`${label} requires a string id.`);
}

function assertItem(item) {
  assertId(item?.id, 'Devtool item');
  if (!SUPPORTED_ITEM_KINDS.has(item.kind)) throw new Error(`Unsupported devtool item kind "${item?.kind}".`);
  if (!item.label || typeof item.label !== 'string') throw new Error(`Devtool item "${item.id}" requires a label.`);
  if (item.kind === 'toggle' && (typeof item.get !== 'function' || typeof item.set !== 'function')) throw new Error(`Devtool toggle "${item.id}" requires get and set functions.`);
  if (item.kind === 'button' && typeof item.run !== 'function') throw new Error(`Devtool button "${item.id}" requires a run function.`);
  if (item.kind === 'value' && typeof item.get !== 'function') throw new Error(`Devtool value "${item.id}" requires a get function.`);
}

function orderValue(record) {
  return Number.isFinite(record.order) ? record.order : record.registrationIndex;
}

function compareRecords(a, b, labelKey) {
  const orderDelta = orderValue(a) - orderValue(b);
  if (orderDelta) return orderDelta;
  const labelDelta = String(a[labelKey] || '').localeCompare(String(b[labelKey] || ''));
  if (labelDelta) return labelDelta;
  return a.registrationIndex - b.registrationIndex;
}

export function createDevToolsRegistry() {
  const sections = new Map();
  let sectionRegistrationIndex = 0;
  let itemRegistrationIndex = 0;

  function registerSection(definition) {
    assertId(definition?.id, 'Devtool section');
    if (!definition.title || typeof definition.title !== 'string') throw new Error(`Devtool section "${definition.id}" requires a title.`);
    const incomingItems = definition.items || [];
    if (!Array.isArray(incomingItems)) throw new Error(`Devtool section "${definition.id}" items must be an array.`);
    incomingItems.forEach(assertItem);

    let section = sections.get(definition.id);
    if (!section) {
      section = {
        id: definition.id,
        title: definition.title,
        order: definition.order,
        registrationIndex: sectionRegistrationIndex++,
        items: [],
        itemIds: new Set()
      };
      sections.set(section.id, section);
    } else if (Number.isFinite(definition.order)) {
      section.order = Number.isFinite(section.order) ? Math.min(section.order, definition.order) : definition.order;
    }

    for (const item of incomingItems) {
      if (section.itemIds.has(item.id)) throw new Error(`Duplicate devtool item "${section.id}.${item.id}".`);
      section.itemIds.add(item.id);
      section.items.push({ ...item, registrationIndex: itemRegistrationIndex++ });
    }

    return section;
  }

  function getSections() {
    return [...sections.values()]
      .sort((a, b) => compareRecords(a, b, 'title'))
      .map(section => ({
        ...section,
        items: [...section.items].sort((a, b) => compareRecords(a, b, 'label'))
      }));
  }

  function snapshot() {
    return getSections().map(section => ({
      id: section.id,
      title: section.title,
      order: section.order ?? null,
      items: section.items.map(item => ({ id: item.id, kind: item.kind, label: item.label, order: item.order ?? null }))
    }));
  }

  return { registerSection, getSections, snapshot };
}

export function createDevToolsState() {
  const registry = createDevToolsRegistry();
  return {
    open: false,
    visible: false,
    flags: {},
    registry,
    elements: {},
    lastValueRefresh: 0,
    sync: null
  };
}

export function registerBuiltInDevTools(game) {
  game.devTools.registry.registerSection({
    id: 'session',
    title: 'Session',
    order: 0,
    items: [
      { id: 'tilemap', kind: 'value', label: 'Tilemap', get: game => game.tilemap?.name || 'Unknown' },
      { id: 'scenario', kind: 'value', label: 'Scenario', get: game => game.scenarios?.current?.entry?.name || game.scenarios?.current?.id || 'None' },
      { id: 'player-position', kind: 'value', label: 'Player', get: game => game.player ? `${Math.round(game.player.x)}, ${Math.round(game.player.y)}` : 'None' }
    ]
  });
}
