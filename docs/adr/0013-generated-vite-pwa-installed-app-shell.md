# Use generated Vite PWA service worker for installed app shell

Chibi Hollow will use `vite-plugin-pwa` with Workbox `generateSW` to provide an installed app shell for the player-facing game and Map Editor. We chose the generated service worker over a custom `injectManifest` worker because the current need is standard precaching/runtime caching, with updates applying on next launch to avoid interrupting gameplay or authoring; Local Draft persistence remains owned by the Map Editor rather than the service worker.
