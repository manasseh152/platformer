# Use a manifest-driven Launch Asset pipeline

Chibi Hollow needs store screenshots, Installed App assets, link-preview images, and visual review artifacts to be generated and validated consistently without losing the focused workflows already used for icons and tilemap rendering. We chose a single Launch Asset manifest as the source of truth for release-preparation coverage, with an umbrella generation/validation pipeline that reuses Playwright capture, icon generation, map rendering, and PWA setup while keeping standalone commands for local icon and map-review work.
