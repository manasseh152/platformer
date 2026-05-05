import { assertCatalogEntry } from './metadata.js';

export function createCatalogRegistry({ name, allowedKinds = [], validateEntry } = {}) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('catalog registry requires a name');
  const entries = new Map();

  function register(entry) {
    assertCatalogEntry(entry, { allowedKinds });
    validateEntry?.(entry);
    if (entries.has(entry.id)) throw new Error(`${name} registry duplicate id: ${entry.id}`);
    entries.set(entry.id, entry);
    return entry;
  }

  function getById(id) {
    return entries.get(id) ?? null;
  }

  function getAll() {
    return [...entries.values()];
  }

  function clear() {
    entries.clear();
  }

  return {
    register,
    getById,
    getAll,
    clear
  };
}
