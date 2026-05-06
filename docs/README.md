# Project docs

This directory documents current patterns, not historical plans.

Use these docs when adding or changing code:

- `adr/0001-realign-project-boundaries-around-ecs.md` — migration tracker for untangling core/content/catalog/app boundaries around the ECS-ish scene model.
- `adr/0002-rename-tilemap-data-assets-to-tilemaps.md` — required terminology migration before half-grid terrain/collision work continues.
- `patterns/scenes-and-scenarios.md` — runtime scenes, launchable scenarios, gyms, zoos, and app/session boundaries.
- `patterns/tilemaps.md` — composable tilemap authoring with objects, layers, and components.
- `patterns/settings-and-ui.md` — settings/menu UI state, persistence, and motion rules.

## Documentation rules

- Prefer short pattern docs over ADRs and implementation plans.
- Document the current intended shape, not migration history.
- If code changes the pattern, update the matching doc in the same commit.
- Keep TODOs out of docs unless they are explicit constraints for current code.
