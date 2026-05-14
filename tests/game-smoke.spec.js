import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function openStartSettings(page) {
  await page.locator('#startSettingsButton').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'settings-category');
  await expect(page.locator('#menuTitle')).toHaveText('Controls');
  await expect(page.getByRole('tab', { name: 'Controls' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[role="tab"][data-controls-page="profiles"]')).toHaveAttribute('aria-selected', 'true');
}

async function openCategory(page, id, title) {
  await page.getByRole('tab', { name: title }).click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'settings-category');
  await expect(page.locator('#settingsHubPage')).toBeHidden();
  await expect(page.locator('#settingsCategoryPage')).toBeVisible();
  await expect(page.locator('#menuTitle')).toHaveText(title);
  await expect(page.locator(`[role="tab"][data-settings-tab="${id}"]`)).toHaveAttribute('aria-selected', 'true');
}

async function openControlsPage(page, id, title) {
  await openCategory(page, 'controls', 'Controls');
  await page.locator(`[data-controls-page="${id}"]`).click();
  await expect(page.locator(`[role="tab"][data-controls-page="${id}"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.settings-tab-panel')).toContainText(title);
}

function bindRow(page, device, action) {
  return page.locator(`.ds-setting-row--bind:has(button[data-bind-device="${device}"][data-bind-action="${action}"])`);
}

function bindButton(page, device, action, mode = 'replace') {
  return page.locator(`button[data-bind-device="${device}"][data-bind-action="${action}"][data-bind-mode="${mode}"]`);
}

async function installMockGamepad(page) {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 18 }, () => ({ pressed: false, value: 0 }));
    const pad = { id: 'Mock Controller', index: 0, connected: true, mapping: 'standard', axes: [0, 0], buttons };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
    window.__mockGamepadButton = (index, pressed) => {
      buttons[index].pressed = pressed;
      buttons[index].value = pressed ? 1 : 0;
    };
  });
  await page.reload();
}

async function waitForAnimationFrames(page, count = 1) {
  await page.evaluate(frameCount => new Promise(resolve => {
    let frames = 0;
    const tick = () => {
      frames += 1;
      if (frames >= frameCount) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), count);
}

async function pressPadButtonFrom(page, index, focusSelector) {
  await page.evaluate(({ buttonIndex, selector }) => {
    document.querySelector(selector).focus();
    window.__mockGamepadButton(buttonIndex, true);
  }, { buttonIndex: index, selector: focusSelector });
  await waitForAnimationFrames(page, 6);
  await page.evaluate(buttonIndex => window.__mockGamepadButton(buttonIndex, false), index);
  await waitForAnimationFrames(page, 3);
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

async function pressMenuKey(page, key) {
  await page.keyboard.down(key);
  await page.waitForTimeout(50);
  await page.keyboard.up(key);
  await page.waitForTimeout(80);
}

async function closeSettingsByBack(page) {
  for (let i = 0; i < 8; i += 1) {
    if (await page.locator('#pauseScreen').getAttribute('data-menu-page') !== 'settings-category') break;
    await page.evaluate(() => {
      const menu = document.querySelector('#pauseScreen');
      const layer = menu?.dataset.settingsFocusLayer || 'primary-tabs';
      const selector = layer === 'nested-tabs'
        ? '[role="tab"][data-controls-page][aria-selected="true"]'
        : layer === 'primary-tabs'
          ? '[role="tab"][data-settings-tab][aria-selected="true"]'
          : '[data-settings-nav-layer="content"] button, [data-settings-nav-layer="content"] input, [data-settings-nav-layer="content"] textarea';
      menu?.querySelector(selector)?.focus();
    });
    await pressMenuKey(page, 'Escape');
    await page.waitForTimeout(120);
  }
}

test('canvas presentation exposes integer scale and letterbox offsets', async ({ page }) => {
  const canvas = page.locator('#game');
  await expect(canvas).toHaveAttribute('data-presentation-scale', /^\d+(\.\d+)?$/);
  const viewport = await canvas.evaluate(node => ({
    width: node.width,
    height: node.height,
    scale: Number(node.dataset.presentationScale),
    offsetX: Number(node.dataset.presentationOffsetX),
    offsetY: Number(node.dataset.presentationOffsetY)
  }));
  expect(viewport.scale).toBe(Math.max(1, Math.floor(Math.min(viewport.width / 320, viewport.height / 180))));
  expect(viewport.offsetX).toBe(Math.floor((viewport.width - 320 * viewport.scale) / 2));
  expect(viewport.offsetY).toBe(Math.floor((viewport.height - 180 * viewport.scale) / 2));
});

test('browser Tab focus remains native while Escape opens start settings', async ({ page }) => {
  await expect(page.locator('#startScreen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('startButton');

  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('startLevelSelectButton');
  await expect(page.locator('#pauseScreen')).not.toBeVisible();

  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('startButton');
  await expect(page.locator('#pauseScreen')).not.toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'settings-category');
  await expect(page.locator('#menuTitle')).toHaveText('Controls');
});

test('settings layered keyboard navigation enters nested tabs and climbs back out', async ({ page }) => {
  await openStartSettings(page);
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'primary-tabs');
  await page.locator('[data-settings-tab="controls"]').focus();

  await pressMenuKey(page, 'ArrowRight');
  await expect(page.locator('[data-settings-tab="gameplay"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'primary-tabs');
  await page.locator('[data-settings-tab="gameplay"]').focus();

  await pressMenuKey(page, 'ArrowLeft');
  await expect(page.locator('[data-settings-tab="controls"]')).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-settings-tab="controls"]').focus();

  await pressMenuKey(page, 'ArrowDown');
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'nested-tabs');
  await page.locator('[data-controls-page="profiles"]').focus();

  await pressMenuKey(page, 'ArrowRight');
  await expect(page.locator('[data-controls-page="gameplay"]')).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-controls-page="gameplay"]').focus();

  await pressMenuKey(page, 'ArrowDown');
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'content');
  await expect(page.locator('button[data-bind-action="left"][data-bind-mode="replace"]')).toBeVisible();

  await pressMenuKey(page, 'Escape');
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'nested-tabs');
  await page.locator('[data-controls-page="gameplay"]').focus();

  await pressMenuKey(page, 'Escape');
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'primary-tabs');
});

test('controller settings navigation uses the same layered focus model', async ({ page }) => {
  await installMockGamepad(page);
  await openStartSettings(page);
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'primary-tabs');

  await pressPadButtonFrom(page, 13, '[data-settings-tab="controls"]');
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'nested-tabs');
  await expect(page.locator('[data-controls-page="profiles"]')).toHaveClass(/controller-focus/);

  await pressPadButtonFrom(page, 15, '[data-controls-page="profiles"]');
  await expect(page.locator('[data-controls-page="gameplay"]')).toHaveAttribute('aria-selected', 'true');

  await pressPadButtonFrom(page, 0, '[data-controls-page="gameplay"]');
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'content');
  await expect(page.locator('button[data-bind-action="left"][data-bind-mode="replace"]').first()).toHaveClass(/controller-focus/);

  await pressPadButtonFrom(page, 1, 'button[data-bind-action="left"][data-bind-mode="replace"]');
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'nested-tabs');
});

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
  await expect(page.locator('[role="tab"][data-settings-tab]')).toHaveText(['Controls', 'Gameplay', 'Accessibility', 'Graphics', 'Advanced']);
  await expect(page.locator('[role="tab"][data-controls-page]')).toHaveText(['Profiles', 'Gameplay', 'Navigation & System', 'Controller', 'Touch']);

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

  await closeSettingsByBack(page);
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'main');
});

test('native browser back routes through layered settings navigation', async ({ page }) => {
  await installMockGamepad(page);
  await openStartSettings(page);
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'primary-tabs');

  await pressPadButtonFrom(page, 13, '[role="tab"][data-settings-tab="controls"]');
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'nested-tabs');
  await pressPadButtonFrom(page, 0, '[role="tab"][data-controls-page="profiles"]');
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'content');

  await page.evaluate(() => history.back());
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'nested-tabs');
  await page.evaluate(() => history.back());
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-settings-focus-layer', 'primary-tabs');
  await page.evaluate(() => history.back());
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'main');
});

test('native browser back closes level select without leaving a stale menu entry', async ({ page }) => {
  await page.locator('#startLevelSelectButton').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'level-select');
  await page.evaluate(() => history.back());
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'main');

  await page.locator('#startLevelSelectButton').click();
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-menu-page', 'level-select');
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
  await closeSettingsByBack(page);

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
  await closeSettingsByBack(page);

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

test('controller diagnostics locks input and exits after holding B', async ({ page }) => {
  await installMockGamepad(page);
  await openStartSettings(page);
  await openControlsPage(page, 'controller', 'Controller');
  await page.locator('[data-controller-settings-page="diagnostics"]').click();

  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-current-settings-subpage', 'diagnostics');
  await expect(page.locator('.controller-debugger')).toHaveClass(/is-input-locked/);
  await expect(page.locator('#controllerName')).toContainText('Mock Controller');

  await page.evaluate(() => window.__mockGamepadButton(1, true));
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-current-settings-subpage', 'diagnostics');
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.__mockGamepadButton(1, false));
  await expect(page.locator('#pauseScreen')).toHaveAttribute('data-current-settings-subpage', '');
  await expect(page.locator('button[data-bind-device="controller"][data-bind-mode="replace"]')).toHaveCount(7);
});

test('keyboard and controller settings rows, binds, diagnostics, and pause flow', async ({ page }) => {
  const body = page.locator('body');
  const pauseScreen = page.locator('#pauseScreen');
  const startScreen = page.locator('#startScreen');
  const canvas = page.locator('#game');

  await openStartSettings(page);
  await openControlsPage(page, 'gameplay', 'Gameplay');
  await expect(page.locator('.settings-section h3')).toContainText(['Movement', 'Actions', 'System']);
  await expect(page.locator('.settings-section .settings-section')).toHaveCount(0);
  await expect(page.locator('button[data-bind-device="keyboard-mouse"][data-bind-mode="replace"]')).toHaveCount(7);

  await bindButton(page, 'keyboard-mouse', 'jump').click();
  await expect(bindRow(page, 'keyboard-mouse', 'jump')).toContainText('Press a key, mouse button, or wheel');
  await page.keyboard.press('KeyZ');
  await expect(page.locator('#settingsStatus')).toContainText('Jump updated');
  await expect(bindRow(page, 'keyboard-mouse', 'jump').locator('img')).toHaveAttribute('alt', 'Z');

  await bindButton(page, 'keyboard-mouse', 'attack').click();
  await page.keyboard.press('KeyZ');
  await expect(page.locator('#settingsStatus')).toContainText('already bound to Jump');
  await expect(bindRow(page, 'keyboard-mouse', 'attack')).toHaveClass(/is-error/);

  await page.getByRole('button', { name: 'Reset Keyboard + Mouse Defaults' }).click();
  await expect(page.locator('#settingsStatus')).toContainText('Restored Keyboard + Mouse defaults');
  const keyboardLeftIcons = bindRow(page, 'keyboard-mouse', 'left').locator('img');
  await expect(keyboardLeftIcons).toHaveCount(1);
  await expect(keyboardLeftIcons.nth(0)).toHaveAttribute('alt', 'A');

  await openControlsPage(page, 'controller', 'Controller');
  await expect(page.locator('[data-setting-row="controller-enabled"]')).toContainText('On');
  await expect(page.locator('button[data-bind-device="controller"][data-bind-mode="replace"]')).toHaveCount(7);
  const controllerLeftIcons = bindRow(page, 'controller', 'left').locator('img');
  await expect(controllerLeftIcons).toHaveCount(2);
  await expect(controllerLeftIcons.nth(0)).toHaveAttribute('alt', 'Left Stick ←');
  await expect(controllerLeftIcons.nth(1)).toHaveAttribute('alt', 'D-pad ←');
  const controllerDashIcons = bindRow(page, 'controller', 'dash').locator('img');
  await expect(controllerDashIcons).toHaveCount(2);
  await expect(controllerDashIcons.nth(0)).toHaveAttribute('alt', 'RB');
  await expect(controllerDashIcons.nth(1)).toHaveAttribute('alt', 'RT');
  await expect(page.locator('[data-controller-settings-page="diagnostics"]')).toContainText('Verify & Debug');
  await page.locator('[data-setting-row="controller-enabled"]').click();
  await expect(page.locator('[data-setting-row="controller-enabled"]')).toContainText('Off');
  await page.getByRole('button', { name: /Verify & Debug/ }).click();
  await expect(page.locator('#controllerName')).toContainText('None detected');
  await expect(page.locator('#controllerInputs')).toContainText('None');
  await expect(page.locator('.controller-debugger')).toHaveClass(/is-input-locked/);
  await page.locator('[data-controller-settings-back]').click();
  await page.getByRole('button', { name: 'Reset Controller Defaults' }).click();
  await expect(page.locator('#settingsStatus')).toContainText('Restored Controller defaults');

  await closeSettingsByBack(page);

  await page.locator('#startButton').click();
  await expect(body).toHaveClass(/\bplaying\b/);
  await expect(startScreen).toBeHidden();
  await expect(canvas).toHaveCSS('opacity', '1');

  await page.keyboard.press('Escape');
  await expect(body).toHaveClass(/\bpaused\b/);
  await page.locator('#settingsButton').click();
  await expect(pauseScreen).toHaveAttribute('data-menu-page', 'settings-category');
  await expect(page.getByRole('tab', { name: 'Controls' })).toHaveAttribute('aria-selected', 'true');
  await closeSettingsByBack(page);
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
  await page.locator('#pauseScreen #mainMenuButton').click();

  await expect(body).not.toHaveClass(/\bpaused\b/);
  await expect(body).not.toHaveClass(/\bplaying\b/);
  await expect(page.locator('#startScreen')).toBeVisible();
  await expect(page.locator('#pauseScreen')).toBeHidden();
  expect(errors).toEqual([]);

  await page.locator('#startButton').click();
  await expect(body).toHaveClass(/\bplaying\b/);
  await expect(page.locator('#startScreen')).toBeHidden();
});
