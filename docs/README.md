# Project docs

This directory documents current patterns, not historical plans.

Use these docs when adding or changing code:

- `adr/0001-realign-project-boundaries-around-ecs.md` — migration tracker for untangling core/content/catalog/app boundaries around the ECS-ish scene model.
- `adr/0002-rename-tilemap-scene-data-assets-to-tilemaps.md` — required terminology migration before terrain/collision work continues.
- `adr/0003-contained-terrain-scale.md` — 32/16/8 cell-size model, contained terrain rendering, and collision layer decisions.
- `adr/0004-foundation-review-before-new-systems.md` — accepted rule for keeping the foundation review current before major new systems.
- `patterns/scenes-and-scenarios.md` — runtime scenes, launchable scenarios, gyms, zoos, and app/session boundaries.
- `patterns/tilemaps.md` — composable tilemap authoring with objects, layers, and components.
- `patterns/terrain.md` — contained terrain authoring, render, and collision derivation pipeline.
- `patterns/settings-and-ui.md` — settings/menu UI state, persistence, and motion rules.
- `patterns/speedrun.md` — Speed Run Mode timing, local records, attempt lifecycle, and UI rules.
- `patterns/devtools.md` — Developer Mode toolbox registry, runtime UI, debug overlays, and playbook boundaries.
- `patterns/rendering.md` — Canvas rendering helpers, pixel-perfect rect outlines, and rendering migration boundaries.
- `patterns/foundation-review.md` — living foundation audit for refactor/reuse priorities before adding major systems.

## Documentation rules

- Prefer short pattern docs over ADRs and implementation plans.
- Document the current intended shape, not migration history.
- If code changes the pattern, update the matching doc in the same commit.
- Keep TODOs out of docs unless they are explicit constraints for current code.
