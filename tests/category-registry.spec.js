import { expect, test } from '@playwright/test';
import { getAllCategories, getCategoryById, primaryGroupCategoryFor } from '../src/core/categories/registry.js';
import { getScenarioEntryById, getAllScenarioEntries } from '../src/core/scenarios/registry.js';

const campaign = getScenarioEntryById('act-01-level-1');
const gym = getScenarioEntryById('movement-gym');

test('category catalog provides group and filter tags with visibility metadata', () => {
  expect(getCategoryById('levels')).toMatchObject({ role: 'group', visibility: 'public' });
  expect(getAllCategories().map(category => category.id)).toContain('uncategorized');
});

test('scenarios only reference known centralized categories', () => {
  for (const entry of getAllScenarioEntries()) {
    expect(entry.categories.length).toBeGreaterThan(0);
    for (const categoryId of entry.categories) expect(getCategoryById(categoryId)).toBeTruthy();
  }
});

test('primary grouping uses visible group categories and avoids duplicate filter categories', () => {
  expect(primaryGroupCategoryFor(campaign, { developerMode: false }).id).toBe('levels');
  expect(primaryGroupCategoryFor(gym, { developerMode: true }).id).toBe('movement');
  expect(primaryGroupCategoryFor(gym, { developerMode: false }).id).toBe('uncategorized');
});
