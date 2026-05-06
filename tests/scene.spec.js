import { expect, test } from '@playwright/test';
import { defineObject, sceneObject } from '../src/engine/scene/objects.js';
import { defineScene } from '../src/engine/scene/scene.js';
import { getComponent, getComponents, findObjectsWithComponent, findOneObjectWithComponent } from '../src/engine/scene/queries.js';
import { renderLayer, renderParallax, renderProcedural, renderTexture, solid } from '../src/engine/scene/components.js';
import { defineTilemap, gridLayer } from '../src/core/tilemaps/tilemap.js';
import { solidTerrain } from '../src/content/tilemaps/objects.js';

test('defineScene normalizes objects, clones components, and builds component index', () => {
  const sourceComponent = { type: 'tag:test', value: 1 };
  const scene = defineScene({
    id: 'scene-a',
    kind: 'test-scene',
    objects: [sceneObject({ id: 'one', components: [sourceComponent, solid()] })]
  });

  sourceComponent.value = 2;
  expect(scene.objects[0].components[0]).toEqual({ type: 'tag:test', value: 1 });
  expect(getComponent(scene.objects[0], 'tag:test')).toEqual({ type: 'tag:test', value: 1 });
  expect(getComponents(scene.objects[0], 'collision:solid')).toHaveLength(1);
  expect(findObjectsWithComponent(scene, 'collision:solid').map(object => object.id)).toEqual(['one']);
  expect(findOneObjectWithComponent(scene, 'tag:test')?.id).toBe('one');
});

test('defineScene validates id, kind, and duplicate object ids', () => {
  expect(() => defineScene({ kind: 'test-scene', objects: [] })).toThrow(/requires an id/);
  expect(() => defineScene({ id: 'scene-a', objects: [] })).toThrow(/requires a kind/);
  expect(() => defineScene({ id: 'scene-a', kind: 'test-scene', objects: [{ id: 'x' }, { id: 'x' }] })).toThrow(/duplicate object id/);
});

test('defineObject and sceneObject validate basic object shape', () => {
  expect(defineObject({ id: 'crate', components: [solid()] })).toMatchObject({ id: 'crate' });
  expect(sceneObject({ id: 'authored', transform: { x: 1 }, components: [solid()] })).toMatchObject({ id: 'authored', transform: { x: 1 } });
  expect(() => defineObject({ components: [] })).toThrow(/requires an id/);
  expect(() => sceneObject({ id: 'bad', components: null })).toThrow(/components must be an array/);
});

test('defineTilemap merges authored scene objects into the core scene index', () => {
  const scene = defineTilemap({
    id: 'with-authored-object',
    cols: 2,
    rows: 1,
    layers: [gridLayer({ id: 'terrain', symbols: { '#': solidTerrain }, rows: ['#.'] })],
    objects: [sceneObject({ id: 'far-sky', components: [renderLayer({ order: -200 }), renderProcedural({ shader: 'sky-bands' })] })]
  });

  expect(scene.objects.map(object => object.id)).toEqual(['terrain:0,0', 'far-sky']);
  expect(findObjectsWithComponent(scene, 'render:layer').map(object => object.id)).toEqual(['far-sky']);
  expect(findObjectsWithComponent(scene, 'collision:solid').map(object => object.id)).toEqual(['terrain:0,0']);
});

test('render components normalize pixel-perfect layer data', () => {
  expect(renderLayer({ order: -100, overscan: 16 })).toEqual({
    type: 'render:layer',
    order: -100,
    space: 'camera-buffer',
    overscan: { left: 16, right: 16, top: 16, bottom: 16 }
  });
  expect(renderLayer({ overscan: { x: 32, y: 8 } }).overscan).toEqual({ left: 32, right: 32, top: 8, bottom: 8 });
  expect(renderParallax({ x: 0.2, y: 0 })).toEqual({ type: 'render:parallax', x: 0.2, y: 0 });
  expect(renderProcedural({ shader: 'sky-bands' })).toEqual({ type: 'render:procedural', shader: 'sky-bands' });
  expect(renderTexture({ asset: 'bg', repeat: true, opacity: 0.5 })).toEqual({ type: 'render:texture', asset: 'bg', repeat: true, opacity: 0.5 });
  expect(() => renderLayer({ space: 'world' })).toThrow(/camera-buffer/);
});
