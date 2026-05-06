#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const outputPath = resolve(process.argv[2] ?? '.temp/full-map.png');
const tilemapId = process.argv[3] ?? null;
const host = '127.0.0.1';
const port = Number(process.env.MAP_RENDER_PORT ?? 4174);
const baseUrl = `http://${host}:${port}`;

async function waitForServer(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}${lastError ? `: ${lastError.message}` : ''}`);
}

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', host, '--port', String(port), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, BROWSER: 'none' }
});

vite.stdout.on('data', chunk => process.stdout.write(chunk));
vite.stderr.on('data', chunk => process.stderr.write(chunk));

let browser;
try {
  await waitForServer(baseUrl);
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const result = await page.evaluate(async selectedTilemapId => {
    const { renderMapToDataUrl } = await import('/src/map-snapshot.js');
    const { getDefaultTilemap, getTilemapById } = await import('/src/content/tilemaps/registry.js');
    const tilemap = selectedTilemapId ? getTilemapById(selectedTilemapId) : getDefaultTilemap();
    if (!tilemap) throw new Error(`Unknown tilemap '${selectedTilemapId}'`);
    const dataUrl = await renderMapToDataUrl(tilemap);
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    return { dataUrl, width: image.naturalWidth, height: image.naturalHeight, tilemapId: tilemap.id };
  }, tilemapId);

  const png = Buffer.from(result.dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, png);
  console.log(`Rendered tilemap PNG: ${outputPath} [${result.tilemapId}] (${result.width}x${result.height})`);
} finally {
  await browser?.close();
  vite.kill();
}
