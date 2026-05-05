# Level Browser Registry Plan

Superseded by `docs/adr/0001-scenes-scenarios-and-tilemaps.md`.

The level browser is now backed by the canonical scenario model:

- scenarios come explicitly from `src/campaigns/`, `src/gyms/`, and `src/zoos/`
- tilemaps live under `src/tilemaps/` as gameplay data assets, not inferred launch entries
- clean scenario IDs are canonical (`movement-gym`, `hazard-gym`, `finish-gate-gym`, `enemy-zoo`)
- scenario `kind`, legacy scenario IDs, source-as-category tags, and old registry adapters have been removed
- scene-owned DOM and the scenario service are the current browser integration points

Keep this file only as a historical pointer; new structural decisions should update ADR 0001 or create a new ADR.
