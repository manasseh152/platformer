export function createSceneStack(runtime) {
  const stack = [];

  function describe(scene) {
    return scene ? { sceneId: scene.id, kind: scene.kind || 'unknown' } : null;
  }

  function setup(scene) {
    scene.setup?.(runtime);
    runtime?.emit?.('scene.stack.setup', describe(scene));
  }

  function teardown(scene) {
    scene.teardown?.(runtime);
    runtime?.emit?.('scene.stack.teardown', describe(scene));
  }

  function replaceStack(scenes, hydrateState = null) {
    const previous = [...stack];
    for (const scene of [...stack].reverse()) teardown(scene);
    stack.length = 0;
    for (const scene of scenes) {
      if (!scene?.id) throw new Error('Scene stack entries must have an id.');
      stack.push(scene);
      setup(scene);
      if (hydrateState?.[scene.id]) scene.hydrate?.(runtime, hydrateState[scene.id]);
    }
    runtime?.emit?.('scene.stack.replace', { from: previous.map(scene => scene.id), to: stack.map(scene => scene.id) });
    return { ok: true, scenes: [...stack], previousScenes: previous };
  }

  function push(scene, hydrateState = null) {
    if (!scene?.id) throw new Error('Scene stack entries must have an id.');
    stack.push(scene);
    setup(scene);
    if (hydrateState) scene.hydrate?.(runtime, hydrateState);
    runtime?.emit?.('scene.stack.push', describe(scene));
    return { ok: true, scene, scenes: [...stack] };
  }

  function pop(sceneId = null) {
    if (!stack.length) return { ok: false, reason: 'empty-stack', scene: null, scenes: [] };
    const index = sceneId ? stack.findIndex(scene => scene.id === sceneId) : stack.length - 1;
    if (index < 0) return { ok: false, reason: 'missing-scene', scene: null, scenes: [...stack] };
    const removed = stack.splice(index, 1)[0];
    teardown(removed);
    runtime?.emit?.('scene.stack.pop', describe(removed));
    return { ok: true, reason: null, scene: removed, scenes: [...stack] };
  }

  function top() {
    return stack[stack.length - 1] ?? null;
  }

  function base() {
    return stack[0] ?? null;
  }

  function has(sceneId) {
    return stack.some(scene => scene.id === sceneId);
  }

  function update(dt) {
    let start = 0;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].blocksUpdateBelow) {
        start = i;
        break;
      }
    }
    for (let i = start; i < stack.length; i++) stack[i].update?.(runtime, dt);
  }

  function render() {
    let start = 0;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].rendersBelow === false) {
        start = i;
        break;
      }
    }
    for (let i = start; i < stack.length; i++) stack[i].render?.(runtime);
  }

  function handleInput(inputEvent) {
    for (let i = stack.length - 1; i >= 0; i--) {
      const scene = stack[i];
      const result = scene.handleInput?.(runtime, inputEvent);
      if (result === true || result?.consumed) return { consumed: true, scene, result };
      if (scene.blocksInputBelow) return { consumed: false, blocked: true, scene, result };
    }
    return { consumed: false, blocked: false, scene: null, result: null };
  }

  function snapshot() {
    return stack.map(scene => scene.snapshot?.(runtime) ?? { id: scene.id, kind: scene.kind || 'unknown' });
  }

  function dehydrate() {
    return Object.fromEntries(stack.map(scene => [scene.id, scene.dehydrate?.(runtime) ?? null]));
  }

  return {
    replaceStack,
    push,
    pop,
    top,
    base,
    has,
    update,
    render,
    handleInput,
    snapshot,
    dehydrate,
    list: () => [...stack]
  };
}
