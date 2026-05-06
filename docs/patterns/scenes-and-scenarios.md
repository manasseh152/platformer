# Scenes and scenarios

## Terms

- **App**: composition root. Owns runtime, input, settings, scene host, scenario service, and shell UI wiring.
- **Runtime**: infrastructure boundary for events, storage, time, randomness, and test hooks.
- **Scene**: reusable runtime component with lifecycle methods. Examples: gameplay, start screen, pause overlay, settings overlay, scenario browser.
- **Scene stack**: ordered runtime scene composition. Base scene first, overlays after it.
- **Scenario**: launchable catalog entry. Campaigns, gyms, and zoos are scenarios.
- **Tilemap scene definition**: parsed tilemap data asset used by gameplay scenarios.
- **Gameplay session**: mutable runtime state for one gameplay run: tilemap scene, player, enemies, camera, particles, dust, and outcome.

## Core rule

Scenes are runtime components. Scenarios are catalog entries. Tilemap scenes are data assets.

Do not infer one from another by ID. A scenario may reference a tilemap scene, but the scenario remains the launchable thing.

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
          tilemapSceneId: 'movement-gym-map',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  }
}
```

`tilemapSceneId` is still accepted in scenario props while gameplay code finishes moving to scene terminology. New core code should prefer tilemap scene naming.

## Sources

- `campaigns`: public progression content.
- `gyms`: developer validation fixtures. Usually CI-enabled.
- `zoos`: developer documentation/examples. Usually CI-disabled unless explicitly opted in.

Visibility defaults by source, but entries may override:

- campaigns: `public`
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

- tilemap scene definition
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
