export const movementGymScenario = {
  id: 'movement-gym',
  name: 'Movement Gym',
  source: 'gyms',
  kind: 'gym-scenario',
  categories: ['movement'],
  visibility: 'developer',
  description: 'Validates player movement traversal in an isolated tilemap fixture.',
  docs: [],
  tests: [],
  covers: ['movement.jump', 'movement.platform-traversal'],
  ci: true,
  composition: {
    type: 'tilemap-gameplay',
    seed: 'movement-gym',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapLevelDefinitionId: 'movement-gym-map',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  },
  // Deprecated compatibility during legacy ID migration.
  targetId: 'movement-gym-map'
};
