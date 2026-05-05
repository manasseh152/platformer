export function createSceneLibrary() {
  const factories = new Map();

  function register(factory) {
    if (!factory?.id) throw new Error('scene factory must have an id');
    if (typeof factory.create !== 'function') throw new Error(`${factory.id} scene factory must have a create function`);
    if (factories.has(factory.id)) throw new Error(`scene factory duplicate id: ${factory.id}`);
    factories.set(factory.id, { kind: 'unknown', ...factory });
    return factories.get(factory.id);
  }

  function get(id) {
    return factories.get(id) ?? null;
  }

  function create(id, app, props = {}) {
    const factory = get(id);
    if (!factory) return { ok: false, reason: 'missing-scene-factory', scene: null, factory: null };
    const scene = factory.create(app, props);
    return { ok: true, reason: null, scene, factory };
  }

  function list() {
    return [...factories.values()];
  }

  return { register, get, create, list };
}

export function resolveSceneComposition(library, app, composition) {
  if (!composition?.stack?.length) return { ok: false, reason: 'empty-composition', scenes: [] };
  const scenes = [];
  for (const layer of composition.stack) {
    const result = library.create(layer.scene, app, layer.props ?? {});
    if (!result.ok) return { ok: false, reason: result.reason, missingScene: layer.scene, scenes };
    scenes.push(result.scene);
  }
  return { ok: true, reason: null, scenes };
}
