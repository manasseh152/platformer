import { expect, test } from '@playwright/test';

test('Docs reader renders one selected markdown file with sidebar navigation', async ({ page }) => {
  await page.goto('/docs');

  const articles = page.locator('.doc-card');
  await expect(articles).toHaveCount(1);
  await expect(page.locator('.docs-nav-link[aria-current="page"]')).toHaveCount(1);

  const firstPath = await page.locator('.doc-card__header p').last().textContent();
  const secondNavLink = page.locator('.docs-nav-link').nth(1);
  const secondPath = await secondNavLink.locator('small').textContent();

  await secondNavLink.click();

  await expect(articles).toHaveCount(1);
  await expect(page.locator('.doc-card__header')).toContainText(secondPath.trim());
  await expect(page.locator('.doc-card__header')).not.toContainText(firstPath.trim());
  await expect(secondNavLink).toHaveAttribute('aria-current', 'page');

  await page.locator('#docsFilter').fill('term-that-does-not-exist');
  await expect(page.locator('#docsNav')).toContainText('No docs match');
  await expect(articles).toHaveCount(1);
  await expect(page.locator('.doc-card__header')).toContainText(secondPath.trim());
});
