import { expect, test } from '@playwright/test';
import { createSceneLibrary, resolveSceneComposition } from '#/scenes/library.js';

test('scene library registers and creates scene factories', () => {
  const library = createSceneLibrary();
  const factory = library.register({
    id: 'demo-scene',
    kind: 'overlay',
    create: (_app, props) => ({ id: 'demo', props })
  });

  expect(factory).toMatchObject({ id: 'demo-scene', kind: 'overlay' });
  expect(library.get('demo-scene')).toBe(factory);
  expect(library.create('demo-scene', {}, { value: 1 })).toMatchObject({
    ok: true,
    scene: { id: 'demo', props: { value: 1 } }
  });
  expect(library.create('missing', {}, {})).toMatchObject({ ok: false, reason: 'missing-scene-factory' });
});

test('scene library resolves declarative scenario compositions', () => {
  const library = createSceneLibrary();
  library.register({ id: 'base', kind: 'base', create: () => ({ id: 'base' }) });
  library.register({ id: 'overlay', kind: 'overlay', create: () => ({ id: 'overlay' }) });

  expect(resolveSceneComposition(library, {}, {
    stack: [{ scene: 'base' }, { scene: 'overlay' }]
  })).toMatchObject({ ok: true, scenes: [{ id: 'base' }, { id: 'overlay' }] });

  expect(resolveSceneComposition(library, {}, {
    stack: [{ scene: 'missing' }]
  })).toMatchObject({ ok: false, reason: 'missing-scene-factory', missingScene: 'missing' });
});
