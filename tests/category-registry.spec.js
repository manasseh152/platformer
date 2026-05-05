import { expect, test } from '@playwright/test';
import { getAllCategories, getCategoryById, primaryGroupCategoryFor } from '../src/categories/registry.js';
import { getAllLevels, gymLevel, level } from '../src/campaign/registry.js';

test('category catalog provides group and filter tags with visibility metadata', () => {
  expect(getCategoryById('levels')).toMatchObject({ role: 'group', visibility: 'public' });
  expect(getCategoryById('legacy')).toMatchObject({ role: 'filter', visibility: 'developer' });
  expect(getAllCategories().map(category => category.id)).toContain('uncategorized');
});

test('levels only reference known centralized categories', () => {
  for (const entry of getAllLevels()) {
    expect(entry.categories.length).toBeGreaterThan(0);
    for (const categoryId of entry.categories) expect(getCategoryById(categoryId)).toBeTruthy();
  }
});

test('primary grouping uses visible group categories and avoids duplicate filter categories', () => {
  expect(primaryGroupCategoryFor(level, { developerMode: false }).id).toBe('levels');
  expect(primaryGroupCategoryFor(gymLevel, { developerMode: true }).id).toBe('gyms');
  expect(primaryGroupCategoryFor(gymLevel, { developerMode: false }).id).toBe('uncategorized');
});
