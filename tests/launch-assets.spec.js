import { expect, test } from '@playwright/test';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { getLaunchAssetGroups, getLaunchAssets, launchAssetsManifest, expandScreenshotMatrix } from '../tools/launch-assets.manifest.js';
import { validateBuiltLaunchAssets } from '../tools/validate-launch-assets.js';

const publicPath = /^public\//;

async function copyActiveAssetsToDist(distDir) {
  for (const asset of getLaunchAssets()) {
    const relativePublicPath = asset.path.replace(/^public\//, '');
    const targetPath = resolve(distDir, relativePublicPath);
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(resolve(asset.path), targetPath);
  }
}

test('launch asset manifest has grouped schema with active and planned groups', () => {
  expect(launchAssetsManifest.version).toBe(1);
  expect(Object.keys(launchAssetsManifest.groups)).toEqual(expect.arrayContaining([
    'icons',
    'favicons',
    'wordmarks',
    'openGraph',
    'screenshots',
    'mapReviews'
  ]));

  for (const group of Object.values(launchAssetsManifest.groups)) {
    expect(group).toEqual(expect.objectContaining({
      id: expect.any(String),
      label: expect.any(String),
      status: expect.stringMatching(/^(active|planned)$/)
    }));
    expect(group.assets || group.matrix).toBeTruthy();
  }
});

test('active filtering is default and complete includes planned assets', () => {
  const activeGroups = getLaunchAssetGroups();
  expect(activeGroups.every(group => group.status === 'active')).toBe(true);
  expect(activeGroups.map(group => group.id)).toContain('screenshots');

  const complete = getLaunchAssets({ complete: true });
  expect(complete.some(asset => asset.status === 'planned')).toBe(true);
  expect(complete.map(asset => asset.id)).toContain('act-01-level-3-full-map-review');
});

test('screenshot matrix expands all subject viewport format combinations', () => {
  const matrix = launchAssetsManifest.groups.screenshots.matrix;
  const screenshots = expandScreenshotMatrix(matrix);

  expect(screenshots).toHaveLength(
    matrix.subjects.length * matrix.viewports.length * matrix.formats.length
  );
  expect(screenshots).toContainEqual(expect.objectContaining({
    id: 'scenario-browser-desktop-1920x1080',
    path: 'public/store/screenshots/scenario-browser/desktop-1920x1080.png',
    route: '/?capture=scenario-browser',
    waitFor: 'html[data-capture-ready="scenario-browser"]',
    dimensions: { width: 1920, height: 1080 }
  }));
});

test('launch asset output path conventions stay under public with expected filenames', () => {
  const assets = getLaunchAssets({ complete: true });
  expect(assets.every(asset => publicPath.test(asset.path))).toBe(true);
  expect(assets.filter(asset => asset.generator === 'icons').map(asset => asset.path)).toEqual(expect.arrayContaining([
    'public/icons/chibi-hollow-icon.svg',
    'public/icons/favicon.svg',
    'public/icons/favicon-16.png',
    'public/icons/favicon-32.png',
    'public/icons/apple-touch-icon.png',
    'public/icons/icon-192.png',
    'public/icons/icon-512.png',
    'public/icons/icon-maskable-512.png',
    'public/logos/chibi-hollow-wordmark.svg',
    'public/og-image.svg',
    'public/og-image.png',
    'public/favicon.ico'
  ]));
});

test('built validation rejects missing dist fixture', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'chibi-built-assets-missing-'));
  try {
    const errors = await validateBuiltLaunchAssets({ distDir: resolve(root, 'dist') });
    expect(errors).toContainEqual(expect.objectContaining({
      message: expect.stringContaining('does not exist')
    }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('built validation accepts fixture manifest and HTML with copied public assets', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'chibi-built-assets-valid-'));
  const distDir = resolve(root, 'dist');
  try {
    await mkdir(distDir, { recursive: true });
    await copyFile('tests/fixtures/launch-assets-built/valid/built-output/index.html', resolve(distDir, 'index.html'));
    await copyFile('tests/fixtures/launch-assets-built/valid/built-output/manifest.webmanifest', resolve(distDir, 'manifest.webmanifest'));
    await copyActiveAssetsToDist(distDir);

    const errors = await validateBuiltLaunchAssets({ distDir });
    expect(errors).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
