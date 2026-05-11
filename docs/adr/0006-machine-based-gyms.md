# ADR 0006: Machine-based gyms

## Status

Accepted. Implemented through Slice 5.

## Context

The project had developer-only gym entries that were mostly tilemaps or browser/navigation smoke checks. They did not consistently validate in-engine systems, and some claimed CI validation without executable machine logic. We need gyms to become focused, repeatable system fixtures that can be opened in the engine, inspected by developer tools, and observed by CI.

## Decision

Gyms are developer-only in-engine validation scenarios. A registered gym must launch a gameplay tilemap/world and define at least one runtime machine.

A gym machine is a runtime-agnostic validation controller. Machine definitions live with gym content; generic runner and scripted input primitives live in core. Machines declare:

- `id`
- `label`
- `authority`: `input`, `state-fixture`, or `observer`
- `validates`

Scenario entries own machine metadata and machine policy. Scenario launch enriches gameplay scene props with gym metadata rather than making gameplay scenes query catalog globals.

Gym pass/fail is reported as runner state. Machine failures do not crash the runtime during normal execution. `window.__gym` remains read-only and exposes snapshots/diagnostics only. Devtools adapt the runner control surface for start/pause/reset.

Gym maps should be minimal fixtures containing only the geometry/entities needed by their machines. Machine-based gyms use `goal: null` unless validating a goal system.

Free camera is a devtools inspection feature for viewing gym worlds/machines without changing machine simulation.

## Implementation slices

### Slice 1: Foundation and Movement Gym tracer bullet

Status: Implemented.

- Add gym pattern documentation.
- Add core machine runner with before/after gameplay phases.
- Add scripted semantic gameplay input adapter.
- Enforce active gym registry rules: tilemap gameplay composition plus machines.
- Deregister legacy `finish-gate-gym` and `ui-navigation-gym` from gyms.
- Rebuild Movement Gym as a minimal flat runway fixture.
- Add one machine: `movement.run-max-speed`.
- Auto-start Movement Gym machines once gameplay updates.
- Add global Gym devtools controls using existing devtools primitives.
- Expose read-only gym state under `window.__gym.snapshot().gym`.

### Slice 2: Broader movement coverage

Status: Implemented.

Implemented in Movement Gym as focused machine coverage for jump gap, run+jump coupling, air correction, dash burst, and NPC patrol movement. The fixture uses separate lanes in `movement-gym-map` where needed by each machine.

### Slice 3: Devtools inspection

Status: Implemented.

Gym devtools now include a free-camera toggle, camera nudges, follow-player reset, and machine-focused viewing. The inspection controls mutate only camera/devtools state and do not drive gameplay input or machine simulation.

### Slice 4: Showcase/observer gyms

Status: Implemented.

Rendering Gym adds a minimal in-engine fixture using a `state-fixture` machine to pin actor/effect showcase state and an `observer` machine to validate the gameplay render read model. These gyms may be primarily viewed with devtools/free cam rather than normal player controls.

### Slice 5: Reintroduce removed validations as real gyms

Status: Implemented.

Finish Gate Gym is restored as an in-engine system fixture with machines for finish trigger geometry and completion flow. It launches `finish-gate-gym-map` with a real `finish-gate` goal because the gym validates the goal/transition system itself.

UI-adjacent browser shell/navigation coverage remains ordinary smoke tests, not gyms.

## Consequences

- The Gyms tab contains only in-engine machine-based validation scenarios.
- CI can load a gym and poll read-only snapshot state.
- Devtools can manipulate machines without adding public automation mutation APIs.
- Future gym additions have a clear content and runtime contract.
