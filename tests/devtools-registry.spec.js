import { expect, test } from '@playwright/test';
import { createDevToolsRegistry } from '../src/devtools/toolbox.js';

test('devtools registry sorts sections and items by order with registration fallback', () => {
  const registry = createDevToolsRegistry();
  registry.registerSection({ id: 'render', title: 'Render', order: 200, items: [
    { id: 'late', kind: 'value', label: 'Late', order: 20, get: () => 'late' },
    { id: 'early', kind: 'value', label: 'Early', order: 10, get: () => 'early' }
  ] });
  registry.registerSection({ id: 'session', title: 'Session', order: 0, items: [
    { id: 'tilemap', kind: 'value', label: 'Tilemap', get: () => 'Act 1' }
  ] });
  registry.registerSection({ id: 'entities', title: 'Entities', items: [
    { id: 'count', kind: 'value', label: 'Count', get: () => '3' }
  ] });

  const sections = registry.snapshot();
  expect(sections.map(section => section.id)).toEqual(['session', 'entities', 'render']);
  expect(sections.find(section => section.id === 'render').items.map(item => item.id)).toEqual(['early', 'late']);
});

test('devtools registry merges duplicate sections and keeps first title', () => {
  const registry = createDevToolsRegistry();
  registry.registerSection({ id: 'physics', title: 'Physics', order: 100, items: [
    { id: 'gravity', kind: 'value', label: 'Gravity', get: () => 'on' }
  ] });
  registry.registerSection({ id: 'physics', title: 'Physics Extra', order: 50, items: [
    { id: 'freeze', kind: 'toggle', label: 'Freeze', get: game => Boolean(game.frozen), set: (game, value) => { game.frozen = value; } }
  ] });

  const [section] = registry.snapshot();
  expect(section).toMatchObject({ id: 'physics', title: 'Physics', order: 50 });
  expect(section.items.map(item => item.id)).toEqual(['gravity', 'freeze']);
});

test('devtools registry throws on duplicate item ids inside a merged section', () => {
  const registry = createDevToolsRegistry();
  registry.registerSection({ id: 'physics', title: 'Physics', items: [
    { id: 'show-boxes', kind: 'value', label: 'Show Boxes', get: () => 'off' }
  ] });

  expect(() => registry.registerSection({ id: 'physics', title: 'Physics', items: [
    { id: 'show-boxes', kind: 'value', label: 'Show Boxes Again', get: () => 'off' }
  ] })).toThrow('Duplicate devtool item "physics.show-boxes"');
});

test('devtools registry validates first pass item kinds', () => {
  const registry = createDevToolsRegistry();
  expect(() => registry.registerSection({ id: 'bad', title: 'Bad', items: [
    { id: 'custom', kind: 'custom', label: 'Custom' }
  ] })).toThrow('Unsupported devtool item kind');
});
