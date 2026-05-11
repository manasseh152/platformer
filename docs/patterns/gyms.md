# Gyms and machines

Gyms are developer-only, in-engine system validation scenarios. A gym must open as a gameplay world/tilemap that can be inspected with developer tools and validated by runtime machines. Browser shell/navigation smoke tests are not gyms.

## Gym content rules

- Gym scenarios use `source: 'gyms'`, `visibility: 'developer'`, and `composition.type: 'tilemap-gameplay'`.
- A gym launches a gameplay scene with a tilemap/world fixture.
- A gym defines at least one machine.
- Gym maps are minimal fixtures: include only blocks/entities required by the validation. Do not build miniature campaign levels.
- Use `goal: null` unless the gym is specifically validating campaign goals or finish gates.

## Machines

A machine is a runtime validation controller owned by the active gym session. It can set up fixtures, drive or observe systems, and report pass/fail state. Failures are reported as gym state, not thrown during normal execution.

Machine definitions live next to gym content, e.g. `src/content/gyms/movement-machines.js`. Generic runner/input infrastructure lives in core.

Required metadata:

```js
{
  id: 'movement.run-max-speed',
  label: 'Run max speed',
  authority: 'input',
  validates: ['movement.input', 'movement.physics']
}
```

Authority values:

- `input`: drives semantic gameplay input to validate real systems.
- `state-fixture`: intentionally pins/sets state for showcase validation, such as animation loops.
- `observer`: observes/asserts system output without owning behavior.

Input-authority machines are exclusive by default. Showcase and observer machines may become parallel later when fixture ownership is explicit.

## Lifecycle

Machines may implement:

- `setup({ session, runtime, record })`
- `start(...)`
- `pause(...)`
- `reset(...)`
- `beforeUpdate({ session, runtime, dt, record })`
- `afterUpdate({ session, runtime, dt, record })`

Input machines return semantic input from `beforeUpdate`:

```js
return { input: { moveX: 1, jumpPressed: false } };
```

The runner applies machine input before gameplay physics and records assertions after gameplay physics.

## Runtime and tooling

- Scenario entries own machine metadata and machine policy.
- Launch enriches gameplay scene props with gym metadata.
- `window.__gym.snapshot().gym` exposes read-only gym/machine state for CI and diagnostics.
- Devtools use the runner control surface (`startAll`, `pauseAll`, `resetAll`) but automation should prefer read-only snapshots unless a separate mutation API decision is made.
- Devtools expose free-camera and machine-focus inspection controls for gym worlds. These controls change only camera/viewing state (`follow`, `free`, or `gym-inspect`) and must not drive gameplay input or affect deterministic machine simulation.
- Showcase gyms may pair `state-fixture` machines that pin deterministic actor/effect state with `observer` machines that validate render/read-model output. Keep those fixtures small and prefer `goal: null` unless validating a goal.
