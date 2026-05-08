export function createSeededRandom(seed = 0x12345678) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(String(seed));
  return function random() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createMemoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: key => entries.delete(key),
    clear: () => entries.clear(),
    keys: () => [...entries.keys()],
    dump: () => Object.fromEntries(entries)
  };
}

export function createEventLogger({ now = () => 0 } = {}) {
  const events = [];
  return {
    emit(type, detail = {}) {
      const event = { index: events.length, time: now(), type, detail };
      events.push(event);
      return event;
    },
    events: () => events.map(event => ({ ...event, detail: { ...event.detail } })),
    clear: () => { events.length = 0; }
  };
}

export function createRuntime({ now = () => 0, random = Math.random, storage = createMemoryStorage(), logger = createEventLogger({ now }) } = {}) {
  return { now, random, storage, logger, scenes: null, emit: (type, detail) => logger.emit(type, detail), events: () => logger.events() };
}
