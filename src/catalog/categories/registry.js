import { isKebabCaseId } from '../id.js';

export const VISIBILITY = new Set(['public', 'developer']);
export const CATEGORY_ROLES = new Set(['group', 'filter']);

export const categories = {
  levels: { id: 'levels', name: 'Levels', role: 'group', visibility: 'public', order: 10 },
  local: { id: 'local', name: 'Local', role: 'group', visibility: 'public', order: 15 },
  'act-01': { id: 'act-01', name: 'Act 01', role: 'filter', visibility: 'public', order: 20 },
  gyms: { id: 'gyms', name: 'Gyms', role: 'group', visibility: 'developer', order: 100 },
  zoos: { id: 'zoos', name: 'Zoos', role: 'group', visibility: 'developer', order: 110 },
  movement: { id: 'movement', name: 'Movement', role: 'filter', visibility: 'developer', order: 200 },
  hazards: { id: 'hazards', name: 'Hazards', role: 'filter', visibility: 'developer', order: 210 },
  'finish-gate': { id: 'finish-gate', name: 'Finish Gate', role: 'filter', visibility: 'developer', order: 220 },
  enemy: { id: 'enemy', name: 'Enemy', role: 'filter', visibility: 'developer', order: 230 },
  ui: { id: 'ui', name: 'UI', role: 'filter', visibility: 'developer', order: 240 },
  uncategorized: { id: 'uncategorized', name: 'Other', role: 'group', visibility: 'public', order: 9999 }
};

export function isVisibleToMode(item, developerMode = false) {
  return item?.visibility === 'public' || Boolean(developerMode);
}

export function getCategoryById(id) {
  return categories[id] ?? null;
}

export function getAllCategories() {
  return Object.values(categories).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function assertCategoryCatalog() {
  for (const category of Object.values(categories)) {
    if (!category || typeof category !== 'object') throw new Error('category must be an object');
    if (!isKebabCaseId(category.id || '')) throw new Error(`category id must be kebab-case: ${category.id}`);
    if (typeof category.name !== 'string' || !category.name.trim()) throw new Error(`category ${category.id} must have a name`);
    if (!CATEGORY_ROLES.has(category.role)) throw new Error(`category ${category.id} has invalid role: ${category.role}`);
    if (!VISIBILITY.has(category.visibility)) throw new Error(`category ${category.id} has invalid visibility: ${category.visibility}`);
    if (!Number.isFinite(category.order)) throw new Error(`category ${category.id} must have numeric order`);
  }
}

export function assertKnownCategories(entry) {
  if (!Array.isArray(entry.categories) || entry.categories.length === 0) throw new Error(`${entry.id} must have at least one category`);
  for (const categoryId of entry.categories) {
    if (!isKebabCaseId(categoryId || '')) throw new Error(`${entry.id} has invalid category id: ${categoryId}`);
    if (!getCategoryById(categoryId)) throw new Error(`${entry.id} references unknown category: ${categoryId}`);
  }
}

export function primaryGroupCategoryFor(entry, { developerMode = false } = {}) {
  const visibleCategories = (entry.categories || [])
    .map(getCategoryById)
    .filter(category => category && isVisibleToMode(category, developerMode));
  return visibleCategories.find(category => category.role === 'group')
    || visibleCategories[0]
    || categories.uncategorized;
}

assertCategoryCatalog();
