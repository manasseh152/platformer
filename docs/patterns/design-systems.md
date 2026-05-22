# Design systems

Chibi Hollow uses two import-selected design systems plus a tiny shared foundation.

## Foundation

`styles/foundation/` is non-visual. It may contain reset, font loading, reduced-motion, and accessibility defaults. It should not define colors, shadows, radii, brand styling, or app components.

## Game system

`styles/systems/game/` is the expressive Chibi Hollow interface language used by the player-facing game, menus, Map Editor, and game design previews.

- Dark-first today.
- Structured so a future light palette can be added deliberately.
- Do not add a fake light mode until the complete game UI has been designed and validated.

## Workbench system

`styles/systems/workbench/` is the minimal, clean interface language for docs, internal tools, helpers, reports, and design-board chrome.

- Follows `prefers-color-scheme` by default.
- Supports explicit overrides with `<html data-theme="light">` or `<html data-theme="dark">`.
- Light mode follows the previous neutral design-page style.
- Dark mode keeps the same restrained structure with dark background and light foreground.
- Content uses the shared `--wb-content-inline` measure (`--wb-content-width`, currently `1120px`, with the standard gutter). Apply that same measure to page shells, footers, and header/nav inner bars; avoid one-off wider workbench variants.

## Shared shape

Both systems follow the same file structure:

```txt
tokens.css
primitives.css
components.css
index.css
```

`tokens.css` owns semantic values. `primitives.css` implements the shared `.ds-*` primitive contract. `components.css` contains system-specific composed components.

## Class vocabulary

Use `.ds-*` for cross-system primitives such as buttons, panels, screens, action rows, keycaps, chips, and surfaces.

Use `.wb-*` for workbench-only layout and content vocabulary such as shells, heroes, sidebars, cards, grids, fields, specs, and badges.

Start with the shared pattern. Break out only when a real UI need requires it.
