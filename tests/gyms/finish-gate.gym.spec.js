import { expect, test } from '@playwright/test';

function machineById(snapshot, id) {
  return snapshot.gym?.machines?.find(machine => machine.id === id) ?? null;
}

test('Finish Gate Gym auto-runs finish gate machines to pass', async ({ page }) => {
  await page.goto('/index.html?mode=developer&scenario=finish-gate-gym&autorun=1');
  await expect(page.locator('body')).toHaveAttribute('data-tilemap-id', 'finish-gate-gym-map');
  await expect.poll(() => page.evaluate(() => window.__gym?.snapshot?.().gym?.status), { timeout: 15000 }).toBe('passed');

  const snapshot = await page.evaluate(() => window.__gym.snapshot());
  expect(snapshot.gym).toMatchObject({
    id: 'finish-gate-gym',
    status: 'passed',
    autoStart: true
  });

  const geometry = machineById(snapshot, 'finish-gate.collider-coverage');
  expect(geometry).toMatchObject({
    authority: 'observer',
    status: 'passed'
  });
  expect(geometry.validates).toEqual(expect.arrayContaining(['finish-gate.geometry', 'scene.transition']));
  expect(geometry.observations.gate).toMatchObject({ cols: 3, rows: 1, kind: 'finish' });
  expect(geometry.observations.minimumColliderInsideRatio).toBe(0.5);

  const completion = machineById(snapshot, 'finish-gate.complete-session');
  expect(completion).toMatchObject({
    authority: 'input',
    status: 'passed'
  });
  expect(completion.validates).toEqual(expect.arrayContaining(['finish-gate.transition', 'gameplay.outcome']));
  expect(completion.observations.outcome).toBe('completed');
  expect(completion.observations.colliderInsideRatio).toBeGreaterThanOrEqual(0.5);
  expect(completion.observations.distance).toBeGreaterThan(300);
});
