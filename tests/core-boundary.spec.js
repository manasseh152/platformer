import { expect, test } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const coreRoot = path.resolve('src/core');
const bannedGlobals = ['document', 'window', 'navigator', 'localStorage', 'sessionStorage', 'ResizeObserver', 'HTMLCanvasElement', 'performance'];

async function jsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? jsFiles(full) : entry.name.endsWith('.js') ? [full] : [];
  }));
  return nested.flat();
}

test('core modules only import within core', async () => {
  for (const file of await jsFiles(coreRoot)) {
    const source = await readFile(file, 'utf8');
    const imports = source.matchAll(/from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    for (const match of imports) {
      const specifier = match[1] ?? match[2];
      if (!specifier.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(file), specifier);
      expect(resolved, `${path.relative('.', file)} imports ${specifier}`).toContain(coreRoot);
    }
  }
});

test('core modules do not reference browser globals directly', async () => {
  for (const file of await jsFiles(coreRoot)) {
    const source = await readFile(file, 'utf8');
    for (const name of bannedGlobals) {
      expect(source, `${path.relative('.', file)} references ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  }
});
