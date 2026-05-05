import { expect, test } from '@playwright/test';
import { createSceneStack } from '../src/scene-stack.js';

function makeRuntime() {
  const emitted = [];
  return {
    emit: (type, detail) => emitted.push({ type, detail }),
    events: () => emitted
  };
}

test('scene stack replaces, updates, renders, snapshots, and dehydrates scenes', () => {
  const calls = [];
  const runtime = makeRuntime();
  const stack = createSceneStack(runtime);
  const base = {
    id: 'base',
    kind: 'base',
    setup: () => calls.push('base.setup'),
    update: () => calls.push('base.update'),
    render: () => calls.push('base.render'),
    snapshot: () => ({ id: 'base', value: 1 }),
    dehydrate: () => ({ base: true })
  };
  const overlay = {
    id: 'overlay',
    kind: 'overlay',
    setup: () => calls.push('overlay.setup'),
    update: () => calls.push('overlay.update'),
    render: () => calls.push('overlay.render'),
    snapshot: () => ({ id: 'overlay', value: 2 })
  };

  expect(stack.replaceStack([base, overlay]).ok).toBe(true);
  stack.update(0.016);
  stack.render();

  expect(calls).toEqual(['base.setup', 'overlay.setup', 'base.update', 'overlay.update', 'base.render', 'overlay.render']);
  expect(stack.base()).toBe(base);
  expect(stack.top()).toBe(overlay);
  expect(stack.snapshot()).toEqual([{ id: 'base', value: 1 }, { id: 'overlay', value: 2 }]);
  expect(stack.dehydrate()).toEqual({ base: { base: true }, overlay: null });
  expect(runtime.events().map(event => event.type)).toContain('scene.stack.replace');
});

test('scene stack overlays can block update, render, and input below', () => {
  const calls = [];
  const stack = createSceneStack(makeRuntime());
  stack.replaceStack([
    {
      id: 'base',
      update: () => calls.push('base.update'),
      render: () => calls.push('base.render'),
      handleInput: () => calls.push('base.input')
    },
    {
      id: 'modal',
      blocksUpdateBelow: true,
      blocksInputBelow: true,
      rendersBelow: false,
      update: () => calls.push('modal.update'),
      render: () => calls.push('modal.render'),
      handleInput: () => false
    }
  ]);

  stack.update(0.016);
  stack.render();
  const input = stack.handleInput({ type: 'action', action: 'pause' });

  expect(calls).toEqual(['modal.update', 'modal.render']);
  expect(input).toMatchObject({ consumed: false, blocked: true, scene: { id: 'modal' } });
});

test('scene stack routes input top-down until consumed', () => {
  const calls = [];
  const stack = createSceneStack(makeRuntime());
  stack.replaceStack([
    { id: 'base', handleInput: () => { calls.push('base'); return true; } },
    { id: 'overlay', handleInput: () => { calls.push('overlay'); return false; } },
    { id: 'top', handleInput: () => { calls.push('top'); return { consumed: true }; } }
  ]);

  expect(stack.handleInput({ type: 'confirm' })).toMatchObject({ consumed: true, scene: { id: 'top' } });
  expect(calls).toEqual(['top']);
});

test('scene stack push and pop manage lifecycle', () => {
  const calls = [];
  const stack = createSceneStack(makeRuntime());
  stack.push({ id: 'base', teardown: () => calls.push('base.teardown') });
  stack.push({ id: 'pause', teardown: () => calls.push('pause.teardown') });

  expect(stack.has('pause')).toBe(true);
  expect(stack.pop('pause')).toMatchObject({ ok: true, scene: { id: 'pause' } });
  expect(stack.pop()).toMatchObject({ ok: true, scene: { id: 'base' } });
  expect(stack.pop()).toMatchObject({ ok: false, reason: 'empty-stack' });
  expect(calls).toEqual(['pause.teardown', 'base.teardown']);
});
