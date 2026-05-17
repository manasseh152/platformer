import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

async function waitForInstalledAppWorker(page) {
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    return Boolean(await navigator.serviceWorker.getRegistration());
  }, null, { timeout: 45_000 });
}

async function waitForInstalledAppControl(page) {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 45_000 });
}

test('manifest exposes the installed game app and Map Editor shortcut', async ({ page }) => {
  await page.goto('/');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBe('/manifest.webmanifest');

  const response = await page.request.get(manifestHref);
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();

  expect(manifest).toMatchObject({
    id: '/',
    name: 'Chibi Hollow Platformer',
    short_name: 'Chibi Hollow',
    start_url: '/',
    scope: '/',
    display: 'fullscreen',
    orientation: 'landscape'
  });
  expect(manifest.categories).toEqual(expect.arrayContaining(['games', 'entertainment']));
  expect(manifest.shortcuts).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'Map Editor', url: '/editor' })
  ]));
});

test('game shell reloads offline after the installed app worker is ready', async ({ page, context }) => {
  await page.goto('/');
  await waitForInstalledAppWorker(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForInstalledAppControl(page);
  await expect(page.locator('#game')).toBeVisible();

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('#game')).toBeVisible();
  await context.setOffline(false);
});

test('Map Editor reloads offline after the installed app worker is ready', async ({ page, context }) => {
  await page.goto('/editor');
  await waitForInstalledAppWorker(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForInstalledAppControl(page);
  await expect(page.locator('#editorCanvas')).toBeVisible();

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('#editorCanvas')).toBeVisible();
  await context.setOffline(false);
});
