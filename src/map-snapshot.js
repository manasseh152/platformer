import { assets } from './assets.js';
import { getDefaultTilemap } from './content/tilemaps/registry.js';
import { createCanvas2DNativeFrameBackend } from './render/backends/canvas2d-native-frame-backend.js';
import { defaultAssetRegistry } from './render/browser-asset-registry.js';
import { extractTilemapSnapshotRenderFrame } from './render/extractors/tilemap-snapshot-extractor.js';

function waitForAsset(asset) {
  if (!asset || typeof asset.addEventListener !== 'function' || asset.complete) return Promise.resolve();
  return new Promise(resolve => {
    asset.addEventListener('load', resolve, { once: true });
    asset.addEventListener('error', resolve, { once: true });
  });
}

export async function waitForMapAssets() {
  await Promise.all(Object.values(assets).map(waitForAsset));
}

export async function renderMapToCanvas(sourceTilemap = getDefaultTilemap()) {
  await waitForMapAssets();
  const canvas = document.createElement('canvas');
  const backend = createCanvas2DNativeFrameBackend({ width: sourceTilemap.worldWidth, height: sourceTilemap.worldHeight, canvas, assetRegistry: defaultAssetRegistry });
  backend.draw(extractTilemapSnapshotRenderFrame(sourceTilemap, { assetRegistry: defaultAssetRegistry }));
  return canvas;
}

export async function renderMapToDataUrl(sourceTilemap = getDefaultTilemap()) {
  return (await renderMapToCanvas(sourceTilemap)).toDataURL('image/png');
}
