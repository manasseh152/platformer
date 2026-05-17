---
title: Scenes and scenarios
---

# Runtime scenes and scenario launching

Shared domain language lives in [`../../CONTEXT.md`](../../CONTEXT.md). This pattern doc covers the implementation seam between launchable scenarios and runtime scenes.

## Runtime implementation terms

- **App**: composition root. Owns runtime, input, settings, scene host, scenario service, and shell UI wiring.
- **Runtime**: infrastructure boundary for events, storage, time, randomness, and test hooks.
- **Scene**: reusable runtime component with lifecycle methods. Examples: gameplay, start screen, pause overlay, settings overlay, scenario browser.
- **Scene stack**: ordered runtime scene composition. Base scene first, overlays after it.

## Core rule

Scenes are runtime components. Scenarios are launchable domain entries. Tilemaps are authored spatial layouts.

Do not infer one from another by ID. A scenario may reference a tilemap, but the scenario remains the launchable thing.

## Scenario shape

```js
{
  id: 'movement-gym',
  source: 'gyms',
  name: 'Movement Gym',
  categories: ['movement'],
  visibility: 'developer',
  docs: [],
  tests: [],
  covers: ['movement.jump', 'movement.wall-slide'],
  ci: true,
  composition: {
    type: 'tilemap-gameplay',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapId: 'movement-gym-map',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  }
}
```

`tilemapId` is still accepted in scenario props while gameplay code finishes moving to scene terminology. New core code should prefer tilemap naming.

## Sources

- `campaigns`: public progression content.
- `local`: public same-device drafts saved by the browser map editor. These are dynamic scenario entries generated from local storage, not static registry content.
- `gyms`: developer validation fixtures. Usually CI-enabled.
- `zoos`: developer documentation/examples. Usually CI-disabled unless explicitly opted in.

Visibility defaults by source, but entries may override:

- campaigns: `public`
- local: `public`
- gyms: `developer`
- zoos: `developer`

## Scene stack pattern

Examples:

```txt
[ StartScreen ]
[ Gameplay ]
[ Gameplay, PauseOverlay ]
[ Gameplay, PauseOverlay, SettingsOverlay ]
```

Input is offered from top scene to bottom scene. Top scenes may consume discrete input. Gameplay systems may continue reading continuous movement input during update.

## Gameplay session boundary

Gameplay systems should receive a `gameplaySession`, not the full app shell.

Session-owned state:

- tilemap definition
- player
- enemies
- camera
- particles/dust
- outcome/goal state

App-owned state:

- settings
- scenario selection/current scenario
- scene stack
- UI roots
- URL launch behavior
- input collection

## Browser naming

User-facing UI may say “Level Select” in public mode. Developer mode can say “Scenario Browser”. Internally, the browser reads scenarios from the scenario service, not raw tilemap registries.

The browser uses top-level scenario tabs:

- **Acts**: campaign scenarios grouped by `act-*` categories.
- **Local**: same-device editor drafts stored under `chibi.tilemap-editor.*`, sorted recent-first. Local scenario ids use `local:<draft-id>`, and runtime tilemap ids are also rewritten to `local:<draft-id>` to avoid collisions with shipped content. Draft ids must be kebab-case to launch from Level Select. Missing `P` blocks launch; missing `G` is a warning.
- **Gyms** and **Zoos**: developer-only tabs shown when Developer Mode or developer URL override is active.

Map editor **Play preview** remains a temporary handoff via `previewTilemapKey` and is separate from durable Local drafts. **Save local** persists the draft for the Local tab. See [Map editor patterns](./map-editor.md) for editor save, preview, and local draft conventions.
