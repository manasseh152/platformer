import { assertKnownCategories, VISIBILITY } from '../categories/registry.js';

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertCatalogEntry(entry, { allowedKinds = [] } = {}) {
  if (!entry || typeof entry !== 'object') throw new Error('catalog entry must be an object');
  if (!KEBAB_CASE.test(entry.id || '')) throw new Error(`catalog entry id must be kebab-case: ${entry.id}`);
  if (typeof entry.name !== 'string' || !entry.name.trim()) throw new Error(`${entry.id} must have a name`);
  if (!allowedKinds.includes(entry.kind)) throw new Error(`${entry.id} has invalid kind: ${entry.kind}`);
  if (!VISIBILITY.has(entry.visibility)) throw new Error(`${entry.id} has invalid visibility: ${entry.visibility}`);
  if ('description' in entry && typeof entry.description !== 'string') throw new Error(`${entry.id} description must be a string`);
  assertKnownCategories(entry);
}

export function assertCatalog(entries, options = {}) {
  const seen = new Set();
  for (const entry of entries) {
    assertCatalogEntry(entry, options);
    if (seen.has(entry.id)) throw new Error(`duplicate catalog entry id: ${entry.id}`);
    seen.add(entry.id);
  }
}
