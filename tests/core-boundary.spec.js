import { expect, test } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const catalogRoot = path.resolve('src/catalog');
const coreRoot = path.resolve('src/core');
const editorRoot = path.resolve('src/editor');
const engineRoot = path.resolve('src/engine');
const bannedGlobals = ['document', 'window', 'navigator', 'localStorage', 'sessionStorage', 'ResizeObserver', 'HTMLCanvasElement', 'performance'];

async function jsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? jsFiles(full) : entry.name.endsWith('.js') ? [full] : [];
  }));
  return nested.flat();
}

test('engine modules only import within engine', async () => {
  for (const file of await jsFiles(engineRoot)) {
    const source = await readFile(file, 'utf8');
    const imports = source.matchAll(/from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    for (const match of imports) {
      const specifier = match[1] ?? match[2];
      if (!specifier.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(file), specifier);
      expect(resolved, `${path.relative('.', file)} imports ${specifier}`).toContain(engineRoot);
    }
  }
});

test('core modules only import within core or engine', async () => {
  for (const file of await jsFiles(coreRoot)) {
    const source = await readFile(file, 'utf8');
    const imports = source.matchAll(/from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    for (const match of imports) {
      const specifier = match[1] ?? match[2];
      if (!specifier.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(file), specifier);
      expect(
        resolved.startsWith(coreRoot) || resolved.startsWith(engineRoot),
        `${path.relative('.', file)} imports ${specifier}`
      ).toBe(true);
    }
  }
});

test('catalog modules do not import editor modules', async () => {
  for (const file of await jsFiles(catalogRoot)) {
    const source = await readFile(file, 'utf8');
    const imports = source.matchAll(/from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    for (const match of imports) {
      const specifier = match[1] ?? match[2];
      if (!specifier.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(file), specifier);
      expect(resolved, `${path.relative('.', file)} imports ${specifier}`).not.toContain(editorRoot);
    }
  }
});

test('gameplay systems query scene components instead of tilemap compatibility helpers', async () => {
  const gameplaySystemFiles = [
    'src/core/gameplay-session.js',
    'src/core/gameplay-scene-queries.js',
    'src/core/physics.js'
  ];
  for (const file of gameplaySystemFiles) {
    const source = await readFile(path.resolve(file), 'utf8');
    expect(source, file).not.toMatch(/['"].*tilemaps\/tilemap\.js['"]/);
  }
});

test('world renderer does not import HUD/input presentation modules', async () => {
  const source = await readFile(path.resolve('src/render/world-renderer.js'), 'utf8');
  expect(source).not.toMatch(/input-presentation/);
  expect(source).not.toMatch(/gameplay-hud/);
  expect(source).not.toMatch(/['"]\.\.\/input\.js['"]/);
});

test('editor command helpers do not reference browser globals directly', async () => {
  const source = await readFile(path.resolve('src/editor/map-editor-commands.js'), 'utf8');
  for (const name of bannedGlobals) {
    expect(source, `src/editor/map-editor-commands.js references ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`));
  }
});

test('core and engine modules do not reference browser globals directly', async () => {
  for (const file of [...await jsFiles(coreRoot), ...await jsFiles(engineRoot)]) {
    const source = await readFile(file, 'utf8');
    for (const name of bannedGlobals) {
      expect(source, `${path.relative('.', file)} references ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  }
});
