export function defineObject({ id, components = [] }) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('defineObject requires an id');
  if (!Array.isArray(components)) throw new Error(`${id} components must be an array`);
  return Object.freeze({ id, components: Object.freeze([...components]) });
}

export function sceneObject({ id, layerId = null, symbol = null, definitionId = null, transform = {}, components = [], tags = [] }) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('sceneObject requires an id');
  if (!Array.isArray(components)) throw new Error(`${id} components must be an array`);
  if (!Array.isArray(tags)) throw new Error(`${id} tags must be an array`);
  return { id, layerId, symbol, definitionId, transform: { ...transform }, components: [...components], tags: [...tags] };
}
