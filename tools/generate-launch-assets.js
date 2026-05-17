#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateIcons } from './generate-icons.js';
import { getLaunchAssets } from './launch-assets.manifest.js';

function run(commandLine, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(commandLine, { stdio: 'inherit', shell: true, ...options });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${commandLine} exited with code ${code}`));
    });
  });
}

function parseArgs(argv) {
  const args = { outDir: 'public' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out-dir') {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--out-dir=')) {
      args.outDir = arg.slice('--out-dir='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.outDir) throw new Error('--out-dir requires a value');
  return args;
}

async function generateMapReviews() {
  const assets = getLaunchAssets().filter(asset => asset.generator === 'mapRender');
  for (const asset of assets) {
    if (asset.source?.kind !== 'tilemap' || !asset.source.tilemapId) {
      throw new Error(`Map review asset ${asset.id} is missing source.kind=tilemap and source.tilemapId`);
    }
    await run(`node tools/render-map.js ${JSON.stringify(asset.path)} ${JSON.stringify(asset.source.tilemapId)}`);
  }
}

export async function generateLaunchAssets(options = {}) {
  await generateIcons(options);
  if ((options.outDir ?? 'public') !== 'public') return;
  await generateMapReviews();
  await run('bunx playwright test -c playwright.launch-assets.config.js');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  generateLaunchAssets(parseArgs(process.argv.slice(2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
