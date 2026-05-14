---
title: Asset creator handoff pattern
---

# Asset creator handoff pattern

Single artist/designer handoff source:

- [`docs/asset-creator-source.md`](../asset-creator-source.md)

Use this pattern whenever adding, replacing, commissioning, or reviewing game art.

## Rule

Keep asset requirements in one living source. Do not scatter current requirements through chat, screenshots, ADR migration notes, or one-off PR comments.

A creator should be able to open the source and retrieve:

- game scale and grid constraints
- visual direction
- existing asset IDs and file locations
- terrain/object/character sizing rules
- animation, anchor, light, and collision notes when relevant
- license/source requirements
- integration/review checklist

## Ownership

Code owns runtime truth. The asset source mirrors only the parts creators need.

| Code/doc area | Mirror for creators |
| --- | --- |
| `src/core/constants.js` | Camera, grid, actor, hitbox, and world scale numbers. |
| `src/render/assets/**` | Runtime asset IDs, pack manifests, atlas/sprite metadata, browser loading constraints. |
| `src/assets/**`, `public/assets/**` | File locations, source/license files, pack names. |
| `src/content/**` | How art is used in tilemaps, objects, scenarios, gyms, and zoos. |
| `docs/patterns/terrain.md` | Terrain containment, cell size, autotile, and collision implications. |
| `docs/patterns/rendering.md` | Renderer constraints that affect asset shape, alpha, outlines, lighting, or sampling. |

## Update workflow

1. Inspect the code or intended asset change.
2. Update `docs/asset-creator-source.md` with current, actionable facts.
3. Link code blocks or technical doc sections when creators need context; do not copy large implementation details.
4. Remove stale values instead of preserving history.
5. For visual changes, produce/validate a full-map artifact when the map/rendering outcome should be reviewed.

## Asset family standard

Each asset family should list, when known:

- stable ID/name used by code
- file path or pack location
- intended gameplay/UI use
- native size and in-game draw size
- anchor/origin and collision relation
- animation frame layout/timing
- palette/style constraints that affect production
- license/source attribution requirements

## Do not include

- historical migration plans
- unresolved ideas that are not current constraints
- implementation internals a creator does not need
- one-off review comments that belong on an issue/PR

Use a separate brief or issue for speculative direction. Promote it into the asset source only after it becomes current agreed direction.
