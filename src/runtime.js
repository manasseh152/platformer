/**
 * Application-layer browser runtime adapter over `src/engine/runtime.js`.
 * Core runtime construction stays browser-global free; this module supplies browser defaults.
 */
import { createEventLogger, createMemoryStorage, createRuntime as createCoreRuntime, createSeededRandom } from './engine/runtime.js';

export { createEventLogger, createMemoryStorage, createSeededRandom };

export function createBrowserStorage(source = globalThis.localStorage) {
  const fallback = createMemoryStorage();
  const target = source ?? fallback;
  return {
    getItem: key => target.getItem(key),
    setItem: (key, value) => target.setItem(key, value),
    removeItem: key => target.removeItem(key),
    clear: () => target.clear(),
    keys: () => typeof target.keys === 'function'
      ? target.keys()
      : Array.from({ length: target.length ?? 0 }, (_, index) => target.key(index)).filter(Boolean)
  };
}

export function createRuntime({
  now = () => performance.now(),
  random = Math.random,
  storage = createBrowserStorage(),
  logger = createEventLogger({ now })
} = {}) {
  return createCoreRuntime({ now, random, storage, logger });
}

export const browserRuntime = createRuntime();
