import { expect, test } from '@playwright/test';
import { createSceneHost } from '#/app/scenes/scene-host.js';

function makeRuntime() {
  const emitted = [];
  return {
    emit: (type, detail) => emitted.push({ type, detail }),
    events: () => emitted
  };
}

test('scene host exposes layered stack operations while preserving current scene compatibility', () => {
  const calls = [];
  const runtime = makeRuntime();
  const host = createSceneHost(runtime);
  const base = host.register({ id: 'base', kind: 'base', update: () => calls.push('base.update'), render: () => calls.push('base.render') });
  const overlay = host.register({ id: 'overlay', kind: 'overlay', blocksUpdateBelow: true, update: () => calls.push('overlay.update'), render: () => calls.push('overlay.render') });

  expect(host.switchScene('base')).toMatchObject({ ok: true, scene: base });
  expect(host.pushScene('overlay')).toMatchObject({ ok: true, scene: overlay });
  expect(host.getCurrent()).toBe(overlay);

  host.update(0.016);
  host.render();

  expect(calls).toEqual(['overlay.update', 'base.render', 'overlay.render']);
  expect(host.stack.list().map(scene => scene.id)).toEqual(['base', 'overlay']);
  expect(host.popScene('overlay')).toMatchObject({ ok: true, scene: overlay });
  expect(host.getCurrent()).toBe(base);
});

test('scene host can replace stack with created scene instances', () => {
  const runtime = makeRuntime();
  const host = createSceneHost(runtime);
  const first = { id: 'first', snapshot: () => ({ id: 'first' }) };
  const second = { id: 'second', snapshot: () => ({ id: 'second' }) };

  expect(host.replaceStack([first, second])).toMatchObject({ ok: true, scene: second });
  expect(host.snapshot()).toEqual([{ id: 'first' }, { id: 'second' }]);
  expect(runtime.events().map(event => event.type)).toContain('scene.stack.replace');
});
