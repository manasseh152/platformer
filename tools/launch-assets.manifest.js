export const launchAssetsManifest = {
  version: 1,
  groups: {
    icons: {
      id: 'icons',
      label: 'App icons',
      status: 'active',
      generator: 'icons',
      assets: [
        { id: 'app-icon-svg', path: 'public/icons/chibi-hollow-icon.svg', mediaType: 'image/svg+xml', dimensions: { width: 512, height: 512 } },
        { id: 'app-icon-192', path: 'public/icons/icon-192.png', mediaType: 'image/png', dimensions: { width: 192, height: 192 } },
        { id: 'app-icon-512', path: 'public/icons/icon-512.png', mediaType: 'image/png', dimensions: { width: 512, height: 512 } },
        { id: 'app-icon-maskable-512', path: 'public/icons/icon-maskable-512.png', mediaType: 'image/png', dimensions: { width: 512, height: 512 }, purpose: 'maskable' }
      ]
    },
    favicons: {
      id: 'favicons',
      label: 'Browser favicons',
      status: 'active',
      generator: 'icons',
      assets: [
        { id: 'favicon-svg', path: 'public/icons/favicon.svg', mediaType: 'image/svg+xml', dimensions: { width: 512, height: 512 }, htmlReferences: [{ file: 'index.html', text: '<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />' }] },
        { id: 'favicon-16', path: 'public/icons/favicon-16.png', mediaType: 'image/png', dimensions: { width: 16, height: 16 } },
        { id: 'favicon-32', path: 'public/icons/favicon-32.png', mediaType: 'image/png', dimensions: { width: 32, height: 32 }, htmlReferences: [{ file: 'index.html', text: '<link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png" />' }] },
        { id: 'apple-touch-icon', path: 'public/icons/apple-touch-icon.png', mediaType: 'image/png', dimensions: { width: 180, height: 180 }, htmlReferences: [{ file: 'index.html', text: '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />' }] },
        { id: 'favicon-ico', path: 'public/favicon.ico', mediaType: 'image/x-icon', icoEntries: [{ width: 16, height: 16 }, { width: 32, height: 32 }] }
      ]
    },
    wordmarks: {
      id: 'wordmarks',
      label: 'Brand wordmarks',
      status: 'active',
      generator: 'icons',
      assets: [
        { id: 'chibi-hollow-wordmark', path: 'public/logos/chibi-hollow-wordmark.svg', mediaType: 'image/svg+xml', dimensions: { width: 960, height: 320 } }
      ]
    },
    openGraph: {
      id: 'openGraph',
      label: 'Open Graph previews',
      status: 'active',
      generator: 'icons',
      assets: [
        { id: 'og-image-svg', path: 'public/og-image.svg', mediaType: 'image/svg+xml', dimensions: { width: 1200, height: 630 } },
        { id: 'og-image-png', path: 'public/og-image.png', mediaType: 'image/png', dimensions: { width: 1200, height: 630 }, htmlReferences: [{ file: 'index.html', text: '<meta property="og:image" content="/og-image.png" />' }, { file: 'index.html', text: '<meta name="twitter:image" content="/og-image.png" />' }] }
      ]
    },
    screenshots: {
      id: 'screenshots',
      label: 'Store and social screenshots',
      status: 'active',
      generator: 'screenshots',
      matrix: {
        subjects: [
          { id: 'start-screen', route: '/?capture=start-screen', waitFor: 'html[data-capture-ready="start-screen"]' },
          { id: 'campaign-gameplay', route: '/?capture=campaign-gameplay', waitFor: 'html[data-capture-ready="campaign-gameplay"]' },
          { id: 'map-editor', route: '/editor?capture=map-editor', waitFor: 'html[data-capture-ready="map-editor"]' },
          { id: 'scenario-browser', route: '/?capture=scenario-browser', waitFor: 'html[data-capture-ready="scenario-browser"]' }
        ],
        viewports: [
          { id: 'desktop-1920x1080', width: 1920, height: 1080 },
          { id: 'mobile-landscape-2340x1080', width: 2340, height: 1080 },
          { id: 'tablet-landscape-2732x2048', width: 2732, height: 2048 }
        ],
        formats: ['png'],
        pathTemplate: 'public/store/screenshots/{subject}/{viewport}.{format}'
      }
    },
    mapReviews: {
      id: 'mapReviews',
      label: 'Full-map review renders',
      status: 'active',
      generator: 'mapRender',
      ownership: 'review',
      assets: [
        { id: 'act-01-level-3-full-map-review', path: '.temp/launch-assets/review/act-01-level-3-full-map.png', mediaType: 'image/png', dimensions: { width: 1280, height: 768 }, source: { kind: 'tilemap', tilemapId: 'act-01-level-3' } }
      ]
    }
  }
};

export function expandScreenshotMatrix(matrix, { subjects = matrix.subjects, viewports = matrix.viewports } = {}) {
  const subjectDefs = new Map(matrix.subjects.map(subject => [typeof subject === 'string' ? subject : subject.id, subject]));
  const viewportDefs = new Map(matrix.viewports.map(viewport => [viewport.id, viewport]));
  const selectedSubjects = subjects.map(subject => typeof subject === 'string' ? subjectDefs.get(subject) : subject).filter(Boolean);
  const selectedViewports = viewports.map(viewport => typeof viewport === 'string' ? viewportDefs.get(viewport) : viewport).filter(Boolean);
  const assets = [];
  for (const subject of selectedSubjects) {
    for (const viewport of selectedViewports) {
      for (const format of matrix.formats) {
        const path = matrix.pathTemplate
          .replace('{subject}', subject.id)
          .replace('{viewport}', viewport.id)
          .replace('{format}', format);
        assets.push({
          id: `${subject.id}-${viewport.id}`,
          path,
          mediaType: `image/${format}`,
          dimensions: { width: viewport.width, height: viewport.height },
          subject: subject.id,
          route: subject.route,
          waitFor: subject.waitFor,
          viewport: viewport.id
        });
      }
    }
  }
  return assets;
}

export function getScreenshotCaptureAssets({ subjects, viewports } = {}) {
  return expandScreenshotMatrix(launchAssetsManifest.groups.screenshots.matrix, { subjects, viewports });
}

export function getLaunchAssetGroups({ complete = false } = {}) {
  return Object.values(launchAssetsManifest.groups)
    .filter(group => complete || group.status === 'active')
    .map(group => ({
      ...group,
      assets: group.assets ?? (group.matrix ? expandScreenshotMatrix(group.matrix) : [])
    }));
}

export function getLaunchAssets(options = {}) {
  return getLaunchAssetGroups(options).flatMap(group => group.assets.map(asset => ({
    status: asset.status ?? group.status,
    generator: asset.generator ?? group.generator,
    ownership: asset.ownership ?? group.ownership ?? 'release',
    group: group.id,
    ...asset
  })));
}
