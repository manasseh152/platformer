# Level Browser Registry Plan

## Milestone 1: catalog foundations

- Split monolithic level data into `src/campaign/*`.
- Keep `src/campaign/registry.js` and `src/gyms/registry.js` as separate static catalogs.
- Keep reusable level-scene/tilemap domain code in `src/levels/*`; this can move toward `core` later if needed.
- Delete the old `src/level.js` facade once imports are migrated.
- Add `src/categories/registry.js` as a centralized category/tag catalog.
- Add shared catalog metadata validation for common fields.
- Remove URL-selected initial levels; boot always uses `getDefaultLevel()`.

Canonical IDs:

- `act-01-level-1`
- `legacy-movement-lab`
- `legacy-hazard-lab`
- `legacy-enemy-zoo`
- `gate-lab`
- `ui-navigation-gym`

Common catalog fields:

- `id`
- `name`
- `kind`
- `categories`
- `visibility`
- `description`

Conventions:

- `kind` is implementation/runtime type, e.g. `tilemap-level` or `executable-gym`.
- `categories` are generic grouping/filter tags.
- `visibility` is access policy: `public` or `developer`.
- `legacy` is a filter category/tag, not a status field.
- Level Select remains named Level Select and groups entries by visible group categories.
- Executable gyms remain registry-only until Milestone 2.

## Milestone 2: browser behavior

- Compose level, gym, zoo, lab, and future scene catalogs into a Level Select/browser registry.
- Add developer-only category filters and search.
- Add launch handling for executable gyms and future scenes.
