import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const sameOriginAssetCache = {
  urlPattern: ({ request, url }) =>
    url.origin === self.location.origin && ['document', 'font', 'image', 'style', 'script'].includes(request.destination),
  handler: 'CacheFirst',
  options: {
    cacheName: 'chibi-hollow-static-assets',
    expiration: {
      maxEntries: 160,
      maxAgeSeconds: 60 * 60 * 24 * 30
    },
    cacheableResponse: {
      statuses: [0, 200]
    }
  }
};

export default defineConfig({
  plugins: [
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.ico', 'icons/*.svg', 'icons/*.png', 'logos/*.svg', 'og-image.png'],
      manifest: {
        id: '/',
        name: 'Chibi Hollow Platformer',
        short_name: 'Chibi Hollow',
        description: 'A cozy fantasy pixel platformer.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#080b11',
        theme_color: '#080b11',
        categories: ['games', 'entertainment'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          {
            name: 'Map Editor',
            short_name: 'Editor',
            description: 'Author and save local Chibi Hollow tilemaps.',
            url: '/editor',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,json,webmanifest}'],
        runtimeCaching: [sameOriginAssetCache]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  resolve: {
    alias: {
      '#': resolve(__dirname, 'src')
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor/index.html'),
        editorLegacy: resolve(__dirname, 'editor.html'),
        docs: resolve(__dirname, 'docs.html')
      }
    }
  }
});
