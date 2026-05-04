# Tilemap Upgrade Plan

## Goal

Upgrade the current 24×12 dungeon tilemap with both visual polish and moderate gameplay/layout improvements, while keeping scope small and avoiding new gameplay systems.

Primary outcomes:

- Reduce the current rectangular/repetitive feel.
- Improve dungeon atmosphere and depth.
- Make the level flow clearer: safe start → light branching/challenge → ceremonial gate room.
- Preserve gameplay readability and current camera/world behavior.

## Non-goals

- No world size increase; keep `24 cols × 12 rows`.
- No new collision model; keep solid tiles + spikes only.
- No one-way platforms, slopes, moving terrain, collectibles, keys, checkpoints, or new enemy types.
- No new external art pack for this pass.

## Agreed Design Decisions

- Use existing Kenney assets plus procedural canvas-drawn details.
- Keep camera/world presentation unchanged.
- Keep physics simple: only existing solid terrain and spikes affect gameplay.
- Add visual richness through a non-colliding `backdropRows` layer and deterministic render overlays.
- Make `backdropRows` optional/backward-compatible in `parseTilemap()`.
- Draw backdrop details behind decor, terrain, goal, spikes, enemies, player, and particles.
- Prioritize readability over dense decoration.
- Moderately reshape the map rather than rebuilding everything from scratch.

## New Backdrop Layer

Add optional `backdropRows` to level definitions.

Behavior:

- If omitted, `parseTilemap()` fills it with empty rows matching terrain dimensions.
- If provided, it must match terrain width/height.
- Unknown backdrop chars should throw parser validation errors.
- `forEachLayerTile(level, 'backdrop', callback)` should work like existing layers.

Initial backdrop chars:

| Char | Meaning |
| --- | --- |
| `.` | Empty |
| `a` | Background arch/recess |
| `k` | Wall crack |
| `c` | Hanging chain |
| `d` | Dark backing/shadow stone |

## Renderer Upgrade

### Draw order

1. Existing dungeon backdrop.
2. New `backdropRows` glyphs.
3. Existing `decorRows`.
4. Terrain tiles.
5. Goal.
6. Spikes.
7. Dust, enemies, player, particles, debug overlays.

### Stone tile overlays

Add deterministic, neighbor-aware overlays to existing solid terrain:

- `#`: darker/heavier wall or fill stone.
- `=`: brighter platform lip plus underside/contact shadow.
- `B`: standalone block treatment with stronger outline.

Use deterministic variation from `col,row`, not frame randomness.

Suggested overlays:

- Subtle shade variation.
- Small cracks/speckles.
- Top highlight when empty above.
- Side darkness when empty left/right.
- Underside shadow when empty below.
- Corner chips on exposed corners.

Keep overlays visually subtle so decorative details do not look collidable unless the tile is actually solid.

## Proposed Level Flow

- **Start chamber:** safe spawn at lower-left, readable path forward.
- **Lower challenge:** enemy patrol and spike hazard with clearer warning/composition.
- **Middle route:** staggered platforms that break up the grid.
- **Light branch:** optional-feeling upper route/ledge without adding reward systems yet.
- **Gate room:** elevated, symmetrical, decorated with banners/torches/flag, visually ceremonial.

## Implementation-ready Tilemap Sketch

This sketch is valid 24×12 and should be treated as implementation-ready but adjustable after render/playtest review.

```js
terrainRows: [
  '########################',
  '#......................#',
  '#......................#',
  '#.................===..#',
  '#.............===.BBB..#',
  '#.......====...........#',
  '#......................#',
  '#...====.........====..#',
  '#........^^^...........#',
  '#.....====.....====....#',
  '#..====.........====...#',
  '########################'
],
objectRows: [
  '........................',
  '........................',
  '........................',
  '..................<G>...',
  '........................',
  '........................',
  '.....E...........E......',
  '........................',
  '........................',
  '.....E............E.....',
  '..P.....................',
  '........................'
],
decorRows: [
  '........................',
  '..r...............g..f..',
  '........................',
  '..............t...t.....',
  '........................',
  '........................',
  '..........t.............',
  '........................',
  '.....t.........t........',
  '........................',
  '........................',
  '........................'
],
backdropRows: [
  '........................',
  '.a..k.....a.....k..a....',
  '....d..........c........',
  '........a.........d.....',
  '..k.........d...........',
  '...............a....k...',
  '....c.....k.............',
  '............d...........',
  '..d.............k.......',
  '........a...............',
  '...k.........c.....d....',
  '........................'
]
```

Notes:

- Exact platform/enemy/spike positions may be tweaked after rendering.
- Preserve one `P` and one `G` marker.
- Ensure each `E` stands above solid terrain.
- Keep gate readable and framed by decor/backdrop.

## Implementation Phases

### Phase 1: Parser and tests

- Add `BACKDROP_CHARS` validation.
- Add optional `backdropRows` defaulting.
- Ensure `layerRows(level, 'backdrop')` resolves correctly.
- Add tests for:
  - backward compatibility when `backdropRows` is omitted;
  - valid backdrop iteration;
  - invalid backdrop chars;
  - backdrop dimension mismatch.

### Phase 2: Renderer

- Import/use `forEachLayerTile(level, 'backdrop', ...)` in `render.js`.
- Add `drawBackdropLayer()` behind decor/terrain.
- Add drawing helpers for `a`, `k`, `c`, and `d`.
- Add deterministic stone overlay helper for existing solid tiles.
- Add lightweight neighbor-aware overlays using terrain tile queries.

### Phase 3: Tilemap/layout

- Apply the upgraded tilemap sketch to `levelDefinition`.
- Tune terrain/enemy/spike/decor placement if parser validation or visual review reveals issues.

### Phase 4: Validation

- Run `bunx playwright test`.
- Render full map PNG, e.g. `.temp/tilemap-upgrade.png`.
- Review the PNG for:
  - readable hazards;
  - readable enemies;
  - clear spawn and gate;
  - decorations not mistaken for solids;
  - reduced repetition;
  - stronger gate-room composition.

## Acceptance Criteria

- `docs/tilemap-upgrade-plan.md` captures this plan.
- `parseTilemap()` supports optional `backdropRows`.
- Tests cover backdrop defaults, validation, and iteration.
- Renderer draws backdrop glyphs behind decor/terrain.
- Stone tiles have deterministic, neighbor-aware visual overlays.
- Level layout is moderately reshaped within 24×12.
- Existing Playwright test suite passes.
- Full-map PNG artifact is rendered and visually reviewed.
