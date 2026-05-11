import { expect, test } from '@playwright/test';
import { createEventLogger, createMemoryStorage, createRuntime, createSeededRandom } from '#/app/runtime/browser-runtime.js';

test('seeded random is deterministic for matching seeds', () => {
  const a = createSeededRandom('gym-seed');
  const b = createSeededRandom('gym-seed');
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

test('memory storage follows the Web Storage shape without touching browser storage', () => {
  const storage = createMemoryStorage({ existing: 'value' });
  expect(storage.getItem('existing')).toBe('value');
  expect(storage.getItem('missing')).toBeNull();
  storage.setItem('answer', 42);
  expect(storage.getItem('answer')).toBe('42');
  expect(storage.dump()).toEqual({ existing: 'value', answer: '42' });
  storage.removeItem('existing');
  expect(storage.dump()).toEqual({ answer: '42' });
});

test('runtime event logger records stable ordered events', () => {
  let now = 100;
  const logger = createEventLogger({ now: () => now });
  const runtime = createRuntime({ now: () => now, random: () => 0.5, storage: createMemoryStorage(), logger });

  runtime.emit('gym.start', { id: 'ui-navigation-gym' });
  now = 116;
  runtime.emit('gym.frame', { frame: 1 });

  expect(runtime.events()).toEqual([
    { index: 0, time: 100, type: 'gym.start', detail: { id: 'ui-navigation-gym' } },
    { index: 1, time: 116, type: 'gym.frame', detail: { frame: 1 } }
  ]);
});
