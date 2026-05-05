export const finishGateGymScenario = {
  id: 'finish-gate-gym',
  name: 'Finish Gate Gym',
  source: 'gyms',
  kind: 'gym-scenario',
  categories: ['gyms'],
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
          tilemapLevelDefinitionId: 'finish-gate-gym-map',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  },
  targetId: 'finish-gate-gym-map'
};
