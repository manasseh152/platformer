export function createSceneHost(runtime) {
  const registry = new Map();
  let current = null;

  function register(scene) {
    if (!scene?.id) throw new Error('Scene must have an id.');
    if (registry.has(scene.id)) throw new Error(`Scene already registered: ${scene.id}`);
    registry.set(scene.id, scene);
    runtime.emit('scene.register', { sceneId: scene.id, kind: scene.kind || 'unknown' });
    return scene;
  }

  function get(sceneId) {
    return registry.get(sceneId) ?? null;
  }

  function getCurrent() {
    return current;
  }

  function switchScene(sceneId, hydrateState = null) {
    const next = get(sceneId);
    const previous = current;
    if (!next) {
      runtime.emit('scene.switch.failed', { sceneId, reason: 'missing-scene', previousSceneId: previous?.id || null });
      return { ok: false, reason: 'missing-scene', scene: null, previousScene: previous };
    }
    if (previous?.id === next.id) return { ok: true, reason: null, scene: current, previousScene: previous };

    previous?.teardown?.(runtime);
    current = next;
    current.setup?.(runtime);
    if (hydrateState) current.hydrate?.(runtime, hydrateState);
    runtime.emit('scene.switch', { from: previous?.id || null, to: current.id });
    return { ok: true, reason: null, scene: current, previousScene: previous };
  }

  function update(dt) {
    current?.update?.(runtime, dt);
  }

  function render() {
    current?.render?.(runtime);
  }

  function snapshot() {
    return current?.snapshot?.(runtime) ?? null;
  }

  function dehydrate() {
    return current?.dehydrate?.(runtime) ?? null;
  }

  return {
    register,
    get,
    getCurrent,
    switchScene,
    update,
    render,
    snapshot,
    dehydrate,
    list: () => [...registry.values()]
  };
}
