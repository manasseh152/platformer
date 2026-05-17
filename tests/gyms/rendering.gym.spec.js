import { expect, test } from '@playwright/test';

function machineById(snapshot, id) {
  return snapshot.gym?.machines?.find(machine => machine.id === id) ?? null;
}

test('Rendering Gym auto-runs state-fixture and observer machines to pass', async ({ page }) => {
  await page.goto('/index.html?mode=developer&scenario=rendering-gym&autorun=1');
  await expect(page.locator('body')).toHaveAttribute('data-tilemap-id', 'rendering-gym-map');
  await expect.poll(() => page.evaluate(() => window.__gym?.snapshot?.().gym?.status), { timeout: 15000 }).toBe('passed');

  const snapshot = await page.evaluate(() => window.__gym.snapshot());
  expect(snapshot.gym).toMatchObject({
    id: 'rendering-gym',
    status: 'passed',
    autoStart: true
  });

  expect(machineById(snapshot, 'rendering.actor-state-fixture')).toMatchObject({
    authority: 'state-fixture',
    execution: 'parallel',
    status: 'passed'
  });
  expect(machineById(snapshot, 'rendering.actor-state-fixture').observations).toMatchObject({
    dustCount: 1,
    particleCount: 2
  });

  expect(machineById(snapshot, 'rendering.read-model-actors')).toMatchObject({
    authority: 'observer',
    execution: 'parallel',
    status: 'passed'
  });
  expect(machineById(snapshot, 'rendering.read-model-actors').observations).toMatchObject({
    playerRender: 'player',
    enemyRender: 'slime',
    tilemapId: 'rendering-gym-map'
  });
  expect(machineById(snapshot, 'rendering.read-model-actors').observations.effects).toEqual(expect.arrayContaining(['dust', 'particle']));
});
