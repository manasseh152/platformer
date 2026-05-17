#!/usr/bin/env node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLaunchAssets } from './launch-assets.manifest.js';
import { generateIcons } from './generate-icons.js';

function parseArgs(argv) {
  const args = { complete: false };
  for (const arg of argv) {
    if (arg === '--complete') args.complete = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function fail(asset, message, remediation) {
  return { asset, message, remediation };
}

function parsePngDimensions(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature) throw new Error('not a PNG file');
  if (buffer.subarray(12, 16).toString('ascii') !== 'IHDR') throw new Error('missing PNG IHDR chunk');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function parseIcoDirectory(buffer) {
  if (buffer.length < 6) throw new Error('ICO header is truncated');
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) throw new Error('not an ICO file');
  const count = buffer.readUInt16LE(4);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    if (buffer.length < offset + 16) throw new Error('ICO directory is truncated');
    entries.push({
      width: buffer.readUInt8(offset) || 256,
      height: buffer.readUInt8(offset + 1) || 256,
      bytes: buffer.readUInt32LE(offset + 8),
      imageOffset: buffer.readUInt32LE(offset + 12)
    });
  }
  return entries;
}

function parseSvgDimensions(text) {
  const svg = text.match(/<svg\b[^>]*>/i)?.[0];
  if (!svg) throw new Error('missing <svg> root');
  const width = Number(svg.match(/\bwidth="(\d+)"/i)?.[1]);
  const height = Number(svg.match(/\bheight="(\d+)"/i)?.[1]);
  if (!width || !height) throw new Error('missing numeric SVG width/height');
  return { width, height };
}

function expectDimensions(actual, expected) {
  return actual.width === expected.width && actual.height === expected.height;
}

async function validateAsset(asset) {
  const errors = [];
  const path = resolve(asset.path);
  if (!existsSync(path)) {
    errors.push(fail(asset, `${asset.path} is missing`, asset.status === 'planned'
      ? `Capture or generate planned asset ${asset.id} at ${asset.path}, or keep validation in active-only mode.`
      : `Run bun run generate:launch-assets to recreate ${asset.path}.`));
    return errors;
  }

  const buffer = await readFile(path);
  try {
    if (asset.mediaType === 'image/png' && asset.dimensions) {
      const actual = parsePngDimensions(buffer);
      if (!expectDimensions(actual, asset.dimensions)) {
        errors.push(fail(asset, `${asset.path} is ${actual.width}x${actual.height}; expected ${asset.dimensions.width}x${asset.dimensions.height}`, `Regenerate or recapture ${asset.path} at the manifest dimensions.`));
      }
    }
    if (asset.mediaType === 'image/svg+xml' && asset.dimensions) {
      const actual = parseSvgDimensions(buffer.toString('utf8'));
      if (!expectDimensions(actual, asset.dimensions)) {
        errors.push(fail(asset, `${asset.path} is ${actual.width}x${actual.height}; expected ${asset.dimensions.width}x${asset.dimensions.height}`, `Update the SVG root dimensions or the manifest entry for ${asset.id}.`));
      }
    }
    if (asset.mediaType === 'image/x-icon') {
      const actual = parseIcoDirectory(buffer).map(entry => ({ width: entry.width, height: entry.height }));
      const expected = asset.icoEntries ?? [];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        errors.push(fail(asset, `${asset.path} ICO entries are ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}`, `Run bun run generate:launch-assets to rebuild favicon.ico.`));
      }
    }
  } catch (error) {
    errors.push(fail(asset, `${asset.path} could not be parsed: ${error.message}`, `Regenerate ${asset.path} or fix its manifest mediaType.`));
  }

  for (const reference of asset.htmlReferences ?? []) {
    const sourcePath = resolve(reference.file);
    const source = existsSync(sourcePath) ? await readFile(sourcePath, 'utf8') : '';
    if (!source.includes(reference.text)) {
      errors.push(fail(asset, `${reference.file} does not reference ${asset.id}`, `Add or restore: ${reference.text}`));
    }
  }

  return errors;
}

async function validateGeneratedBytes(assets) {
  const generatedAssets = assets.filter(asset => asset.generator === 'icons');
  if (generatedAssets.length === 0) return [];
  const tempDir = await mkdtemp(resolve(tmpdir(), 'chibi-launch-assets-'));
  try {
    await generateIcons({ outDir: tempDir });
    const errors = [];
    for (const asset of generatedAssets) {
      const currentPath = resolve(asset.path);
      if (!existsSync(currentPath)) continue;
      const generatedPath = resolve(tempDir, relative(resolve('public'), currentPath));
      if (!existsSync(generatedPath)) {
        errors.push(fail(asset, `Temporary generation did not produce ${relative(tempDir, generatedPath)}`, `Check generator output path conventions for ${asset.id}.`));
        continue;
      }
      const current = await readFile(currentPath);
      const generated = await readFile(generatedPath);
      if (!current.equals(generated)) {
        errors.push(fail(asset, `${asset.path} differs from freshly generated output`, `Run bun run generate:launch-assets and commit the regenerated ${asset.path}.`));
      }
    }
    return errors;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function validateLaunchAssets(options = {}) {
  const assets = getLaunchAssets(options);
  const nestedErrors = await Promise.all(assets.map(validateAsset));
  const errors = nestedErrors.flat();
  errors.push(...await validateGeneratedBytes(assets));
  return errors;
}

function printErrors(errors) {
  for (const error of errors) {
    console.error(`✗ ${error.message}`);
    console.error(`  Remediation: ${error.remediation}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const options = parseArgs(process.argv.slice(2));
  validateLaunchAssets(options).then(errors => {
    if (errors.length > 0) {
      printErrors(errors);
      process.exitCode = 1;
      return;
    }
    console.log(`✓ Launch assets valid (${options.complete ? 'active + planned' : 'active only'})`);
  }).catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

export { parsePngDimensions, parseIcoDirectory };
