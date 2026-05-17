import { expect, test } from '@playwright/test';

function machineById(snapshot, id) {
  return snapshot.gym?.machines?.find(machine => machine.id === id) ?? null;
}

test('Movement Gym auto-runs movement coverage machines to pass', async ({ page }) => {
  await page.goto('/index.html?mode=developer&scenario=movement-gym&autorun=1');
  await expect(page.locator('body')).toHaveAttribute('data-tilemap-id', 'movement-gym-map');
  await expect.poll(() => page.evaluate(() => window.__gym?.snapshot?.().gym?.status), { timeout: 15000 }).toBe('passed');

  const snapshot = await page.evaluate(() => window.__gym.snapshot());
  expect(snapshot.gym).toMatchObject({
    id: 'movement-gym',
    status: 'passed',
    autoStart: true
  });
  for (const id of [
    'movement.run-max-speed',
    'movement.jump-gap',
    'movement.run-jump-coupling',
    'movement.air-correction',
    'movement.dash-burst',
    'movement.npc-patrol'
  ]) {
    expect(machineById(snapshot, id), id).toMatchObject({ id, status: 'passed' });
  }

  const runMachine = machineById(snapshot, 'movement.run-max-speed');
  expect(runMachine).toMatchObject({ authority: 'input' });
  expect(runMachine.validates).toEqual(expect.arrayContaining(['movement.input', 'movement.physics']));
  expect(runMachine.observations.maxVx).toBeGreaterThan(105);
  expect(runMachine.observations.distance).toBeGreaterThan(95);

  expect(machineById(snapshot, 'movement.jump-gap').observations.wasAirborne).toBe(true);
  expect(machineById(snapshot, 'movement.run-jump-coupling').observations.airborneMaxVx).toBeGreaterThan(95);
  expect(machineById(snapshot, 'movement.air-correction').observations.negativeAirVx).toBeLessThan(-25);
  expect(machineById(snapshot, 'movement.dash-burst').observations.maxVx).toBeGreaterThan(240);
  expect(machineById(snapshot, 'movement.npc-patrol')).toMatchObject({ authority: 'observer' });
});

test('Movement Gym devtools expose free camera and machine focus inspection', async ({ page }) => {
  await page.goto('/index.html?mode=developer&scenario=movement-gym&autorun=1');
  await expect(page.locator('#devtoolToggle')).toBeVisible();

  await page.locator('#devtoolToggle').click();
  await expect(page.locator('[data-devtool-section="gym"]')).toContainText('Free camera');
  await expect(page.locator('[data-devtool-value="gym.focused-machine"]')).toContainText('Run max speed');

  await page.locator('[data-devtool-toggle="gym.free-camera"]').check();
  await expect.poll(() => page.evaluate(() => window.__gym.snapshot().camera.mode)).toBe('free');
  await expect.poll(() => page.evaluate(() => window.__gym.snapshot().devTools.flags.gymInspection.freeCamera)).toBe(true);

  await page.locator('[data-devtool-button="gym.focus-next-machine"]').click();
  const focused = await page.evaluate(() => window.__gym.snapshot().devTools.flags.gymInspection.focusedMachineId);
  expect(focused).toBe('movement.jump-gap');
  await expect.poll(() => page.evaluate(() => window.__gym.snapshot().camera.mode)).toBe('gym-inspect');

  await page.locator('[data-devtool-button="gym.follow-player"]').click();
  await expect.poll(() => page.evaluate(() => window.__gym.snapshot().camera.mode)).toBe('follow');
});
