import { sceneObject } from './objects.js';

function cloneComponent(component) {
  return { ...component };
}

function componentTypes(components) {
  return components.map(component => component.type);
}

export function buildComponentIndex(objects) {
  const componentIndex = {};
  for (const object of objects) {
    for (const type of new Set(componentTypes(object.components))) {
      if (typeof type !== 'string' || !type) throw new Error(`${object.id} has a component without a type`);
      (componentIndex[type] ??= []).push(object);
    }
  }
  return componentIndex;
}

export function defineScene(definition = {}) {
  if (typeof definition.id !== 'string' || !definition.id.trim()) throw new Error('defineScene requires an id');
  if (typeof definition.kind !== 'string' || !definition.kind.trim()) throw new Error('defineScene requires a kind');
  if (!Array.isArray(definition.objects)) throw new Error('defineScene objects must be an array');

  const ids = new Set();
  const objects = definition.objects.map(object => {
    const normalized = sceneObject({
      ...object,
      transform: { ...(object.transform ?? {}) },
      components: (object.components ?? []).map(cloneComponent),
      tags: [...(object.tags ?? [])]
    });
    if (ids.has(normalized.id)) throw new Error(`scene duplicate object id: ${normalized.id}`);
    ids.add(normalized.id);
    return normalized;
  });

  return { ...definition, objects, componentIndex: buildComponentIndex(objects) };
}
