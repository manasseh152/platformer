import { expect, test } from '@playwright/test';
import { createSceneHost } from '#/app/scenes/scene-host.js';
import { createEventLogger, createMemoryStorage, createRuntime } from '#/app/runtime/browser-runtime.js';

function makeRuntime() {
  let now = 0;
  const logger = createEventLogger({ now: () => now });
  return createRuntime({ now: () => now, random: () => 0.5, storage: createMemoryStorage(), logger });
}

test('scene host registers, switches, updates, renders, and dehydrates scenes', () => {
  const runtime = makeRuntime();
  const host = createSceneHost(runtime);
  const calls = [];

  host.register({
    id: 'first',
    kind: 'test',
    setup: () => calls.push('first.setup'),
    teardown: () => calls.push('first.teardown'),
    update: (_runtime, dt) => calls.push(`first.update:${dt}`),
    render: () => calls.push('first.render'),
    snapshot: () => ({ id: 'first', value: 1 }),
    dehydrate: () => ({ sceneId: 'first' })
  });
  host.register({
    id: 'second',
    kind: 'test',
    setup: () => calls.push('second.setup')
  });

  expect(host.switchScene('first').ok).toBe(true);
  host.update(1 / 60);
  host.render();
  expect(host.snapshot()).toEqual({ id: 'first', value: 1 });
  expect(host.dehydrate()).toEqual({ sceneId: 'first' });

  expect(host.switchScene('second').ok).toBe(true);
  expect(calls).toEqual(['first.setup', 'first.update:0.016666666666666666', 'first.render', 'first.teardown', 'second.setup']);
  expect(runtime.events().map(event => event.type).filter(type => type === 'scene.register' || type === 'scene.switch')).toEqual(['scene.register', 'scene.register', 'scene.switch', 'scene.switch']);
});

test('scene host reports missing scene switches as events', () => {
  const runtime = makeRuntime();
  const host = createSceneHost(runtime);

  expect(host.switchScene('missing')).toEqual({ ok: false, reason: 'missing-scene', scene: null, previousScene: null });
  expect(runtime.events()).toContainEqual(expect.objectContaining({
    type: 'scene.switch.failed',
    detail: { sceneId: 'missing', reason: 'missing-scene', previousSceneId: null }
  }));
});
