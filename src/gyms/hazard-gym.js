export const hazardGymScenario = {
  id: 'hazard-gym',
  name: 'Hazard Gym',
  source: 'gyms',
  kind: 'gym-scenario',
  categories: ['gyms'],
  visibility: 'developer',
  description: 'Validates hazard placement and player damage edge cases in isolation.',
  docs: [],
  tests: [],
  covers: ['hazards.spikes-overlap', 'hazards.damage-player'],
  ci: true,
  composition: {
    type: 'tilemap-gameplay',
    seed: 'hazard-gym',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapLevelDefinitionId: 'hazard-gym-map',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  },
  targetId: 'hazard-gym-map'
};
