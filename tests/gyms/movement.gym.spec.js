import { expect, test } from '@playwright/test';

function machineById(snapshot, id) {
  return snapshot.gym?.machines?.find(machine => machine.id === id) ?? null;
}

test('Movement Gym auto-runs max-speed machine to pass', async ({ page }) => {
  await page.goto('/index.html?mode=developer&scenario=movement-gym&autorun=1');
  await expect(page.locator('body')).toHaveAttribute('data-tilemap-id', 'movement-gym-map');
  await expect.poll(() => page.evaluate(() => window.__gym?.snapshot?.().gym?.status), { timeout: 5000 }).toBe('passed');

  const snapshot = await page.evaluate(() => window.__gym.snapshot());
  expect(snapshot.gym).toMatchObject({
    id: 'movement-gym',
    status: 'passed',
    autoStart: true
  });
  const machine = machineById(snapshot, 'movement.run-max-speed');
  expect(machine).toMatchObject({
    id: 'movement.run-max-speed',
    status: 'passed',
    authority: 'input'
  });
  expect(machine.validates).toEqual(expect.arrayContaining(['movement.input', 'movement.physics']));
  expect(machine.observations.maxVx).toBeGreaterThan(105);
  expect(machine.observations.distance).toBeGreaterThan(95);
});
