export const finishGateGymScenario = {
  id: 'finish-gate-gym',
  name: 'Finish Gate Gym',
  source: 'gyms',
  categories: ['finish-gate'],
  visibility: 'developer',
  description: 'Validates finish gate trigger sizing, support blocks, camera framing, and completion flow.',
  docs: [],
  tests: [],
  covers: [
    'finish-gate.enter-completes-level',
    'finish-gate.trigger-sizing',
    'finish-gate.support-blocks'
  ],
  ci: true,
  composition: {
    type: 'tilemap-gameplay',
    seed: 'finish-gate-gym',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapId: 'finish-gate-gym-map',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  }
};
