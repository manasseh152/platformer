import { expect, test } from '@playwright/test';
import { createDevToolsRegistry, createDevToolsState } from '#/devtools/toolbox.js';
import { registerRenderPipelineDevTools, summarizeRenderFrame } from '#/devtools/render-pipeline.js';

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

test('render pipeline devtools register render diagnostics and systems sections', () => {
  const game = { devTools: createDevToolsState(), renderPipeline: { diagnostics: { requestedBackendKind: 'auto', selectedBackendKind: 'canvas2d', frame: { width: 320, height: 180, coordinateSpace: 'native', packetCount: 2, packetsByKind: [['clear', 1], ['rect', 1]], lightCount: 0, litPacketCount: 1, unlitPacketCount: 1 } } }, appState: { started: true }, enemies: [], dust: [], particles: [] };
  registerRenderPipelineDevTools(game);

  const sections = game.devTools.registry.snapshot();
  expect(sections.map(section => section.id)).toEqual(['systems', 'render']);
  expect(sections.find(section => section.id === 'render').items.map(item => item.id)).toEqual(expect.arrayContaining(['backend-kind', 'packet-kinds', 'force-deferred-lighting', 'disable-deferred-lighting']));
  expect(sections.find(section => section.id === 'systems').items.map(item => item.id)).toEqual(expect.arrayContaining(['active-scene', 'app-state', 'actors']));
});

test('render frame summary counts packet diagnostics for devtools', () => {
  const summary = summarizeRenderFrame({ width: 8, height: 4, coordinateSpace: 'native', packets: [
    { kind: 'clear', layer: 0, lighting: 'unlit' },
    { kind: 'rect', layer: 10, lighting: 'lit' },
    { kind: 'light2d', layer: 20, lighting: 'light' }
  ] });

  expect(summary).toMatchObject({ width: 8, height: 4, coordinateSpace: 'native', packetCount: 3, lightCount: 1, litPacketCount: 1, unlitPacketCount: 1 });
  expect(summary.packetsByKind).toEqual([['clear', 1], ['light2d', 1], ['rect', 1]]);
  expect(summary.packetsByLayer).toEqual([[0, 1], [10, 1], [20, 1]]);
});

test('render pipeline fallback summary groups repeated WebGL support issues', () => {
  const game = {
    devTools: createDevToolsState(),
    renderPipeline: {
      webglFallbackReason: [
        { reason: 'unsupported packet kind: roundRect' },
        { reason: 'unsupported packet kind: roundRect' },
        { reason: 'unsupported packet kind: ellipse' }
      ]
    },
    appState: {},
    enemies: [],
    dust: [],
    particles: []
  };
  registerRenderPipelineDevTools(game);
  const fallbackItem = game.devTools.registry.getSections()
    .find(section => section.id === 'render')
    .items.find(item => item.id === 'fallback-reason');

  expect(fallbackItem.get(game)).toBe('unsupported packet kind: roundRect ×2; unsupported packet kind: ellipse');
});
