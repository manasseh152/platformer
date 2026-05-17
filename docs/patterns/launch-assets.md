---
title: Launch Asset pipeline
description: Generation and validation rules for release-preparation screenshots, install assets, and visual review artifacts
tags: [launch-assets, pwa, screenshots, validation]
---

# Launch Asset pipeline

**Launch Assets** are generated release-preparation outputs for presentation, installation, and review. Use this term in product/domain discussion; reserve PWA, manifest, Playwright, and CI language for implementation details.

## Current direction

- Treat Launch Asset work as a hybrid generation and validation pipeline.
- Generation writes deterministic release artifacts such as icons, link-preview images, store screenshots, and full-map review PNGs.
- Validation checks required coverage, dimensions, freshness, and manifest references.
- Avoid strict pixel baselines initially except where an artifact is already intended for visual review.

## Artifact ownership

Launch Asset outputs fall into three ownership classes:

| Class | Purpose | Paths |
| --- | --- | --- |
| Release artifacts | Checked in or packaged assets visible to stores, links, or installed-app surfaces. | `public/icons/*`, `public/favicon.ico`, `public/logos/chibi-hollow-wordmark.svg`, `public/og-image.{svg,png}`, `public/store/screenshots/{subject}/{viewport}.png` |
| Review artifacts | Generated on demand or uploaded from CI for human review. | `.temp/full-map.png`, future `.temp/launch-assets/review/*` |
| Test diagnostics | Ephemeral debugging output, not Launch Assets unless deliberately promoted. | `test-results/**`, Playwright traces and retry screenshots |

## Screenshot capture policy

Store screenshots should start from real app routes so captured gameplay and editor surfaces remain honest. Use deterministic launch parameters or test hooks where needed for selected scenario, viewport, Developer Mode, input scheme, and frozen timing.

A dedicated screenshot stage may be added later for marketing composites, captions, or device-frame layouts, but it should not replace route-based gameplay/editor captures.

Initial screenshot viewports:

| ID | Size | Purpose |
| --- | --- | --- |
| `desktop-1920x1080` | 1920×1080 | Web/desktop release presentation |
| `mobile-landscape-2340x1080` | 2340×1080 | Wide phone landscape presentation |
| `tablet-landscape-2732x2048` | 2732×2048 | Tablet landscape presentation |

Add exact App Store or Play Store required sizes only when a specific store submission requires them.

Store screenshots should be raw app captures at first. If store listings later need captions, gradients, or device frames, generate derived framed screenshots from the raw captures under a separate path such as `public/store/framed-screenshots/*`. Do not add marketing text to real app routes just to support screenshots.

Store screenshots should be written under `public/store/screenshots/{subject}/{viewport}.png`, for example `public/store/screenshots/start-screen/desktop-1920x1080.png`.

Initial subject ids and route intent:

- `start-screen`: `/?capture=start-screen`
- `campaign-gameplay`: `act-01-level-3` Campaign Gameplay route with `capture=campaign-gameplay`; exact URL should follow existing scenario URL APIs.
- `map-editor`: `/editor?capture=map-editor` with capture-only showcase draft mode enabled.
- `scenario-browser`: player-facing Scenario Browser route with `capture=scenario-browser` and **Developer Mode** off.

Initial required store screenshot subjects:

1. Start Screen — brand/product entry.
2. Campaign Gameplay — `act-01-level-3`, a polished **Campaign** **Scenario**, not a **Gym**.
3. Map Editor — authoring surface included in the **Installed App**, loaded with a capture-only showcase draft.
4. Scenario Browser / Level Select — player-facing content structure with **Developer Mode** off.

Generate the full initial subject × viewport matrix: four subjects across the three initial viewports, for twelve raw screenshots. The manifest may support exceptions later, but initial coverage should be complete.

Use `scenario-browser` as the manifest subject id for the Level Select screenshot. The UI may say “Level Select,” but the asset pipeline should describe the subject as player-facing content structure.

Use a generated capture-only showcase draft for the Map Editor screenshot. It should demonstrate authoring with terrain, a **Finish Gate**, player start, and editor UI without implying shipped **Campaign** **Scenarios** are directly editable. The draft should be deterministic and should not be persisted as a real **Local Draft** unless the Map Editor workflow requires persistence.

**Developer Mode** and **Gyms** may produce review or validation artifacts, but should not be part of store-facing screenshots.

Store screenshots should use curated route-based capture:

- Do not show dev toolbox/debug overlays, Playwright cursors, or accidental transient UI.
- Show HUD, input hints, or instructional overlays only when that subject intentionally demonstrates them.
- Campaign gameplay captures should launch a specific **Campaign** **Scenario** with deterministic player/camera placement and stable animation timing where available.
- Review artifacts may include overlays when their purpose is validation or debugging.

Readiness policy:

- Static shell, editor, and menu captures may wait on stable selectors such as the game root, editor canvas, or scenario-browser DOM.
- Gameplay captures that depend on loaded assets, camera placement, animation timing, or scenario setup should expose an explicit capture readiness hook.
- Capture readiness hooks should be enabled by capture/query-param mode and should remain implementation/test language, not player-facing product language.

Capture mode should be selected with a `capture` query parameter such as `capture=start-screen`, `capture=campaign-gameplay`, `capture=map-editor`, or `capture=scenario-browser`. Capture mode should activate only when the query parameter is present and an explicit build-time flag allows capture, such as `VITE_ENABLE_CAPTURE_MODE=true`; normal production deployments should not react to `?capture=`. Do not add a runtime global override for enabling capture mode. Capture mode may perform presentation-safe setup only. It may choose a route or scenario, set viewport/input scheme, use reachable player or camera placement, freeze animation after settling, and hide debug/transient UI. It must not spawn impossible content, inject marketing overlays into real app UI, or bypass product screens for store screenshots.

## Commands

Use separate write and check commands:

```sh
bun run generate:launch-assets
bun run validate:launch-assets
bun run validate:launch-assets:built
```

`generate:launch-assets` may mutate release artifacts in `public/` and write review artifacts under `.temp/`. It should generate active assets only by default; `--include-planned` may be added for development attempts against planned screenshot or review artifacts. Icon and map generation do not need capture mode; screenshot capture should set `VITE_ENABLE_CAPTURE_MODE=true` only for the build/preview used by capture. `validate:launch-assets` should verify existing active release artifacts are fresh, covered, and referenced correctly without updating them. Default validation should inspect source/manifest configuration and `public/` assets directly without running a build. A `--built` mode may additionally validate `dist/manifest.webmanifest` and other built outputs, with build orchestration kept in CI/package scripts rather than hidden inside the validator. `--built` should require `dist/` to already exist and fail with a clear message if it does not. A package convenience script such as `validate:launch-assets:built` may run `bun run build` before invoking built validation. Keep `validate:launch-assets` separate from `validate:foundation` until screenshot capture is deterministic enough for routine foundation checks. CI should run launch-asset validation for release-preparation workflows; CI may also produce upload-only review artifacts without committing them.

Validation policy:

- Keep Installed App behavior tests, such as service-worker/offline behavior and shortcut semantics, in `tests/pwa.spec.js`.
- Launch Asset validation owns asset-reference checks for manifest icons, image dimensions, icon purposes, and future screenshot/store metadata references.
- Built validation is authoritative for `dist/manifest.webmanifest` icon references and purposes.
- Source-level validation may sanity-check that Launch Asset `publicPath`s cover expected Installed App icon paths, but should avoid brittle coupling to `vite-plugin-pwa` internals.
- HTML reference validation should be staged: default validation checks source HTML files for favicon, apple touch icon, Open Graph image, and Twitter image references where relevant; `--built` verifies the built `dist/` equivalents still reference and copy expected files.
- Keep the current HTML metadata split: main `index.html` should expose favicon, apple-touch-icon, Open Graph image, and Twitter image references; editor/docs pages need favicon references only unless they become share targets.
- Deterministic generated release artifacts, such as icons and link-preview images, should be regenerated to a temporary location and byte-compared with checked-in files. Byte-compare all active `generator: 'icons'` outputs, including SVG, PNG, ICO, wordmark, and OG/link-preview files.
- Generated Launch Assets should not include timestamps or nondeterministic metadata. If browser-rendered PNG output proves byte-unstable, prefer dimension checks or decoded-pixel comparison before abandoning deterministic validation.
- Manifest references, required files, image dimensions, and screenshot subject/viewport coverage should be checked structurally.
- Basic dimension validation should avoid new dependencies initially: parse PNG IHDR and ICO directory metadata in Node; SVG root dimension parsing may be added later.
- Store screenshots should start with structural checks only; add pixel or byte freshness once route-based captures are stable enough.
- Support incremental rollout with validation phases: normal validation checks active/implemented asset classes, while `validate:launch-assets --complete` enforces active and planned outputs.
- Manifest entries may use `status: 'planned' | 'active'` during rollout; normal validation should not fail missing planned assets.
- `status` defaults to `active`; use `status: 'planned'` only for outputs declared ahead of implementation.
- Keep `screenshotMatrix.status = 'planned'` only until screenshot generation exists; once screenshot capture is wired, flip the matrix active as a unit before introducing per-subject exceptions.
- Review artifacts need only prove successful generation unless a specific review workflow defines stricter checks.
- Validation failures should print remediation commands, such as `bun run generate:icons` or `bun run generate:launch-assets`, so developers know how to update or inspect stale artifacts.

Keep focused commands for local workflows:

- `generate:icons` remains useful when touching icon artwork and should default to writing `public/`.
- Icon generation should support an alternate output root, such as `node tools/generate-icons.js --out-dir .temp/launch-assets/generated-public`, preserving public-relative paths below that root for validation byte-compare.
- `render:map` and `validate:map-render` remain useful for tilemap/rendering review outside release preparation.
- The Launch Asset manifest should include `.temp/launch-assets/review/act-01-level-3-full-map.png` as an `act-01-level-3` full-map review artifact because it is also the initial Campaign Gameplay screenshot target.
- `act-01-level-3-full-map-review` is active now that Launch Asset orchestration wires map rendering, while the standalone `render:map` command remains available for focused map-review work.
- `generate:launch-assets` is the release-preparation umbrella that reuses icon generation, map rendering, and screenshot capture instead of replacing their standalone workflows.

## Source of truth

A single Launch Asset manifest should declare expected outputs, sizes, capture routes or scenarios, and ownership metadata. Generation tools and validation tests should read that manifest instead of each hardcoding separate asset lists.

The manifest should be a grouped data-only object with reusable dimensions and concrete expected outputs:

```js
export const launchAssetManifest = {
  version: 1,
  viewports: [
    { id: 'desktop-1920x1080', width: 1920, height: 1080 },
    { id: 'mobile-landscape-2340x1080', width: 2340, height: 1080 },
    { id: 'tablet-landscape-2732x2048', width: 2732, height: 2048 }
  ],
  screenshotSubjects: [
    { id: 'start-screen', route: '/', waitFor: '#game' }
  ],
  screenshotMatrix: {
    status: 'active',
    outputPattern: 'public/store/screenshots/{subject}/{viewport}.png',
    subjects: ['start-screen', 'campaign-gameplay', 'map-editor', 'scenario-browser'],
    viewports: ['desktop-1920x1080', 'mobile-landscape-2340x1080', 'tablet-landscape-2732x2048']
  },
  assets: [
    { id: 'icon-192', kind: 'icon', ownership: 'release', output: 'public/icons/icon-192.png', dimensions: { width: 192, height: 192 } }
  ]
};
```

The manifest should include generation recipes, not just expected file paths. Useful fields include:

- `kind`: broad asset kind such as `icon`, `screenshot`, `tilemapRender`, or `linkPreview`.
- `format`: file format such as `png`, `svg`, or `ico` when useful.
- `output`: repo-relative generated file path.
- `publicPath`: web/public path when needed for manifest or HTML reference validation.
- `ownership`: `release` or `review`.
- `viewport`: screenshot viewport id and dimensions when relevant.
- `route` or `scenarioId`: source app route or content id when relevant; screenshot subjects should declare routes explicitly instead of inferring routes from subject ids.
- `waitFor`: deterministic readiness selector or condition for browser captures.
- `generator`: simple generator id such as `icons`, `screenshots`, or `mapRender`; avoid coupling manifest entries to package script names.
- `dimensions`: expected output dimensions; required for raster images, ICO files, and screenshots; optional but recommended for SVG.

Screenshots should be generated from the default `screenshotMatrix` cross-product rather than listed manually. Validation should expand the matrix into twelve expected raw screenshot outputs and may support per-subject exceptions later.

Keep `assets` for non-screenshot concrete assets such as icons, favicon, link-preview images, wordmarks, and review maps. Tooling should expose a normalized expanded output list internally, for example `getLaunchAssetOutputs(manifest)`, that includes both concrete assets and expanded screenshot outputs.

Use repo-relative `output` paths for generation and validation. Add `publicPath` only when an asset must be checked against Installed App manifest or HTML references, for example `{ output: 'public/icons/icon-192.png', publicPath: '/icons/icon-192.png' }`. Manifest-referenced icons should also declare expected manifest metadata, such as sizes, type, and purpose.

Icon, favicon, wordmark, and OG/link-preview assets are active in the first implementation slice because they already exist and are generated by `tools/generate-icons.js`. Manifest metadata should be checked for:

- `icon-192`: `sizes: '192x192'`, `type: 'image/png'`, `purpose: 'any'`
- `icon-512`: `sizes: '512x512'`, `type: 'image/png'`, `purpose: 'any'`
- `icon-maskable-512`: `sizes: '512x512'`, `type: 'image/png'`, `purpose: 'maskable'`

Initial non-screenshot asset ids:

- `app-icon-svg`
- `favicon-svg`
- `favicon-ico`
- `wordmark-svg`
- `og-image-svg`
- `og-image-png`
- `favicon-16`
- `favicon-32`
- `apple-touch-icon`
- `icon-192`
- `icon-512`
- `icon-maskable-512`
- `act-01-level-3-full-map-review`

Planned implementation shape:

```text
tools/launch-assets.manifest.js
tools/generate-launch-assets.js
tools/validate-launch-assets.js
tools/capture-launch-screenshots.js or playwright.launch-assets.config.js
```

Use small shared modules and thin CLI wrappers instead of one monolithic script. Generation and validation should share manifest parsing, while icon, map-render, and screenshot responsibilities remain focused and testable.

Test the pipeline by concern:

- Node-level tests should cover manifest schema, output path conventions, and required subject × viewport coverage.
- Playwright capture config/specs should cover browser screenshot generation.
- Installed App behavior remains covered by existing PWA tests rather than duplicated in Launch Asset tests.

The manifest should distinguish release artifacts from review artifacts and should not treat generic Playwright diagnostics as Launch Assets.

## Implementation slices

Implemented slices:

1. Launch Asset manifest, structural validator, and icon alternate-output support for deterministic byte compare.
2. Route-based screenshot capture with capture-mode flag plumbing.
3. Gameplay and editor capture hooks for Campaign Gameplay and Map Editor screenshots.
4. Map review artifact orchestration for `act-01-level-3`.

## Existing reusable pieces

- `tools/generate-icons.js` owns generated icon, favicon, wordmark, and link-preview assets today.
- `tools/render-map.js` owns full tilemap PNG rendering today.
- Playwright owns browser-level capture and validation workflows.
- Launch Asset screenshot capture should use a separate Playwright config, such as `playwright.launch-assets.config.js`, while reusing the existing Vite build/preview web-server pattern.
- The main `playwright.config.js` should stay focused on behavior tests and diagnostics.
- `vite.config.js` owns Installed App manifest configuration and service-worker asset inclusion.
