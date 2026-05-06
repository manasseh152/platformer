import { createSceneStack } from './engine/scene-stack.js';

export function createSceneHost(runtime) {
  const registry = new Map();
  const stack = createSceneStack(runtime);
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

    const result = stack.replaceStack([next], hydrateState ? { [next.id]: hydrateState } : null);
    current = next;
    runtime.emit('scene.switch', { from: previous?.id || null, to: current.id });
    return { ok: true, reason: null, scene: current, previousScene: previous, stack: result };
  }

  function replaceStack(scenes, hydrateState = null) {
    const previous = current;
    const result = stack.replaceStack(scenes, hydrateState);
    current = stack.top();
    runtime.emit('scene.switch', { from: previous?.id || null, to: current?.id || null });
    return { ok: true, reason: null, scene: current, previousScene: previous, stack: result };
  }

  function pushScene(sceneOrId, hydrateState = null) {
    const scene = typeof sceneOrId === 'string' ? get(sceneOrId) : sceneOrId;
    if (!scene) return { ok: false, reason: 'missing-scene', scene: null, scenes: stack.list() };
    const result = stack.push(scene, hydrateState);
    current = stack.top();
    return result;
  }

  function popScene(sceneId = null) {
    const result = stack.pop(sceneId);
    current = stack.top();
    return result;
  }

  function update(dt) {
    stack.update(dt);
  }

  function render() {
    stack.render();
  }

  function handleInput(inputEvent) {
    return stack.handleInput(inputEvent);
  }

  function snapshot() {
    const snapshots = stack.snapshot();
    return snapshots.length <= 1 ? snapshots[0] ?? null : snapshots;
  }

  function dehydrate() {
    const dehydrated = stack.dehydrate();
    const keys = Object.keys(dehydrated);
    return keys.length <= 1 ? dehydrated[keys[0]] ?? null : dehydrated;
  }

  return {
    register,
    get,
    getCurrent,
    switchScene,
    replaceStack,
    pushScene,
    popScene,
    update,
    render,
    handleInput,
    snapshot,
    dehydrate,
    stack,
    list: () => [...registry.values()]
  };
}
