export const legacyEnemyZooScenario = {
  id: 'legacy-enemy-zoo',
  name: 'Legacy Enemy Zoo',
  source: 'zoos',
  kind: 'zoo-scenario',
  visibility: 'developer',
  categories: ['zoos', 'legacy'],
  description: 'Legacy tilemap-only zoo showing enemy combinations. Will be replaced by enemy-zoo.',
  docs: [],
  tests: [],
  covers: ['enemy.composition-showcase'],
  ci: false,
  composition: {
    type: 'tilemap-gameplay',
    seed: 'legacy-enemy-zoo',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapLevelDefinitionId: 'legacy-enemy-zoo',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  }
};
