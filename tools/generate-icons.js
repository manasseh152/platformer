#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

function resolveOutputPaths(outDir = 'public') {
  const root = resolve(outDir);
  return {
    root,
    iconSvg: resolve(root, 'icons/chibi-hollow-icon.svg'),
    faviconSvg: resolve(root, 'icons/favicon.svg'),
    faviconIco: resolve(root, 'favicon.ico'),
    wordmarkSvg: resolve(root, 'logos/chibi-hollow-wordmark.svg'),
    ogSvg: resolve(root, 'og-image.svg'),
    ogPng: resolve(root, 'og-image.png')
  };
}

function resolvePngTargets(outDir = 'public') {
  const root = resolve(outDir);
  return [
    { path: resolve(root, 'icons/favicon-16.png'), size: 16, source: 'icon' },
    { path: resolve(root, 'icons/favicon-32.png'), size: 32, source: 'icon' },
    { path: resolve(root, 'icons/apple-touch-icon.png'), size: 180, source: 'icon' },
    { path: resolve(root, 'icons/icon-192.png'), size: 192, source: 'icon' },
    { path: resolve(root, 'icons/icon-512.png'), size: 512, source: 'icon' },
    { path: resolve(root, 'icons/icon-maskable-512.png'), size: 512, source: 'maskable' }
  ];
}

function appIconSvg({ maskable = false } = {}) {
  const inset = maskable ? 48 : 20;
  const bgRadius = maskable ? 96 : 72;
  const moon = maskable ? 172 : 156;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-labelledby="title desc">
  <title id="title">Chibi Hollow app icon</title>
  <desc id="desc">Pixel-art shield mark with a chibi knight helmet, sword, and moon.</desc>
  <defs>
    <linearGradient id="night" x1="96" y1="44" x2="416" y2="468" gradientUnits="userSpaceOnUse">
      <stop stop-color="#17213b"/>
      <stop offset="0.55" stop-color="#0b1020"/>
      <stop offset="1" stop-color="#05070d"/>
    </linearGradient>
    <linearGradient id="grass" x1="140" y1="356" x2="372" y2="448" gradientUnits="userSpaceOnUse">
      <stop stop-color="#5bd36a"/>
      <stop offset="1" stop-color="#218b4a"/>
    </linearGradient>
    <filter id="shadow" x="0" y="0" width="512" height="512" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect x="${inset}" y="${inset}" width="${512 - inset * 2}" height="${512 - inset * 2}" rx="${bgRadius}" fill="url(#night)"/>
  <path d="M256 70 390 126v136c0 92-53 151-134 190-81-39-134-98-134-190V126L256 70Z" fill="#111827" stroke="#f5c84b" stroke-width="18" stroke-linejoin="round" filter="url(#shadow)"/>
  <path d="M256 92 367 138v124c0 74-38 124-111 164-73-40-111-90-111-164V138L256 92Z" fill="#19213a"/>
  <circle cx="${moon}" cy="150" r="38" fill="#ffe38f"/>
  <circle cx="${moon + 18}" cy="138" r="38" fill="#19213a"/>
  <path d="M130 394h252v34H130z" fill="url(#grass)"/>
  <path d="M170 366h172v34H170z" fill="#37b662"/>
  <path d="M322 160h32v188h-32z" fill="#f8fafc"/>
  <path d="M306 194h64v24h-64z" fill="#f5c84b"/>
  <path d="M314 348h48v38h-48z" fill="#8b5a2b"/>
  <path d="M182 204h148v42h-22v44h-24v32h-56v-32h-24v-44h-22z" fill="#d9e2ef"/>
  <path d="M204 182h104v42H204z" fill="#eef4ff"/>
  <path d="M226 154h60v42h-60z" fill="#f5c84b"/>
  <path d="M204 246h104v38H204z" fill="#1f2937"/>
  <path d="M220 246h20v20h-20zm52 0h20v20h-20z" fill="#71f0ff"/>
  <path d="M236 290h40v18h-40z" fill="#f29f67"/>
  <path d="M158 250h46v44h-46z" fill="#a7b4c8"/>
  <path d="M308 250h46v44h-46z" fill="#a7b4c8"/>
  <path d="M194 326h124v42H194z" fill="#e14848"/>
  <path d="M222 326h68v42h-68z" fill="#f05b5b"/>
  <path d="M162 140h32v32h-32zm206 206h24v24h-24zm-254 190h284v-24H114z" fill="#f5c84b" opacity="0.9"/>
</svg>`;
}

function iconInnerSvg() {
  return appIconSvg().replace(/^[\s\S]*?<svg[^>]*>|<\/svg>$/g, '');
}

function wordmarkSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="320" viewBox="0 0 960 320" role="img" aria-labelledby="title desc">
  <title id="title">Chibi Hollow wordmark</title>
  <desc id="desc">Chibi Hollow text lockup with the app icon.</desc>
  <rect width="960" height="320" rx="40" fill="#080b11"/>
  <svg x="38" y="38" width="244" height="244" viewBox="0 0 512 512">${iconInnerSvg()}</svg>
  <text x="318" y="145" font-family="Geist Mono, ui-monospace, monospace" font-size="66" font-weight="800" fill="#f8fafc" letter-spacing="2">CHIBI</text>
  <text x="318" y="222" font-family="Geist Mono, ui-monospace, monospace" font-size="78" font-weight="900" fill="#f5c84b" letter-spacing="1">HOLLOW</text>
  <path d="M320 244h410" stroke="#37b662" stroke-width="12" stroke-linecap="square"/>
  <path d="M750 244h54v12h-54zM822 244h36v12h-36z" fill="#37b662"/>
</svg>`;
}

function ogImageSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">Chibi Hollow link preview</title>
  <desc id="desc">A cozy fantasy pixel platformer link preview with a chibi knight crest.</desc>
  <defs>
    <linearGradient id="ogNight" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#18213a"/>
      <stop offset="0.48" stop-color="#080b11"/>
      <stop offset="1" stop-color="#03130f"/>
    </linearGradient>
    <radialGradient id="ogGlow" cx="0" cy="0" r="1" gradientTransform="matrix(420 0 0 260 860 190)" gradientUnits="userSpaceOnUse">
      <stop stop-color="#f5c84b" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#f5c84b" stop-opacity="0"/>
    </radialGradient>
    <filter id="ogShadow" x="-20%" y="-20%" width="140%" height="150%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#ogNight)"/>
  <rect width="1200" height="630" fill="url(#ogGlow)"/>
  <circle cx="980" cy="116" r="78" fill="#ffe38f"/>
  <circle cx="1017" cy="92" r="78" fill="#111827"/>
  <path d="M0 470h1200v160H0z" fill="#10251d"/>
  <path d="M0 506h1200v124H0z" fill="#173a2c"/>
  <path d="M0 552h1200v78H0z" fill="#225f3e"/>
  <path d="M48 474h72v42H48zm104 34h118v44H152zm694-24h82v48h-82zm130 28h172v48H976z" fill="#2f8750"/>
  <path d="M62 490h1066" stroke="#44c96b" stroke-width="10" stroke-linecap="square" stroke-dasharray="54 26" opacity="0.85"/>
  <svg x="726" y="132" width="330" height="330" viewBox="0 0 512 512" filter="url(#ogShadow)">${iconInnerSvg()}</svg>
  <text x="96" y="174" font-family="Geist Mono, ui-monospace, monospace" font-size="42" font-weight="800" fill="#71f0ff" letter-spacing="5">COZY FANTASY PLATFORMER</text>
  <text x="92" y="300" font-family="Geist Mono, ui-monospace, monospace" font-size="98" font-weight="900" fill="#f8fafc" letter-spacing="1">CHIBI</text>
  <text x="92" y="402" font-family="Geist Mono, ui-monospace, monospace" font-size="106" font-weight="900" fill="#f5c84b" letter-spacing="1">HOLLOW</text>
  <path d="M98 430h492" stroke="#37b662" stroke-width="14" stroke-linecap="square"/>
  <text x="100" y="496" font-family="Geist Mono, ui-monospace, monospace" font-size="30" font-weight="700" fill="#d9e2ef">Dash, climb, and adventure through moonlit ruins.</text>
</svg>`;
}

async function writeText(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  console.log(`Wrote ${path}`);
}

async function renderPng(page, svg, size, outputPath) {
  await renderSvgToPng(page, svg, size, size, outputPath);
}

async function renderSvgToPng(page, svg, width, height, outputPath) {
  await page.setViewportSize({ width, height });
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  await page.setContent(`<!doctype html><html><body><img src="${dataUrl}" width="${width}" height="${height}" /></body></html>`);
  await page.addStyleTag({ content: 'html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden} img{display:block;width:100%;height:100%;image-rendering:auto}' });
  await page.locator('img').screenshot({ path: outputPath, omitBackground: true });
  console.log(`Rendered ${outputPath} (${width}x${height})`);
}

async function writeIco(entries, outputPath) {
  const images = await Promise.all(entries.map(async entry => ({ ...entry, data: await readFile(resolve(entry.path)) })));
  const headerSize = 6;
  const directorySize = images.length * 16;
  let offset = headerSize + directorySize;
  const header = Buffer.alloc(headerSize + directorySize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  images.forEach((image, index) => {
    const entryOffset = headerSize + index * 16;
    header.writeUInt8(image.size >= 256 ? 0 : image.size, entryOffset);
    header.writeUInt8(image.size >= 256 ? 0 : image.size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(image.data.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += image.data.length;
  });

  await writeText(outputPath, Buffer.concat([header, ...images.map(image => image.data)]));
}

export async function generateIcons({ outDir = 'public' } = {}) {
  const outputs = resolveOutputPaths(outDir);
  const pngTargets = resolvePngTargets(outDir);
  const icon = appIconSvg();
  const maskableIcon = appIconSvg({ maskable: true });
  const wordmark = wordmarkSvg();
  const ogImage = ogImageSvg();

  await writeText(outputs.iconSvg, icon);
  await writeText(outputs.faviconSvg, icon);
  await writeText(outputs.wordmarkSvg, wordmark);
  await writeText(outputs.ogSvg, ogImage);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const target of pngTargets) {
      await mkdir(dirname(target.path), { recursive: true });
      await renderPng(page, target.source === 'maskable' ? maskableIcon : icon, target.size, target.path);
    }
    await renderSvgToPng(page, ogImage, 1200, 630, outputs.ogPng);
    await writeIco([
      { path: resolve(outputs.root, 'icons/favicon-16.png'), size: 16 },
      { path: resolve(outputs.root, 'icons/favicon-32.png'), size: 32 }
    ], outputs.faviconIco);
  } finally {
    await browser.close();
  }
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

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  generateIcons(parseArgs(process.argv.slice(2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
