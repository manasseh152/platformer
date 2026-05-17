import { expect, test } from '@playwright/test';
import { getLaunchAssetGroups, getLaunchAssets, launchAssetsManifest, expandScreenshotMatrix } from '../tools/launch-assets.manifest.js';

const publicPath = /^public\//;

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
  expect(activeGroups.map(group => group.id)).not.toContain('screenshots');

  const complete = getLaunchAssets({ complete: true });
  expect(complete.some(asset => asset.status === 'planned')).toBe(true);
  expect(complete.map(asset => asset.id)).toContain('act-01-level-3-full-map-review');
});

test('screenshot matrix expands all scenario viewport moment format combinations', () => {
  const matrix = launchAssetsManifest.groups.screenshots.matrix;
  const screenshots = expandScreenshotMatrix(matrix);

  expect(screenshots).toHaveLength(
    matrix.scenarios.length * matrix.viewports.length * matrix.moments.length * matrix.formats.length
  );
  expect(screenshots).toContainEqual(expect.objectContaining({
    id: 'act-01-level-3-action-desktop',
    path: 'public/screenshots/act-01-level-3-action-desktop.png',
    dimensions: { width: 1280, height: 720 },
    status: 'planned'
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
