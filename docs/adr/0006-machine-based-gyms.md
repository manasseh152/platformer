# ADR 0006: Machine-based gyms

## Status

Accepted.

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

Gym pass/fail is reported as runner state. Machine failures do not crash the runtime during normal execution. `window.__gym` remains read-only for this slice and exposes snapshots only. Devtools adapt the runner control surface for start/pause/reset.

Gym maps should be minimal fixtures containing only the geometry/entities needed by their machines. Machine-based gyms use `goal: null` unless validating a goal system.

Free camera is deferred. It should become a devtools inspection feature for viewing gym worlds/machines without changing machine simulation.

## Implementation slices

### Slice 1: Foundation and Movement Gym tracer bullet

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

Add focused machines/fixtures for jump gap, run+jump coupling, air correction, dash, and NPC movement as separate lanes or maps only when each machine needs them.

### Slice 3: Devtools inspection

Add free camera and machine-focused viewing tools. These tools must not affect deterministic machine simulation.

### Slice 4: Showcase/observer gyms

Add animation/rendering gyms using `state-fixture` and `observer` machines. These gyms may be primarily viewed with devtools/free cam rather than normal player controls.

### Slice 5: Reintroduce removed validations as real gyms

Finish-gate or UI-adjacent validations may return only if they are in-engine system fixtures with machines. Browser shell/navigation coverage should remain ordinary smoke tests, not gyms.

## Consequences

- The Gyms tab contains only in-engine machine-based validation scenarios.
- CI can load a gym and poll read-only snapshot state.
- Devtools can manipulate machines without adding public automation mutation APIs.
- Future gym additions have a clear content and runtime contract.
