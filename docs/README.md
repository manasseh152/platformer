# Project docs

This directory documents current patterns, not historical plans.

Use these docs when adding or changing code:

- `patterns/scenes-and-scenarios.md` — runtime scenes, launchable scenarios, gyms, zoos, and app/session boundaries.
- `patterns/tilemap-scenes.md` — composable tilemap scene authoring with objects, layers, and components.
- `patterns/settings-and-ui.md` — settings/menu UI state, persistence, and motion rules.

## Documentation rules

- Prefer short pattern docs over ADRs and implementation plans.
- Document the current intended shape, not migration history.
- If code changes the pattern, update the matching doc in the same commit.
- Keep TODOs out of docs unless they are explicit constraints for current code.
