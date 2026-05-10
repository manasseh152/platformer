import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function openStartSettings(page) {
  await page.locator('#startSettingsButton').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'settings-category');
  await expect(page.locator('#menuTitle')).toHaveText('Keyboard');
  await expect(page.getByRole('tab', { name: 'Keyboard' })).toHaveAttribute('aria-selected', 'true');
}

async function openCategory(page, id, title) {
  await page.getByRole('tab', { name: title }).click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'settings-category');
  await expect(page.locator('#settingsHubPage')).toBeHidden();
  await expect(page.locator('#settingsCategoryPage')).toBeVisible();
  await expect(page.locator('#menuTitle')).toHaveText(title);
  await expect(page.locator(`[role="tab"][data-settings-tab="${id}"]`)).toHaveAttribute('aria-selected', 'true');
}

async function installMockGamepad(page) {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    const pad = { id: 'Mock Controller', index: 0, connected: true, mapping: 'standard', axes: [0, 0], buttons };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
    window.__mockGamepadButton = (index, pressed) => {
      buttons[index].pressed = pressed;
      buttons[index].value = pressed ? 1 : 0;
    };
  });
  await page.reload();
}

async function pressPadButtonFrom(page, index, focusSelector) {
  await page.evaluate(({ buttonIndex, selector }) => {
    document.querySelector(selector).focus();
    window.__mockGamepadButton(buttonIndex, true);
  }, { buttonIndex: index, selector: focusSelector });
  await page.waitForTimeout(200);
  await page.evaluate(buttonIndex => window.__mockGamepadButton(buttonIndex, false), index);
  await page.waitForTimeout(120);
}

async function focusSettingsAction(page, action) {
  await expect.poll(() => page.evaluate(name => {
    const button = document.querySelector(`[data-settings-action="${name}"]`);
    button?.focus();
    return document.activeElement === button ? button.dataset.settingsAction : '';
  }, action)).toBe(action);
}

async function expectFocusedSettingsAction(page, action) {
  await expect.poll(() => page.evaluate(() => document.activeElement?.dataset.settingsAction || '')).toBe(action);
}

async function focusLevelRow(page, levelId) {
  await expect.poll(() => page.evaluate(id => {
    const button = document.querySelector(`button[data-scenario-id="${id}"]`);
    button?.focus();
    return document.activeElement === button ? button.dataset.scenarioId : '';
  }, levelId)).toBe(levelId);
}

async function expectFocusedLevelRow(page, levelId) {
  await expect.poll(() => page.evaluate(() => document.activeElement?.dataset.scenarioId || '')).toBe(levelId);
}

test('single hint layer owns global controls across start, gameplay, and pause', async ({ page }) => {
  const hintLayer = page.locator('#hintLayer');
  await expect(hintLayer).toHaveCount(1);
  await expect(page.locator('#controls')).toHaveCount(0);
  await expect(page.locator('.command-bar')).toHaveCount(0);
  await expect(hintLayer).toBeVisible();
  await expect(hintLayer).toContainText('Select');
  await expect(hintLayer).toContainText('Settings');

  await hintLayer.locator('button[data-input-action="menu.settings"]').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'settings-category');
  await expect(hintLayer).toContainText('Back');
  await expect(hintLayer.locator('[data-input-action="menu.settings"]')).toHaveCount(0);
  await hintLayer.locator('button[data-input-action="menu.back"]').click();
  await expect(page.locator('#startScreen')).toBeVisible();

  await page.locator('#startButton').click();
  await expect(page.locator('body')).toHaveClass(/\bplaying\b/);
  await expect(hintLayer).toContainText('Move');
  await expect(hintLayer).toContainText('Jump');
  await expect(hintLayer.locator('button')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveClass(/\bpaused\b/);
  await expect(hintLayer.locator('[data-input-action="player.jump"]')).toHaveCount(0);
  await expect(hintLayer).toContainText('Resume');
  await expect.poll(() => page.evaluate(() => {
    const hints = Number(getComputedStyle(document.querySelector('#hintLayer')).zIndex);
    const pause = Number(getComputedStyle(document.querySelector('#pauseScreen')).zIndex);
    return hints > pause;
  })).toBe(true);

  await hintLayer.locator('button[data-input-action="menu.back"]').click();
  await expect(page.locator('body')).not.toHaveClass(/\bpaused\b/);
  await expect(hintLayer).toContainText('Move');
});

test('settings tabs, accessibility motion, advanced JSON, and start flow', async ({ page }) => {
  const body = page.locator('body');
  const pauseScreen = page.locator('#pauseScreen');

  await expect(page.locator('#startScreen')).toBeVisible();
  await expect(page.locator('#startSettingsButton')).toHaveText('Settings');

  await openStartSettings(page);
  await expect(page.locator('[role="tab"][data-settings-tab]')).toHaveText(['Keyboard', 'Controller', 'Gameplay', 'Accessibility', 'Graphics', 'Advanced']);

  await openCategory(page, 'accessibility', 'Accessibility');
  await expect(page.locator('[data-setting-row="motion"]')).toContainText('System');
  await page.locator('[data-setting-row="motion"]').click();
  await expect(page.locator('[data-setting-row="motion"]')).toContainText('On');
  await page.locator('[data-setting-row="motion"]').click();
  await expect(page.locator('[data-setting-row="motion"]')).toContainText('Off');
  await expect(body).toHaveClass(/\bmotion-reduce\b/);
  await page.reload();
  await expect(body).toHaveClass(/\bmotion-reduce\b/);

  await openStartSettings(page);
  await openCategory(page, 'advanced', 'Advanced');
  await expect(page.locator('[data-setting-row="developer-mode"]')).toContainText('Off');
  await expect(page.locator('#developerTools')).toBeHidden();
  await page.locator('[data-setting-row="developer-mode"]').click();
  await expect(page.locator('[data-setting-row="developer-mode"]')).toContainText('On');
  await expect(page.locator('#developerTools')).toBeVisible();

  await page.getByRole('button', { name: 'Dump app settings' }).click();
  const dumped = await page.locator('#settingsJson').inputValue();
  expect(dumped).toContain('schemaVersion');
  expect(dumped).toContain('"input"');
  expect(dumped).toContain('"bindings"');
  expect(dumped).not.toContain('keyboardBinds');
  expect(dumped).not.toContain('gamepadBinds');

  const next = JSON.parse(dumped);
  next.motion = 'on';
  next.developerMode = false;
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#settingsJson').fill(JSON.stringify(next));
  await page.getByRole('button', { name: 'Replace app settings' }).click();
  await expect(page.locator('#settingsJsonStatus')).toContainText('Replaced app settings');
  await expect(body).not.toHaveClass(/\bmotion-reduce\b/);
  await expect(page.locator('#developerTools')).toBeHidden();

  await page.locator('[data-setting-row="developer-mode"]').click();
  await page.locator('#settingsJson').fill('{ invalid');
  await page.getByRole('button', { name: 'Replace app settings' }).click();
  await expect(page.locator('#settingsJsonStatus')).toContainText('Replace failed');

  await page.keyboard.press('Escape');
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'main');
});

test('developer maps are only available in the normal Level Select when Developer Mode is enabled', async ({ page }) => {
  await page.goto('/?level=movement-gym');
  await expect(page.locator('body')).toHaveAttribute('data-tilemap-id', 'act-01-level-1');

  await page.locator('#startLevelSelectButton').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'level-select');
  await expect(page.getByRole('button', { name: /Act 01 Level 1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Movement Gym/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Enemy Zoo/ })).toHaveCount(0);
  await page.locator('[data-level-select-back]').click();

  await openStartSettings(page);
  await openCategory(page, 'advanced', 'Advanced');
  await expect(page.locator('#developerTools')).toBeHidden();
  await page.locator('[data-setting-row="developer-mode"]').click();
  await expect(page.locator('#developerTools')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.locator('#startLevelSelectButton').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'level-select');
  await page.getByRole('tab', { name: 'Gyms' }).click();
  await expect(page.getByRole('button', { name: /Movement Gym/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Zoos' }).click();
  await expect(page.getByRole('button', { name: /Enemy Zoo/ })).toBeVisible();
  await page.getByRole('button', { name: /Enemy Zoo/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-tilemap-id', 'enemy-zoo-map');
  await expect(page.locator('#selectedLevelSummary')).toContainText('Enemy Zoo');

  await openStartSettings(page);
  await openCategory(page, 'advanced', 'Advanced');
  await page.locator('[data-setting-row="developer-mode"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-tilemap-id', 'act-01-level-1');
  await expect(page.locator('#developerTools')).toBeHidden();

  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('chibi.settings')));
  settings.developerMode = true;
  await page.evaluate(value => localStorage.setItem('chibi.settings', JSON.stringify(value)), settings);
  await page.goto('/?level=movement-gym');
  await expect(page.locator('body')).toHaveAttribute('data-tilemap-id', 'act-01-level-1');
});

test('controller can navigate and choose levels in Level Select', async ({ page }) => {
  await installMockGamepad(page);
  await openStartSettings(page);
  await openCategory(page, 'advanced', 'Advanced');
  await page.locator('[data-setting-row="developer-mode"]').click();
  await expect(page.locator('#developerTools')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.locator('#startLevelSelectButton').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'level-select');
  await page.waitForTimeout(250);
  await focusLevelRow(page, 'act-01-level-1');

  await pressPadButtonFrom(page, 13, 'button[data-scenario-id="act-01-level-1"]');
  await expectFocusedLevelRow(page, 'act-01-level-2');

  await pressPadButtonFrom(page, 0, 'button[data-scenario-id="act-01-level-2"]');
  await expect(page.locator('body')).toHaveAttribute('data-tilemap-id', 'act-01-level-2');
  await expect(page.locator('#selectedLevelSummary')).toContainText('Act 01 Level 2');
});

test('controller diagonal menu directions navigate horizontal button groups', async ({ page }) => {
  await installMockGamepad(page);
  await openStartSettings(page);
  await openCategory(page, 'advanced', 'Advanced');
  await page.locator('[data-setting-row="developer-mode"]').click();
  await expect(page.locator('#developerTools')).toBeVisible();
  await page.waitForTimeout(250);

  await focusSettingsAction(page, 'dump-settings');

  await pressPadButtonFrom(page, 12, '[data-settings-action="dump-settings"]'); // D-pad up advances through horizontal groups like right.
  await expectFocusedSettingsAction(page, 'replace-settings');

  await pressPadButtonFrom(page, 13, '[data-settings-action="replace-settings"]'); // D-pad down reverses through horizontal groups like left.
  await expectFocusedSettingsAction(page, 'dump-settings');

  await pressPadButtonFrom(page, 15, '[data-settings-action="dump-settings"]'); // D-pad right advances.
  await expectFocusedSettingsAction(page, 'replace-settings');

  await pressPadButtonFrom(page, 14, '[data-settings-action="replace-settings"]'); // D-pad left reverses.
  await expectFocusedSettingsAction(page, 'dump-settings');
});

test('keyboard and controller settings rows, binds, diagnostics, and pause flow', async ({ page }) => {
  const body = page.locator('body');
  const pauseScreen = page.locator('#pauseScreen');
  const startScreen = page.locator('#startScreen');
  const canvas = page.locator('#game');

  await openStartSettings(page);
  await openCategory(page, 'keyboard', 'Keyboard');
  await expect(page.locator('.settings-section h3')).toContainText(['Movement', 'Actions', 'System']);
  await expect(page.locator('.settings-section .settings-section')).toHaveCount(0);
  await expect(page.locator('[data-bind-device="keyboard"]')).toHaveCount(7);

  await page.locator('[data-bind-device="keyboard"][data-bind-action="jump"]').click();
  await expect(page.locator('[data-bind-action="jump"]')).toContainText('Press a key');
  await page.keyboard.press('KeyZ');
  await expect(page.locator('#settingsStatus')).toContainText('Jump updated');
  await expect(page.locator('[data-bind-action="jump"]')).toContainText('Z');

  await page.locator('[data-bind-device="keyboard"][data-bind-action="attack"]').click();
  await page.keyboard.press('KeyZ');
  await expect(page.locator('#settingsStatus')).toContainText('already bound to Jump');
  await expect(page.locator('[data-bind-action="attack"]')).toHaveClass(/is-error/);

  await page.getByRole('button', { name: 'Reset Keyboard Defaults' }).click();
  await expect(page.locator('#settingsStatus')).toContainText('Restored keyboard defaults');
  await expect(page.locator('[data-bind-action="left"]')).toContainText('A');
  await expect(page.locator('[data-bind-action="left"]')).toContainText('←');

  await openCategory(page, 'controller', 'Controller');
  await expect(page.locator('[data-setting-row="controller-enabled"]')).toContainText('On');
  await expect(page.locator('#controllerName')).toContainText('None detected');
  await expect(page.locator('#controllerInputs')).toContainText('None');
  await page.locator('[data-setting-row="controller-enabled"]').click();
  await expect(page.locator('[data-setting-row="controller-enabled"]')).toContainText('Off');
  await page.getByRole('button', { name: 'Reset Controller Defaults' }).click();
  await expect(page.locator('#settingsStatus')).toContainText('Restored controller defaults');

  await page.keyboard.press('Escape');

  await page.locator('#startButton').click();
  await expect(body).toHaveClass(/\bplaying\b/);
  await expect(startScreen).toBeHidden();
  await expect(canvas).toHaveCSS('opacity', '1');

  await page.keyboard.press('Escape');
  await expect(body).toHaveClass(/\bpaused\b/);
  await page.locator('#settingsButton').click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'settings-category');
  await expect(page.getByRole('tab', { name: 'Keyboard' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'main');
  await pauseScreen.getByRole('button', { name: 'Continue' }).click();
  await expect(body).not.toHaveClass(/\bpaused\b/);
  await expect(pauseScreen).toBeHidden();
});

test('pause Main Menu button returns to start screen and can start a fresh run', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const body = page.locator('body');

  await page.locator('#startButton').click();
  await expect(body).toHaveClass(/\bplaying\b/);

  await page.keyboard.press('Escape');
  await expect(body).toHaveClass(/\bpaused\b/);
  await page.locator('#mainMenuButton').click();

  await expect(body).not.toHaveClass(/\bpaused\b/);
  await expect(body).not.toHaveClass(/\bplaying\b/);
  await expect(page.locator('#startScreen')).toBeVisible();
  await expect(page.locator('#pauseScreen')).toBeHidden();
  expect(errors).toEqual([]);

  await page.locator('#startButton').click();
  await expect(body).toHaveClass(/\bplaying\b/);
  await expect(page.locator('#startScreen')).toBeHidden();
});
