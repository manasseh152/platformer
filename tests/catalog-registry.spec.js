import { expect, test } from '@playwright/test';
import { createCatalogRegistry } from '../src/catalog/registry.js';

test('catalog registry registers validated entries by id', () => {
  const registry = createCatalogRegistry({ name: 'test', allowedKinds: ['tilemap-level'] });
  const entry = registry.register({
    id: 'demo-entry',
    name: 'Demo Entry',
    kind: 'tilemap-level',
    categories: ['levels'],
    visibility: 'public'
  });

  expect(registry.getById('demo-entry')).toBe(entry);
  expect(registry.getAll()).toEqual([entry]);
  expect(() => registry.register(entry)).toThrow(/duplicate id/);
});
